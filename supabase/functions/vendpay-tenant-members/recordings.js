
import {manifest} from './audio-manifest.js';
const norm=s=>s.normalize('NFC').replace(/\s+/g,' ').trim();
const entries=Object.entries(manifest).sort((a,b)=>b[0].length-a[0].length);
export function recordedText(text) {
 const value=norm(text),out=[];let i=0,unknown='';
 const flush=()=>{if(unknown.trim())out.push('t-'+unknown.trim());unknown='';};
 while(i<value.length){
  if(value[i]===' '){if(unknown)unknown+=' ';i++;continue;}
  const found=entries.find(([phrase])=>value.startsWith(phrase,i)&&(i+phrase.length===value.length||value[i+phrase.length]===' '));
  if(found){flush();out.push('f-'+found[1]);i+=found[0].length;continue;}
  const num=/^\d+(?=\s|$)/.exec(value.slice(i));
  if(num){flush();const s=num[0];out.push((s.length>6||s.length>1&&s[0]==='0'?'d-':'n-')+s);i+=s.length;continue;}
  const end=value.indexOf(' ',i);const to=end<0?value.length:end;
  unknown+=value.slice(i,to);i=to;
 }
 flush();return out.join('.');
}
export function renderRecordings(body,source){
 return body.replace(/((?:^|&)(?:read|id_list_message)=)([^&]*)/g,(_,prefix,payload)=>{
  const at=payload.indexOf('='),speech=at<0?payload:payload.slice(0,at),suffix=at<0?'':payload.slice(at);
  const parts=speech.split('.'),out=[];let text=[];
  const flush=()=>{if(text.length){out.push(recordedText(text.join(' ')));text=[];}};
  for(const part of parts){if(part.startsWith('t-'))text.push(part.slice(2));else {flush();out.push(part);}}
  flush();return prefix+out.join('.')+suffix;
 });
}

const dynamicCache=new Map();
function mapSpeech(body,fn){
 return body.replace(/((?:^|&)(?:read|id_list_message)=)([^&]*)/g,(_,prefix,payload)=>{
  const at=payload.indexOf('='),speech=at<0?payload:payload.slice(0,at),suffix=at<0?'':payload.slice(at);
  return prefix+speech.split('.').map(fn).join('.')+suffix;
 });
}
export async function completeRecordings(body,resolve){
 const missing=new Set();
 mapSpeech(body,part=>{if(part.startsWith('t-'))missing.add(part.slice(2));return part;});
 if(!missing.size)return body;
 const paths=await resolve([...missing]);
 return mapSpeech(body,part=>{
  if(!part.startsWith('t-'))return part;
  const path=paths[part.slice(2)];
  if(typeof path!=='string'||!/^\/3\/4\/[a-zA-Z0-9_/]+$/.test(path))throw Error('invalid_recording');
  return 'f-'+path;
 });
}
async function generatePaths(texts){
 const paths={},missing=[];
 for(const text of texts){if(dynamicCache.has(text))paths[text]=dynamicCache.get(text);else missing.push(text);}
 if(missing.length){
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const r=await fetch((Deno.env.get('SUPABASE_URL')||'')+'/functions/v1/vendpay-recorded-audio',{
   method:'POST',headers:{Authorization:'Bearer '+key,'content-type':'application/json'},
   body:JSON.stringify({did:'0733182541',texts:missing}),signal:AbortSignal.timeout(23000)
  });
  if(!r.ok)throw Error('recording_unavailable');
  const data=await r.json();if(!data.paths)throw Error('recording_unavailable');
  for(const text of missing){
   const path=data.paths[text];
   if(typeof path!=='string'||!/^\/3\/4\/[a-zA-Z0-9_/]+$/.test(path))throw Error('invalid_recording');
   if(dynamicCache.size>=512)dynamicCache.delete(dynamicCache.keys().next().value);
   dynamicCache.set(text,path);paths[text]=path;
  }
 }
 return paths;
}
export function withRecordings(handler,source){
 return async req=>{
  let target=false;
  try{
   const p=new URLSearchParams(new URL(req.url).search);
   if(req.method==='POST'){const raw=await req.clone().text();if(raw.length>24000)return handler(req);for(const [k,v] of new URLSearchParams(raw))p.append(k,v);}
   target=p.getAll('ApiDID').length===1&&p.get('ApiDID')==='0733182541';
  }catch{}
  const response=await handler(req);
  if(!target||response.status!==200||!response.headers.get('content-type')?.includes('text/plain'))return response;
  const original=await response.clone().text();
  let updated=renderRecordings(original,source),failed=false;
  try{updated=await completeRecordings(updated,generatePaths);}catch{
   updated='id_list_message=f-/3/4/vpa_aa858e756736b2f7fc35a57b';failed=true;
  }
  if(updated===original)return response;
  const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('ETag');
  headers.set('X-Voice-Playback',failed?'recording-unavailable':'recording-v3');
  return new Response(updated,{status:response.status,headers});
 };
}

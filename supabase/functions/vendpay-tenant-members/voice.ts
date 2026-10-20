import {AsyncLocalStorage} from 'node:async_hooks';
import {catalog} from './voice-catalog.ts';
type Candidate={id:string,original:string,values:string[]};
const context=new AsyncLocalStorage<Candidate[]>();
const constants=new Map<string,Candidate>();
// Return the original string unchanged: validation, payloads and auditing always see defaults.
export function voice(id:string,parts:string[]):string{const original=parts.join(''),candidate={id,original,values:parts.filter((_,i)=>i%2===1)};const seen=context.getStore();if(seen)seen.push(candidate);else if(candidate.values.length===0)constants.set(id,candidate);return original;}
export function validateText(entry:any,text:unknown):text is string{
 if(typeof text!=='string'||!text.trim()||text.length>2000||/[&=.<>{}\r\n\u0000-\u001f]/.test(text.replace(/\{ערך_\d+\}/g,'')))return false;
 const vars=[...text.matchAll(/\{(ערך_\d+)\}/g)].map(m=>m[1]).sort();
 return JSON.stringify(vars)===JSON.stringify([...entry.variables].sort());
}
export function render(body:string,source:string,rows:any[],seen:Candidate[]):string{
 const byId=new Map(catalog.filter(e=>e.source===source).map(e=>[e.id,e]));const overrides=new Map<string,string>();
 for(const row of rows){const e=byId.get(row.message_id);if(e&&validateText(e,row.text))overrides.set(row.message_id,row.text);}
 const candidates=[...[...constants.values()].filter(e=>byId.has(e.id)),...seen];
 const replacements=new Map<string,string>();
 for(const c of candidates){const template=overrides.get(c.id);if(!template||!c.original)continue;const replacement=template.replace(/\{ערך_(\d+)\}/g,(_,n)=>c.values[Number(n)-1]??'');if(replacement!==c.original)replacements.set(c.original,replacement);}
 const ordered=[...replacements].sort((a,b)=>b[0].length-a[0].length);
 // One pass, longest match first. Never edit command names, input keys or key mappings.
 const replace=(speech:string)=>{let result='';for(let i=0;i<speech.length;){const pair=ordered.find(([from])=>speech.startsWith(from,i)&&(i===0||/\s/.test(speech[i-1]))&&(i+from.length===speech.length||/\s/.test(speech[i+from.length])||/\s$/.test(from)));if(pair){result+=pair[1];i+=pair[0].length;}else result+=speech[i++];}return result;};
 return body.replace(/((?:^|&)(?:read|id_list_message)=)([^&]*)/g,(_,prefix,payload)=>{
 const at=payload.indexOf('=');const spoken=at<0?payload:payload.slice(0,at),suffix=at<0?'':payload.slice(at);
 return prefix+spoken.split('.').map((part:string)=>part.startsWith('t-')?'t-'+replace(part.slice(2)):part).join('.')+suffix;
 });
}
export function withVoice(handler:(req:Request)=>Promise<Response>,source:string){return async(req:Request)=>context.run([],async()=>{
 const seen=context.getStore()!;const response=await handler(req);if(!response.headers.get('content-type')?.includes('text/plain'))return response;
 try{const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';const url=(Deno.env.get('SUPABASE_URL')||'')+'/rest/v1/vendpay_voice_overrides?select=message_id,text&source=eq.'+encodeURIComponent(source);const r=await fetch(url,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(1500)});if(!r.ok)return response;const rows=await r.json();if(!Array.isArray(rows)||!rows.length)return response;const body=await response.clone().text();if(body.length>32000)return response;const updated=render(body,source,rows,seen);if(updated===body)return response;const headers=new Headers(response.headers);headers.delete('Content-Length');headers.delete('ETag');headers.set('Cache-Control','no-store');return new Response(updated,{status:response.status,headers});}catch{return response;}
 });}

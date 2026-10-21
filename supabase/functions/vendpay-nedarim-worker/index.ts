import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {makeHandler} from './edit-handler.ts';
import {handler as openDoor,routingKey} from './door.ts';
import {nextHebrewMonthStart} from './calendar.ts';
import {listData,payload} from './edit.ts';
import {transactionId,classify} from './policy.ts';
const MOSAD='7014693', BASE='https://vendpay24.com/VendPayDeltaHeb';
const env=(k:string)=>Deno.env.get(k)||'';
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
function checked<T extends {error:any,data:any}>(result:T):T['data']{if(result.error)throw Error('database_error');return result.data;}
async function decrypt(c:any,aad?:string){
 const secret=env('VENDPAY_TENANT_ENCRYPTION_KEY');if(!secret)throw Error('configuration');
 const bytes=/^[0-9a-f]{64}$/i.test(secret)?Uint8Array.from(secret.match(/../g)!,h=>parseInt(h,16)):new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
 const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['decrypt']);
 const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(c.iv),...(aad?{additionalData:new TextEncoder().encode(aad)}:{})},key,decode(c.ciphertext)));
}
async function history(db:any,cursor:number){
 const c=checked(await db.from('vendpay_nedarim_connections').select('ciphertext,iv').eq('mosad',MOSAD).single());
 const password=await decrypt(c,'vendpay-nedarim:'+MOSAD);
 const p=new URLSearchParams({Action:'GetHistoryJson',MosadId:MOSAD,ApiPassword:password,MaxId:'1000',LastId:String(cursor)});
 const r=await fetch('https://matara.pro/nedarimplus/Reports/Manage3.aspx?'+p,{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('provider_http');const b=await r.json(),rows=Array.isArray(b)?b:b?.Data||b?.data;
 if(!Array.isArray(rows))throw Error('provider_shape');
 const ids=rows.map(transactionId);if(new Set(ids).size!==ids.length)throw Error('duplicate_provider_ids');
 return rows.filter(r=>transactionId(r)>cursor).sort((a,b)=>transactionId(a)-transactionId(b));
}
async function tenantAuth(db:any,tenant:string){
 const t=checked(await db.from('vendpay_tenants').select('id,is_active').eq('id',tenant).single());
 if(!t.is_active)throw Error('tenant_disabled');
 const c=checked(await db.from('vendpay_tenant_credentials').select('ciphertext,iv').eq('tenant_id',tenant).single());
 const a=JSON.parse(await decrypt(c));
 const r=await fetch(BASE+'/authenticate?lang=heb&apiloc=VendPayDeltaHeb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:a.username,password:a.password,code:a.code,rememberMe:a.rememberMe??false,role:a.role??''}),redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('tenant_auth_failed');const b=await r.json();if(typeof b.token!=='string'||b.token.length<20||/\s/.test(b.token))throw Error('tenant_auth_failed');return b.token;
}
async function members(token:string){
 const r=await fetch(BASE+'/user?lang=heb&apiloc=VendPayDeltaHeb',{headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error('member_read_failed');return listData(await r.json());
}
const form=(p:Record<string,string>)=>new Request('https://internal.invalid/worker',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(p)});
async function execute(db:any,event:any){
 const {tenant_id:tenant,card_number:card,transaction_id:id,action}=event;
 const token=await tenantAuth(db,tenant),users=await members(token),found=users.filter(u=>String(u.card_number)===card);
 if(found.length!==1)return 'review_member';
 let renewal='not_requested';
 const call='nedarim-'+MOSAD+'-'+id,did='0733182541';
 if(action==='renew'||action==='both'){
  payload(found[0]);
  if(String(found[0].date_end||'').slice(0,10)>=event.target_date)renewal='already_valid';
  else{
   const handler=makeHandler({tenant,active:true,groups:{},authenticatedCheck:async()=>({token,response:Response.json({ok:true})})});
   const result=await handler(form({ApiDID:did,ApiCallId:call,lookup_card:card,edit_mode:'1',expiry_0:event.target_date.slice(8,10)+event.target_date.slice(5,7)+event.target_date.slice(0,4),edit_save:'1'}));
   renewal=result.headers.get('X-Edit-Result')||'unknown';await result.body?.cancel();
   if(!['confirmed','already_valid','cancelled'].includes(renewal))return 'review_renew_'+renewal;
  }
 }
 if(action==='open'||action==='both'){
  const response=await openDoor(form({tenant_id:tenant,tenant_key:await routingKey(tenant),action:'open',ApiDID:did,ApiCallId:call}));
  await response.body?.cancel();
  const op=checked(await db.from('vendpay_tenant_door_operations').select('status').eq('tenant_id',tenant).eq('call_hash',await hash(did+'|'+call)).maybeSingle());
  if(op?.status!=='sent')return action==='both'?'review_door_after_renew':'review_door';
 }
 return renewal==='already_valid'&&action==='renew'?'already_valid':'completed';
}
Deno.serve(async req=>{
 if(req.method!=='POST'||await hash(req.headers.get('x-worker-token')||'')!=='23e1f582b365ed01306845629a479f8847b95014492482948ec2446cc40afa9a')return new Response('Unauthorized',{status:401});
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 let lease:string|null=null;
 try{
  const input=await req.json().catch(()=>({})),mode=input.mode||'probe';
  if(!['probe','preflight','run'].includes(mode))throw Error('invalid_mode');
  const state=checked(await db.from('vendpay_nedarim_worker_state').select('*').eq('mosad',MOSAD).single());
  const config=checked(await db.from('vendpay_nedarim_rules').select('rules').eq('mosad',MOSAD).single()),rules=config.rules;
  if(!Array.isArray(rules))throw Error('invalid_rules');
  if(mode==='preflight'){
   const tenants=[...new Set(rules.map(r=>r.tenant_id))],checks=[];
   for(const tenant of tenants){const users=await members(await tenantAuth(db,String(tenant)));for(const u of users)payload(u);checks.push({tenant_id:tenant,readable:true,member_schema_valid:true});}
   return Response.json({mode,checks,target_date:nextHebrewMonthStart(new Date()),enabled:state.enabled});
  }
  let cursor=Number(state.last_id);
  if(mode==='probe'&&input.last_id!==undefined){if(!/^\d{1,15}$/.test(String(input.last_id)))throw Error('invalid_cursor');cursor=Number(input.last_id);}
  if(mode==='run'){
   if(!state.enabled)return Response.json({mode:'disabled'});
   lease=new Date(Date.now()+300000).toISOString();
   const acquired=checked(await db.from('vendpay_nedarim_worker_state').update({lease_until:lease}).eq('mosad',MOSAD).eq('enabled',true).or('lease_until.is.null,lease_until.lt.'+new Date().toISOString()).select('mosad'));
   if(!acquired.length){lease=null;return Response.json({mode:'busy'});}
  }
  const rows=await history(db,cursor);
  if(mode==='probe')return Response.json({mode:'read_only',enabled:state.enabled,count:rows.length,max_id:rows.length?transactionId(rows.at(-1)):cursor,matches:rules.map(rule=>({category:rule.category,count:rows.filter(r=>classify(r,[rule])).length}))});
  const started=Date.now();let processed=0,matched=0;
  for(const row of rows){
   if(Date.now()-started>55000||matched>=5)break;
   const id=transactionId(row),match=classify(row,rules);
   if(match){
    matched++;
    const event={mosad:MOSAD,transaction_id:id,tenant_id:match.rule.tenant_id,category:match.category,card_number:match.card,action:match.rule.action,status:match.status==='ready'?'processing':match.status,target_date:nextHebrewMonthStart(new Date())};
    const inserted=await db.from('vendpay_nedarim_events').insert(event);
    if(inserted.error&&inserted.error.code!=='23505')throw Error('event_write_failed');
    if(!inserted.error&&match.status==='ready'){
     let status;try{status=await execute(db,event);}catch{status='review_execution';}
     checked(await db.from('vendpay_nedarim_events').update({status,updated_at:new Date().toISOString()}).eq('mosad',MOSAD).eq('transaction_id',id));
    }
   }
   // A durable event claim exists before advancing, and unknown results are never retried.
   checked(await db.from('vendpay_nedarim_worker_state').update({last_id:id}).eq('mosad',MOSAD).eq('lease_until',lease));
   cursor=id;processed++;
  }
  checked(await db.from('vendpay_nedarim_worker_state').update({last_run_at:new Date().toISOString(),last_error:null}).eq('mosad',MOSAD).eq('lease_until',lease));
  return Response.json({mode:'run',processed,matched,last_id:cursor});
 }catch(e){
  const error=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'worker_failed';
  if(lease)await db.from('vendpay_nedarim_worker_state').update({last_error:error,last_run_at:new Date().toISOString()}).eq('mosad',MOSAD).eq('lease_until',lease);
  return Response.json({error},{status:502});
 }finally{if(lease)await db.from('vendpay_nedarim_worker_state').update({lease_until:null}).eq('mosad',MOSAD).eq('lease_until',lease);}
});

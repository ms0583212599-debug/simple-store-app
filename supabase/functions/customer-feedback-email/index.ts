import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:cors});
export async function handle(req:Request,env=(k:string)=>Deno.env.get(k),fetcher=fetch,client=createClient){
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply({error:'method'},405);
 try{
  const body=await req.json(),message=String(body.message||'').trim();
  if(message.length<2||message.length>1000)return reply({error:'invalid message'},400);
  const sb=client(env('SUPABASE_URL')!,env('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  let id=String(body.request_id||'');
  if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return reply({error:'invalid request'},400);
  // Older website clients inserted the message before calling this endpoint.
  if(!id){const {data}=await sb.from('customer_feedback').select('id').eq('message',message).gte('created_at',new Date(Date.now()-300000).toISOString()).order('created_at',{ascending:false}).limit(1);id=data?.[0]?.id||crypto.randomUUID();}
  const {data:existing,error:readError}=await sb.from('customer_feedback').select('id,message').eq('id',id).maybeSingle();
  if(readError)return reply({error:'storage unavailable'},503);
  if(existing&&existing.message!==message)return reply({error:'request conflict'},409);
  if(!existing){const {error}=await sb.from('customer_feedback').insert({id,message});if(error&&error.code!=='23505')return reply({error:'save failed'},503);}
  const {data:settings,error:settingError}=await sb.from('storefront_design_settings').select('feedback_email').eq('id',1).single();
  const email=String(settings?.feedback_email||'').trim(),key=env('RESEND_API_KEY');
  if(settingError||!email||!key)return reply({saved:true,email:false});
  const {data:claimed,error:claimError}=await sb.rpc('claim_feedback_email',{p_id:id});
  if(claimError)return reply({saved:true,email:false});
  if(!claimed)return reply({saved:true,email_pending:true});
  // Recipient comes only from admin settings, never from a public request.
  let sent=false;
  try{const r=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':'store-feedback-'+id},body:JSON.stringify({from:env('FEEDBACK_FROM_EMAIL')||'Store Feedback <onboarding@resend.dev>',to:[email],subject:'הערה חדשה מלקוח בחנות',text:message}),signal:AbortSignal.timeout(12000)});sent=r.ok;}catch{/* The saved message remains visible to the manager. */}
  await sb.from('feedback_email_dispatch').update(sent?{state:'sent',sent_at:new Date().toISOString()}:{state:'pending',claimed_at:null}).eq('feedback_id',id);
  return reply({saved:true,email:sent});
 }catch{return reply({error:'server error'},500);}
}
Deno.serve(req=>handle(req));

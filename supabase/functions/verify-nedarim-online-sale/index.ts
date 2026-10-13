import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import {matchedReceipt} from './match.mjs';
import {readHistory} from './history.mjs';
const H={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type,apikey,authorization'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:H});
 if(req.method!=='POST')return reply({error:'method'},405);
 try{
  const body=await req.json();
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:ps,error:pe}=await sb.from('payment_settings').select('mosad,groupe,api_password,show_customer_payment_page').eq('id',1).single();
  if(pe||!ps)return reply({error:'settings'},503);

  const token=String(body.saleToken||'');
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(token))return reply({error:'token'},400);
  const {data:sale,error:se}=await sb.from('sales').select('id,total_amount,status,inventory_applied').eq('external_token',token).maybeSingle();
  if(se||!sale)return reply({error:'sale'},404);
  if(sale.status==='paid')return reply({status:'paid'});
  if(sale.status!=='pending')return reply({error:'sale_not_pending'},409);
  if(!ps.api_password)return reply({error:'history_unavailable'},409);
  if(String(body.mosad)!==String(ps.mosad))return reply({error:'account_changed'},409);
  const history=await readHistory(ps,Number(body.baseline));
  const rows=history.rows;
  const matches=matchedReceipt(rows,token,Number(sale.total_amount),String(ps.groupe||''));
  if(matches.length!==1)return reply({status:'pending'});
  const reference=String(matches[0].TransactionId);
  const {data:used,error:ue}=await sb.from('sales').select('id').eq('payment_reference',reference).neq('id',sale.id).limit(1);
  if(ue||used?.length)return reply({error:'receipt_used'},409);
  const {error:fin}=await sb.rpc('finalize_nedarim_online_sale',{p_sale_id:sale.id,p_payment_reference:reference});
  if(fin)return reply({error:'finalize'},503);
  await sb.from('sales').update({nedarim_verified:true,nedarim_verified_at:new Date().toISOString(),nedarim_verification_source:'online_exact_order_marker'}).eq('id',sale.id);
  return reply({status:'paid'});
 }catch{return reply({error:'verification_unavailable'},503);}
});

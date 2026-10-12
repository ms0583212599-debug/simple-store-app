import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const H={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type,apikey,authorization'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:H});
// Read-only: no INSERT, UPDATE, DELETE, finalization RPC or payment API calls.
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:H});
 if(req.method!=='POST')return reply({error:'method'},405);
 try{
  const b=await req.json();
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:p,error}=await sb.from('payment_settings').select('mosad,api_password,show_customer_payment_page').eq('id',1).single();
  if(error||!p)return reply({error:'settings'},503);
  if(b.action==='ready')return reply({enabled:!!p.show_customer_payment_page,ready:!!p.api_password});
  return reply({error:'action'},400);
 }catch{return reply({error:'unavailable'},503);}
});

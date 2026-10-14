import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.110.0';
const headers={'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type,apikey,authorization'};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return new Response(JSON.stringify({error:'method'}),{status:405,headers});
 try{
  const body=await req.json();
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data,error}=await sb.rpc('create_sale',{p_items:body.items});
  if(error||!data?.[0])return new Response(JSON.stringify({error:'לא ניתן להכין עסקה. בדוק מחירים ומלאי ונסה שוב.'}),{status:400,headers});
  return new Response(JSON.stringify(data[0]),{headers});
 }catch{return new Response(JSON.stringify({error:'invalid checkout'}),{status:400,headers});}
});

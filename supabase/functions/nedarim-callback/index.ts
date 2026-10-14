import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const H={
  "content-type":"application/json; charset=utf-8",
  "access-control-allow-origin":"*",
  "access-control-allow-headers":"content-type,apikey,authorization"
};

function first(v:any,...keys:string[]){
  for(const k of keys){
    const x=v?.[k];
    if(x!==undefined&&x!==null&&String(x).trim()!=="") return x;
  }
  return "";
}

async function readPayload(req:Request){
  const url=new URL(req.url);
  const query=Object.fromEntries(url.searchParams.entries());
  if(req.method==='GET') return query;
  const ct=req.headers.get('content-type')||'';
  let body:any={};
  try{
    if(ct.includes('application/json')) body=await req.json();
    else if(ct.includes('form')) body=Object.fromEntries((await req.formData()).entries());
    else {
      const text=await req.text();
      try{body=JSON.parse(text)}catch{body=Object.fromEntries(new URLSearchParams(text).entries())}
    }
  }catch{body={};}
  return {...query,...(body||{})};
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:H});
  if(req.method!=='POST'&&req.method!=='GET') return new Response(JSON.stringify({ok:false,error:'method'}),{status:405,headers:H});
  try{
    const b:any=await readPayload(req);
    const status=String(first(b,'Status','status','Result','result')).trim().toUpperCase();
    if(status && !['OK','SUCCESS','TRUE','1','APPROVED'].includes(status)){
      return new Response(JSON.stringify({ok:true,ignored:true,status}),{headers:H});
    }

    const token=String(first(b,'Param1','param1','PARAM1','SaleToken','saleToken')).trim();
    const card4=String(b?.LastNum??'').trim();const cardFields=/^\d{4}$/.test(card4)?{card_last4:card4}:{};
    const paid=Number(first(b,'Amount','amount','Sum','sum','Total','total','PaymentAmount','paymentAmount'));
    const ref=String(first(b,'ID','Id','id','TransactionId','TransactionID','transactionId','Confirmation','confirmation','Asmachta','asmachta')).trim();

    if(!token || !Number.isFinite(paid) || paid<=0){
      console.log('nedarim-callback missing fields', {method:req.method, keys:Object.keys(b), token:!!token, paid});
      return new Response(JSON.stringify({ok:false,error:'missing'}),{status:400,headers:H});
    }

    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:s,error}=await sb.from('sales').select('id,total_amount,status,inventory_applied').eq('external_token',token).maybeSingle();
    if(error||!s) return new Response(JSON.stringify({ok:false,error:'sale'}),{status:404,headers:H});
    if(Math.abs(Number(s.total_amount)-paid)>.009) return new Response(JSON.stringify({ok:false,error:'amount'}),{status:409,headers:H});
    if(s.status==='paid'&&s.inventory_applied){ await sb.from('sales').update({...cardFields,nedarim_verified:true,nedarim_verified_at:new Date().toISOString(),nedarim_verification_source:'server_callback',...(ref?{payment_reference:ref}:{})}).eq('id',s.id); return new Response(JSON.stringify({ok:true,duplicate:true,verified:true}),{headers:H}); }

    const {error:fin}=await sb.rpc('finalize_paid_sale',{p_sale_id:s.id,p_payment_reference:ref||null});
    if(fin) return new Response(JSON.stringify({ok:false,error:'finalize',detail:fin.message}),{status:500,headers:H});
    await sb.from('sales').update({...cardFields,nedarim_verified:true,nedarim_verified_at:new Date().toISOString(),nedarim_verification_source:'server_callback'}).eq('id',s.id);
    return new Response(JSON.stringify({ok:true,status:'paid',verified:true}),{headers:H});
  }catch(e:any){
    console.error('nedarim-callback error',e);
    return new Response(JSON.stringify({ok:false,error:String(e?.message||e)}),{status:500,headers:H});
  }
});

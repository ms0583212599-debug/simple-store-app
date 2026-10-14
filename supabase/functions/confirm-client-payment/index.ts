import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const H={"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-headers":"content-type,apikey,authorization"};
const okStatuses=new Set(["OK","SUCCESS","TRUE","1","APPROVED","PAID"]);
function pick(o:any,...keys:string[]){for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&String(v).trim()!=="")return v;}return "";}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:H});
  if(req.method!=='POST')return new Response(JSON.stringify({ok:false,error:'method'}),{status:405,headers:H});
  try{
    const body=await req.json();
    const token=String(body?.saleToken||'').trim();
    const r=body?.response&&typeof body.response==='object'?body.response:{};
    if(!token)return new Response(JSON.stringify({ok:false,error:'saleToken'}),{status:400,headers:H});

    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:sale,error:se}=await sb.from('sales').select('id,total_amount,status,inventory_applied').eq('external_token',token).maybeSingle();
    if(se||!sale)return new Response(JSON.stringify({ok:false,error:'sale'}),{status:404,headers:H});
    if(sale.status==='paid'&&sale.inventory_applied)return new Response(JSON.stringify({ok:true,status:'paid',duplicate:true}),{headers:H});

    const status=String(pick(r,'Status','status','Result','result','State','state')).trim().toUpperCase();
    const amountRaw=pick(r,'Amount','amount','Sum','sum','Total','total','PaymentAmount','paymentAmount');
    const amount=Number(amountRaw);
    const ref=String(pick(r,'ID','Id','id','TransactionId','TransactionID','transactionId','Confirmation','confirmation','Asmachta','asmachta')).trim();
    const fieldNames=Object.keys(r).slice(0,80);
    const statusOk=okStatuses.has(status);
    const amountOk=Number.isFinite(amount)&&amount>0&&Math.abs(amount-Number(sale.total_amount))<0.009;
    const refOk=ref.length>0;
    let accepted=false,reason='';

    if(!statusOk)reason='status';
    else if(!amountOk)reason='amount';
    else if(!refOk)reason='reference';
    else {
      const {data:used}=await sb.from('sales').select('id').eq('payment_reference',ref).neq('id',sale.id).limit(1);
      if(used?.length)reason='reference_used';
      else accepted=true;
    }

    await sb.from('payment_client_events').insert({sale_id:sale.id,reported_status:status||null,reported_amount:Number.isFinite(amount)?amount:null,transaction_reference:ref||null,field_names:fieldNames,accepted,reason:accepted?'accepted':reason});

    if(!accepted)return new Response(JSON.stringify({ok:true,status:'pending',accepted:false,reason}),{headers:H});
    const {error:fin}=await sb.rpc('finalize_paid_sale',{p_sale_id:sale.id,p_payment_reference:ref});
    if(fin)return new Response(JSON.stringify({ok:false,error:'finalize',detail:fin.message}),{status:500,headers:H});
const last4=String(r?.LastNum??'').trim();if(/^\d{4}$/.test(last4))await sb.from('sales').update({card_last4:last4}).eq('id',sale.id);
    return new Response(JSON.stringify({ok:true,status:'paid',accepted:true}),{headers:H});
  }catch(e:any){return new Response(JSON.stringify({ok:false,error:String(e?.message||e)}),{status:400,headers:H});}
});

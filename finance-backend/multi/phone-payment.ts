import {db,rpc,digest,normalizePhone}from './shared.ts';
import {checkoutStatus}from './nedarim-billing.ts';
import {paymentPath}from './phone-payment-provider.ts';
const response=s=>new Response(s,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
export async function handler(req){
 try{
  if(req.method!=='POST')return response('');const raw=await req.text();if(raw.length>64000)return response('');
  const p=new URLSearchParams(raw);for(const k of new Set(p.keys()))if(p.getAll(k).length!==1)return response('');
  const cid=p.get('checkout'),token=p.get('payment_token');if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(cid||'')||! /^[a-f0-9]{64}$/.test(token||''))return response('');
  const c=(await db('billing_nedarim_checkouts?id=eq.'+cid))[0];if(!c||c.channel!=='phone')return response('');
  const ctx=c.phone_context,phone=normalizePhone(p.get('ApiPhone')),entry=await digest((p.get('ApiCallId')||'')+':'+phone+':'+ctx.extension),hash=await digest(token);
  if(ctx.phone!==phone||ctx.entry!==entry||ctx.token_hash!==hash||p.get('ApiExtension')!==paymentPath(cid))return response('');
  if(p.has('hangup'))return response('');
  const back='&go_to_folder='+ctx.extension;
  // A Yemot success code is only a UX signal. It never binds a mandate or unlocks access.
  if(p.has('CreditCard_CODE')||c.phone_issued_at||c.cancel_requested||c.state!=='ready'){
   await checkoutStatus(c.account_id,{checkout_id:c.id});
   return response('id_list_message=t-חוזרים לחשבון לבדיקת מצב המנוי'+back);
  }
  const claim=await rpc('billing_nedarim_phone_issue',{p_checkout:cid,p_entry:entry,p_token_hash:hash});
  if(!claim.issued)return response('id_list_message=t-בקשת התשלום כבר טופלה או פג תוקפה'+back);
  // Only Yemot collects the PAN/CVV. No card field is requested by this API.
  return response('credit_card='+['nedarim_plus',(claim.amount/100).toFixed(2),'','1','1','','',claim.mosad,'','','','','','','GoBack'].join(','));
 }catch{return response('id_list_message=t-לא ניתן להשלים כעת יש לחזור לחשבון ולבדוק את מצב המנוי');}
}
if(import.meta.main)Deno.serve(handler);

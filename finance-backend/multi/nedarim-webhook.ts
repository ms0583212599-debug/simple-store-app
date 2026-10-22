import {db,rpc}from './shared.ts';
import {provider}from './delivery-routes.ts';
import {matchesMandate}from './nedarim-billing.ts';
const reply=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function handler(req){
 if(req.method!=='POST')return reply({error:'method'},405);
 try{
  const raw=await req.text();if(raw.length>100000)return reply({error:'size'},413);
  const v=await provider('nedarim_verify',{raw,timestamp:req.headers.get('x-nedarim-timestamp'),signature:req.headers.get('x-nedarim-signature')});if(!v.valid)return reply({error:'unauthorized'},401);
  const b=JSON.parse(raw),cid=new URL(req.url).searchParams.get('checkout')||b.Param1||(typeof b.Groupe==='string'&&/^finance-[a-f0-9-]{36}$/.test(b.Groupe)?b.Groupe.slice(8):null);
  if(b.MosadNumber!==undefined&&String(b.MosadNumber)!==v.mosad)return reply({error:'institution'},400);
  if(b.Status==='Error')return reply({ok:true}); // A refusal never activates access.
  if(cid&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(cid)){
   const c=(await db('billing_nedarim_checkouts?id=eq.'+cid))[0];if(!c||c.mosad!==v.mosad)return reply({error:'unknown_checkout'},400);
   const keva=String(b.KevaId||b.ID||'');if(!/^\d{1,20}$/.test(keva))return reply({error:'mandate'},400);
   const d=await provider('nedarim_details',{keva_id:keva});
   if(!matchesMandate(c,d)||d.amount!==c.amount||(c.channel==='phone'&&!c.phone_issued_at))return reply({error:'mismatch'},400);
   await rpc('billing_nedarim_bind',{p_checkout:c.id,p_mosad:c.mosad,p_keva:keva});
   // Durable binding first. The recurring reconciliation worker verifies actual charges.
   return reply({ok:true});
  }
  // Institution-level payment notifications: lookup only already-bound mandates.
  if(/^\d{1,20}$/.test(String(b.KevaId||''))){const c=(await db('billing_nedarim_checkouts?mosad=eq.'+v.mosad+'&keva_id=eq.'+b.KevaId))[0];if(c)await db('billing_nedarim_checkouts?id=eq.'+c.id,{last_sync_at:null},'PATCH');}
  return reply({ok:true});
 }catch{return reply({error:'not_processed'},503);}
}
if(import.meta.main)Deno.serve(handler);

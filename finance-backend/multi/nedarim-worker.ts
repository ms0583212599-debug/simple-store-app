import {db}from './shared.ts';
import {syncCheckout}from './nedarim-billing.ts';
export async function handler(req){
 const answer=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json'}});
 if(req.method!=='POST')return answer({error:'method'},405);
 try{
  const raw=await req.text(),ts=req.headers.get('x-finance-time')||'',sig=req.headers.get('x-finance-signature')||'';
  if(raw.length>1000||!/^\d{13}$/.test(ts)||!/^\w{64}$/.test(sig)||Math.abs(Date.now()-Number(ts))>300000)return answer({error:'unauthorized'},401);
  const cfg=(await db('finance_integrations?select=bridge_secret&id=eq.true'))[0];
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(cfg.bridge_secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.match(/../g),x=>parseInt(x,16)),new TextEncoder().encode(ts+'.'+raw)))return answer({error:'unauthorized'},401);
  const rows=await db('billing_nedarim_checkouts?keva_id=not.is.null&state=neq.cancelled&order=last_sync_at.asc.nullsfirst&limit=15');let done=0,failed=0;
  for(const c of rows){try{await syncCheckout(c);done++;}catch{failed++;await db('billing_nedarim_checkouts?id=eq.'+c.id,{last_error:'sync_failed',last_sync_at:new Date().toISOString()},'PATCH');}}
  return answer({processed:done,failed});
 }catch{return answer({error:'worker_failed'},503);}
}
if(import.meta.main)Deno.serve(handler);

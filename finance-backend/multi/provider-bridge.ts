import {nedarim}from './nedarim-provider.ts';
import {effective,unseal,settings}from './provider-settings.ts';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(d,status=200)=>new Response(JSON.stringify(d),{status,headers});
async function db(path,body,method='POST'){const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/'+path,{method:body===undefined?'GET':method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('storage_error');return r.json();}
export async function handler(req){
 if(req.method!=='POST')return reply({error:'method'},405);
 try{const raw=await req.text();if(raw.length>1500000)return reply({error:'too_large'},413);
 const ts=req.headers.get('x-finance-time')||'',sig=req.headers.get('x-finance-signature')||'';if(Math.abs(Date.now()-Number(ts))>300000||!/^\d{13}$/.test(ts)||!/^\w{64}$/.test(sig))return reply({error:'unauthorized'},401);
 const conf=(await db('finance_provider_credentials?select=*&id=eq.true'))[0];if(!conf)return reply({error:'not_configured'},503);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(conf.secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 if(!await crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.match(/../g),s=>parseInt(s,16)),new TextEncoder().encode(ts+'.'+raw)))return reply({error:'unauthorized'},401);
 const b=JSON.parse(raw);
 if(['settings_get','settings_save','settings_check'].includes(b.action)){const d=await settings(b,conf,db);return reply(d,d.error?400:200);}
 const config=effective(await unseal(conf.settings_ciphertext));
 if(b.action.startsWith('nedarim_'))return reply(await nedarim(config,b));
 const from=config.from_email,mail=config.mail_enabled&&!!config.resend_key&&!!from&&!from.includes('resend.dev'),voice=config.voice_enabled&&!!config.yemot_token;
 if(b.action==='status')return reply({mail_ready:mail,voice_ready:voice,billing_ready:false});
 if(!['mail','voice'].includes(b.action)||!/^[-a-zA-Z0-9:]{16,150}$/.test(b.id||''))return reply({error:'invalid'},400);
 if(b.action==='mail'&&!mail||b.action==='voice'&&!voice)return reply({error:'provider_not_configured'},503);
 const claim=await db('rpc/finance_delivery_claim',{p_id:b.id,p_kind:b.action});if(!claim.claimed)return reply({ok:claim.status==='sent',status:claim.status},claim.status==='sent'?200:409);
 let ok=false,reference='',uncertain=false;
 try{
 if(b.action==='mail'){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.to||''))throw Error('invalid_recipient');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.resend_key,'Content-Type':'application/json','Idempotency-Key':b.id},body:JSON.stringify({from,to:[b.to],subject:String(b.subject||'ניהול כלכלה').slice(0,150),html:b.html,text:b.text}),signal:AbortSignal.timeout(15000)});const d=await r.json();ok=r.ok;reference=ok?d.id:'';
 }else{
  if(!/^0[2-9]\d{7,8}$/.test(b.to||'')||!/^\d{6}$/.test(b.code||''))throw Error('invalid_recipient');
  const r=await fetch('https://www.call2all.co.il/ym/api/SendTTS',{method:'POST',body:new URLSearchParams({token:config.yemot_token,phones:b.to,ttsMessage:'קוד האימות לניהול כלכלה הוא '+b.code.split('').join(' ')+' שוב '+b.code.split('').join(' '),repeatFile:'1'}),signal:AbortSignal.timeout(15000)});const d=await r.json();ok=r.ok&&d.responseStatus==='OK';reference=String(d.campaignId||'');
 }
 }catch{uncertain=true;}
 await db('finance_provider_deliveries?id=eq.'+encodeURIComponent(b.id),{status:ok?'sent':uncertain?'unknown':'failed',provider_reference:reference},'PATCH');
 return reply({ok,status:ok?'sent':uncertain?'unknown':'failed',reference},ok?200:502);
 }catch{return reply({error:'provider_error'},502);}
}
if(import.meta.main)Deno.serve(handler);

// Approved delivery integration; readiness is checked before every send.
import {db,rpc,auth,profile,digest,normalizePhone}from './shared.ts';
import {reportHTML}from './report.ts';
export function code(){const a=new Uint32Array(1);crypto.getRandomValues(a);return String(a[0]%1000000).padStart(6,'0');}
export async function provider(action,data={}){
 const cfg=(await db('finance_integrations?select=*&id=eq.true'))[0];if(!cfg)throw Error('חיבור השליחה אינו מוגדר');
 if(action==='mail'&&!cfg.mail_enabled||action==='voice'&&!cfg.voice_enabled)throw Error('חיבור השליחה אינו פעיל');
 const raw=JSON.stringify({action,...data}),time=String(Date.now()),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(cfg.bridge_secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sign=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(time+'.'+raw))),b=>b.toString(16).padStart(2,'0')).join('');
 const r=await fetch(cfg.bridge_url,{method:'POST',headers:{'Content-Type':'application/json','x-finance-time':time,'x-finance-signature':sign},body:raw,signal:AbortSignal.timeout(25000)}),d=await r.json();if(!r.ok||d.error)throw Error('השליחה לא אושרה יש לבדוק את מצב החיבור');return d;
}
export async function beginPhone(b,account=null){
 const phone=normalizePhone(b.phone),otp=code(),status=await provider('status');if(!status.voice_ready)throw Error('אימות קולי אינו מחובר');
 const d=await auth('challenge',{phone,code:otp,purpose:account?'link':b.purpose==='reset'?'reset':'register',...(account?{account_id:account}:{})});
 const delivery=await provider('voice',{id:'finance-otp-'+d.challenge_id,to:phone,code:otp});if(!delivery.ok)throw Error('שליחת קוד האימות לא אושרה');return d;
}
export async function finishPhone(b,account=null){const rows=await db('finance_challenges?select=purpose,account_id&id=eq.'+encodeURIComponent(b.challenge_id||''));const c=rows[0];if(!c||(account?(c.purpose!=='link'||c.account_id!==account):c.purpose==='link'))throw Error('בקשת אימות אינה מתאימה לחשבון');return auth('verify',{phone:normalizePhone(b.phone),challenge_id:b.challenge_id,code:b.code,pin:b.pin,name:b.name||'',channel:b.channel||'web'});}
export async function beginEmail(account,email){
 const otp=code(),status=await provider('status');if(!status.mail_ready)throw Error('שליחת מייל אינה מחוברת');
 const d=await profile(account,'email_start',{email,code:otp});
 const sent=await provider('mail',{id:'finance-mail-verify-'+d.challenge_id,to:d.email,subject:'אימות כתובת מייל — ניהול כלכלה',text:'קוד האימות שלך הוא '+otp+' והוא תקף למשך 15 דקות'});if(!sent.ok)throw Error('שליחת המייל לא אושרה');return {challenge_id:d.challenge_id};
}
export const finishEmail=(account,b)=>profile(account,'email_verify',{challenge_id:b.challenge_id,code:b.code});
export async function emailReport(account,filters,requestId){
 const status=await provider('status');if(!status.mail_ready)throw Error('שליחת מייל אינה מחוברת');
 const p=await profile(account);if(!p.email_verified)throw Error('יש לאמת את כתובת המייל תחילה');
 const html=await reportHTML(account,filters);
 const job=await rpc('finance_mail_request',{p_account:account,p_request:requestId,p_filters:filters});if(job.status==='sent')return {ok:true,status:'sent'};
 const d=await provider('mail',{id:'finance-report-'+job.id,to:job.recipient,subject:'פירוט הכנסות והוצאות — ניהול כלכלה',html});
 if(d.ok)await db('finance_mail_jobs?id=eq.'+job.id+'&account_id=eq.'+account,{status:'sent',provider_reference:d.reference,sent_at:new Date().toISOString()},'PATCH');
 return {ok:d.ok,status:d.status};
}

let cachedCapabilities=null,capabilitiesUntil=0;
export async function capabilities(){if(cachedCapabilities&&Date.now()<capabilitiesUntil)return cachedCapabilities;let s={};try{s=await provider('status');}catch{}cachedCapabilities={accounts:true,phone_verification:s.voice_ready===true,email_delivery:s.mail_ready===true,billing:false};capabilitiesUntil=Date.now()+30000;return cachedCapabilities;}

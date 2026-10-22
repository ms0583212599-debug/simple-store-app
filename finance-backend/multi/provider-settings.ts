const OWNER='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
const enc=new TextEncoder(),dec=new TextDecoder();
async function encryptionKey(){const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!secret)throw Error('configuration');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',enc.encode('finance-provider-settings-v1:'+secret)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function seal(data){const iv=crypto.getRandomValues(new Uint8Array(12)),encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),enc.encode(JSON.stringify(data)));return JSON.stringify({v:1,iv:Array.from(iv),data:Array.from(new Uint8Array(encrypted))});}
export async function unseal(value){if(!value)return {};const b=JSON.parse(value);if(b.v!==1)throw Error('configuration');return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(b.iv)},await encryptionKey(),new Uint8Array(b.data))));}
export function effective(stored){return {...stored,yemot_token:stored.yemot_token??Deno.env.get('YEMOT_TOKEN')??'',resend_key:stored.resend_key??Deno.env.get('RESEND_API_KEY')??'',from_email:stored.from_email??Deno.env.get('FINANCE_FROM_EMAIL')??Deno.env.get('FEEDBACK_FROM_EMAIL')??'',voice_enabled:stored.voice_enabled!==false,mail_enabled:stored.mail_enabled!==false};}
export const visible=(c,revision)=>({revision,nedarim_mosad:c.nedarim_mosad||'',nedarim_group:c.nedarim_group||'',nedarim_api_valid_configured:!!c.nedarim_api_valid,nedarim_api_password_configured:!!c.nedarim_api_password,nedarim_billing_ready:false,yemot_configured:!!c.yemot_token,resend_configured:!!c.resend_key,from_email:c.from_email,voice_enabled:c.voice_enabled,mail_enabled:c.mail_enabled});
export async function settings(b,conf,db){
 // Independently validate the existing administrator session, in addition to bridge HMAC.
 if(!b.owner_token)return {error:'unauthorized'};
 const r=await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),Authorization:'Bearer '+b.owner_token},signal:AbortSignal.timeout(8000)});
 if(!r.ok)return {error:'unauthorized'};const u=await r.json();if(u.id!==OWNER||u.is_anonymous)return {error:'unauthorized'};
 const stored=await unseal(conf.settings_ciphertext),c=effective(stored);
 if(b.action==='settings_get')return visible(c,conf.revision||0);
 if(b.action==='settings_save'){
  const d=b.data||{},next={...stored};if(d.revision!==(conf.revision||0))return {error:'ההגדרות השתנו יש לרענן ולנסות שוב'};
  for(const field of ['yemot_token','resend_key','nedarim_api_valid','nedarim_api_password']){if(d[field]!==undefined&&typeof d[field]!=='string')return {error:'ערך לא תקין'};const value=d[field]?.trim();if(value){if(value.length>2048||/[\r\n]/.test(value))return {error:'מפתח לא תקין'};next[field]=value;}}
  if(typeof d.from_email!=='string'||d.from_email.length>254||/[\r\n]/.test(d.from_email))return {error:'כתובת שולח לא תקינה'};
  const from=d.from_email.trim();if(from&&!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from))return {error:'יש להזין כתובת מייל בלבד'};
  if(from.endsWith('@resend.dev'))return {error:'נדרשת כתובת בדומיין שאומת בחשבון Resend'};
  next.from_email=from;
  if(d.nedarim_mosad!==undefined){if(typeof d.nedarim_mosad!=='string'||(d.nedarim_mosad&&!/^[0-9]{7}$/.test(d.nedarim_mosad)))return {error:'מספר מוסד נדרים צריך לכלול שבע ספרות'};next.nedarim_mosad=d.nedarim_mosad;}
  if(d.nedarim_group!==undefined){if(typeof d.nedarim_group!=='string'||d.nedarim_group.length>100)return {error:'קטגוריה לא תקינה'};next.nedarim_group=d.nedarim_group.trim();}
  for(const field of ['voice_enabled','mail_enabled']){if(typeof d[field]!=='boolean')return {error:'הגדרה לא תקינה'};next[field]=d[field];}
  const rows=await db('finance_provider_credentials?id=eq.true&revision=eq.'+(conf.revision||0),{settings_ciphertext:await seal(next),revision:(conf.revision||0)+1,updated_at:new Date().toISOString()},'PATCH');
  if(!rows.length)return {error:'ההגדרות השתנו יש לרענן ולנסות שוב'};
  return {...visible(effective(next),(conf.revision||0)+1),saved:true};
 }
 if(b.action==='settings_check'){
  const result={voice:'לא הוגדר טוקן',mail:'לא הוגדר מפתח או כתובת שולח'};
  if(c.yemot_token){try{const r=await fetch('https://www.call2all.co.il/ym/api/GetSession',{method:'POST',body:new URLSearchParams({token:c.yemot_token}),signal:AbortSignal.timeout(7000)}),d=await r.json();result.voice=r.ok&&d.responseStatus==='OK'?'ההתחברות לימות תקינה — לא בוצעה שיחה':'ימות לא אישרו התחברות — בדקו טוקן והרשאות';}catch{result.voice='בדיקת ימות לא הושלמה';}}
  if(c.resend_key&&c.from_email){try{const r=await fetch('https://api.resend.com/domains',{headers:{Authorization:'Bearer '+c.resend_key},signal:AbortSignal.timeout(7000)}),d=await r.json();if(r.ok){const domain=c.from_email.split('@')[1]?.toLowerCase();result.mail=d.data?.some(x=>x.name.toLowerCase()===domain&&x.status==='verified')?'דומיין השליחה מאומת — לא נשלח מייל':'דומיין השולח לא נמצא כמאומת';}else result.mail=r.status===403?'לא ניתן לבדוק דומיינים עם הרשאות המפתח הזה; מפתח לשליחה בלבד עשוי להיות תקין. נדרשת בדיקת שליחה.':'Resend לא אישרו את המפתח';}catch{result.mail='בדיקת Resend לא הושלמה';}}
  return result;
 }
 return {error:'invalid_action'};
}

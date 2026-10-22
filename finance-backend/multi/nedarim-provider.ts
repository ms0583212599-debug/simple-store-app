import {preparePhonePayment}from './phone-payment-provider.ts';
// NedarimPlus API export supplied by the owner, sections 93, 95, 12, 64, 199.
export const CALLBACK='https://icldwmvkbeanyypkpeia.supabase.co/functions/v1/finance-nedarim-webhook';
const REPORTS='https://matara.pro/nedarimplus/Reports/Manage3.aspx';
const CREATE='https://matara.pro/nedarimplus/V6/Files/WebServices/DebitIframe.aspx?Action=CreateTransaction';
const enc=new TextEncoder();
export const configured=c=>/^\d{7}$/.test(c.nedarim_mosad||'')&&!!c.nedarim_api_valid&&!!c.nedarim_api_password&&/^whsec_[a-f0-9]{64}$/.test(c.nedarim_webhook_secret||'');
function clean(s,max=100){return String(s||'').replace(/[<>]/g,' ').replace(/&#/g,' ').slice(0,max);}
function id(s){if(!/^\d{1,20}$/.test(String(s||'')))throw Error('invalid_provider_id');return String(s);}
export function agorot(v){const s=String(v??'').trim();if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('invalid_amount');const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>100000000)throw Error('invalid_amount');return n;}
async function call(c,action,params={}){
 if(!/^\d{7}$/.test(c.nedarim_mosad||'')||!c.nedarim_api_password)throw Error('not_configured');
 const q=new URLSearchParams({Action:action,MosadId:c.nedarim_mosad,ApiPassword:c.nedarim_api_password,...params});
 const r=await fetch(REPORTS+'?'+q,{redirect:'error',signal:AbortSignal.timeout(10000)});const raw=await r.text();if(!r.ok)throw Error('provider_unavailable');
 let d;try{d=JSON.parse(raw);}catch{if(raw.trim()==='OK')return {ok:true};throw Error('provider_rejected');}
 if(d.Result==='Error'||d.Status==='Error')throw Error('provider_rejected');return d;
}
export async function verifyWebhook(raw,ts,sig,secret,now=Date.now()){
 if(typeof raw!=='string'||raw.length>100000||!/^\d{10}$/.test(ts||'')||!/^v1=[a-f0-9]{64}$/.test(sig||'')||!/^whsec_[a-f0-9]{64}$/.test(secret||'')||Math.abs(now/1000-Number(ts))>300)return false;
 const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 return crypto.subtle.verify('HMAC',key,Uint8Array.from(sig.slice(3).match(/../g),x=>parseInt(x,16)),enc.encode(ts+'.'+raw));
}
export async function nedarim(c,b){
 if(b.action==='nedarim_verify')return {valid:await verifyWebhook(b.raw,b.timestamp,b.signature,c.nedarim_webhook_secret),mosad:c.nedarim_mosad};
 if(!configured(c))throw Error('not_configured');
 if(b.action==='nedarim_phone_prepare')return preparePhonePayment(c,b);
 if(b.action==='nedarim_phone_setup'){
  const w=await call(c,'GetWebhook');
  if(w.CallBackKevaUrl&&w.CallBackKevaUrl!==CALLBACK)throw Error('existing_webhook');
  if(!w.CallBackKevaUrl)await call(c,'SetWebhook',{Type:'Keva',Url:CALLBACK});
  return nedarim(c,{action:'nedarim_check'});
 }
 if(b.action==='nedarim_check'){
  const w=await call(c,'GetWebhook');
  const form=new URLSearchParams({Mosad:c.nedarim_mosad,ApiValid:c.nedarim_api_valid,Amount:'0',Tashlumim:'1'});
  const r=await fetch(CREATE,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(10000)}),d=await r.json();
  return {ready:r.ok&&d.Status==='Error'&&String(d.Message).includes('סכום לא תקין')&&String(w.SignatureEnabled)==='1'&&w.SecretHint===c.nedarim_webhook_secret.slice(-4),mosad:c.nedarim_mosad,callback:CALLBACK,phone_ready:!!c.voice_enabled&&!!c.yemot_token&&w.CallBackKevaUrl===CALLBACK};
 }
 if(b.action==='nedarim_create'){
  if(!Number.isSafeInteger(b.amount)||b.amount<=0||b.amount>100000000||!/^[-a-f0-9]{36}$/.test(b.checkout_id))throw Error('invalid_checkout');
  const form=new URLSearchParams({Mosad:c.nedarim_mosad,ApiValid:c.nedarim_api_valid,PaymentType:'HK',Currency:'1',Amount:(b.amount/100).toFixed(2),Tashlumim:'',FirstName:clean(b.name,50),Phone:clean(b.phone,20),Groupe:clean(c.nedarim_group),Comment:'subscription '+b.checkout_id,Param1:b.checkout_id,CallBack:CALLBACK+'?checkout='+b.checkout_id,AjaxId:b.checkout_id});
  const r=await fetch(CREATE,{method:'POST',body:form,redirect:'error',signal:AbortSignal.timeout(12000)}),d=await r.json();
  if(!r.ok||d.Status!=='OK'||!d.Key)throw Error('create_not_confirmed');
  return {transaction_id:id(d.ID),key:String(d.Key),mosad:c.nedarim_mosad};
 }
 if(b.action==='nedarim_details'){
  const d=await call(c,'GetKevaId',{KevaId:id(b.keva_id)});
  if(String(d.KevaId)!==String(b.keva_id))throw Error('invalid_mandate');
  return {mosad:c.nedarim_mosad,keva_id:String(d.KevaId),status:String(d.KevaStatus),amount:agorot(d.KevaAmount),currency:String(d.KevaCurrency),note:d.KevaAvour||'',group:d.KevaGroupe||'',frequency:String(d.KevaFrequency||''),phone:d.KevaPhone||'',next_date:d.KevaNextDate||'',history:(Array.isArray(d.HistoryData)?d.HistoryData:[]).filter(x=>String(x.ID)==='1').map(x=>({transaction_id:id(x.TransactionId),amount:agorot(String(x.Amount).replace(/❗/g,'').trim()),date:String(x.Date)}))};
 }
 if(b.action==='nedarim_cancel'){
  const k=id(b.keva_id),before=await call(c,'GetKevaId',{KevaId:k});
  if(String(before.KevaId)!==k)throw Error('invalid_mandate');
  if(!['2','3'].includes(String(before.KevaStatus))){const result=await call(c,'DisableKeva',{KevaId:k});if(!result.ok)throw Error('cancel_not_confirmed');}
  const after=await call(c,'GetKevaId',{KevaId:k});return {cancelled:String(after.KevaId)===k&&['2','3'].includes(String(after.KevaStatus))};
 }
 throw Error('invalid_action');
}

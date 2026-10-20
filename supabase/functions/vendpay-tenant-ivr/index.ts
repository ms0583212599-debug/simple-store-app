import {withVoice} from './voice.ts';
import {voice} from './voice.ts';
import {withAudit} from './audit.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
const BASE='https://vendpay24.com/VendPayDeltaHeb';
const env=(k:string)=>Deno.env.get(k)||'';
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
export async function routingKey(tenant:string){const secret=env('VENDPAY_TENANT_ENCRYPTION_KEY');if(secret.length!==64)throw Error('configuration');const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('vendpay-ivr-v1:'+tenant))),b=>b.toString(16).padStart(2,'0')).join('');}
function one(p:URLSearchParams,k:string){const v=p.getAll(k);if(v.length>1)throw Error('duplicate');return v[0]||'';}
export async function handler(req:Request){
 const reply=(message:string,status=200)=>new Response('id_list_message=t-'+message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 try{
 if(req.method!=='POST')return reply(voice('v_ce9fb245ab999bd91395',["נדרשת בקשת פוסט"]),405);
 if(!(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return reply(voice('v_0d29fe35a3bfcd4b96f9',["בקשה לא תקינה"]),415);
 const raw=await req.text();if(raw.length>16000)return reply(voice('v_2fa7a675beb79453ba05',["בקשה ארוכה מדי"]),413);
 const p=new URLSearchParams(raw),tenant=one(p,'tenant_id'),key=one(p,'tenant_key'),action=one(p,'action');
 if(!/^[0-9a-f-]{36}$/i.test(tenant)||!key||key.length>128||await hash(key)!==await hash(await routingKey(tenant)))return reply(voice('v_81d1a58bdd75539fa867',["אין הרשאה"]),401);
 if(p.getAll('hangup').includes('yes'))return reply(voice('v_173708068595962ee8c9',["השיחה הסתיימה"]));
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 const {data:t,error:te}=await db.from('vendpay_tenants').select('id,is_active,terminal_id,gate_status').eq('id',tenant).maybeSingle();
 if(te||!t||!t.is_active)return reply(voice('v_ca848da8cc2127617407',["שלוחת הלקוח אינה פעילה"]));
 if(action==='health')return reply(voice('v_5b3c8252ae41e79ee4d3',["חיבור שלוחת הלקוח תקין"]));
 if(!['open','check'].includes(action))return reply(voice('v_4f1289c3860cb0cd9d2c',["פעולה לא נתמכת"]));
 const call=one(p,'ApiCallId'),did=one(p,'ApiDID');
 if(action==='open'&&(!call||call.length>200||!did||did.length>30))return reply(voice('v_41418e3981d22f2d501d',["חסרים פרטי שיחה"]));
 const callHash=await hash(did+'|'+call);
 if(action==='open'){
 if(!Number.isSafeInteger(t.terminal_id)||t.terminal_id<=0||!Number.isInteger(t.gate_status))return reply(voice('v_1101a02c8a1dc5cd69ad',["מסוף הלקוח טרם הוגדר"]));
 const {data:old,error}=await db.from('vendpay_tenant_door_operations').select('status').eq('tenant_id',tenant).eq('call_hash',callHash).maybeSingle();
 if(error)throw Error('database');if(old)return reply(old.status==='sent'?voice('v_50aded69c606934a2e3c',["פקודת הפתיחה כבר נשלחה"]):voice('v_77411e8471282dc7ccaf',["הבקשה הקודמת בטיפול לא נשלחה שוב"]));
 }
 const {data:c,error:ce}=await db.from('vendpay_tenant_credentials').select('ciphertext,iv').eq('tenant_id',tenant).maybeSingle();if(ce||!c)throw Error('credentials');
 const secret=env('VENDPAY_TENANT_ENCRYPTION_KEY');const rawKey=/^[0-9a-f]{64}$/i.test(secret)?Uint8Array.from(secret.match(/../g)!,h=>parseInt(h,16)):new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
 const aes=await crypto.subtle.importKey('raw',rawKey,'AES-GCM',false,['decrypt']);const decode=(v:string)=>Uint8Array.from(atob(v),ch=>ch.charCodeAt(0));
 const credentials=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(c.iv)},aes,decode(c.ciphertext))));
 if(typeof credentials.username!=='string'||typeof credentials.password!=='string'||typeof credentials.code!=='string')return reply(voice('v_a155136bf3b5e0cb2b02',["יש לעדכן את פרטי התחברות הלקוח"]));
 const auth=await fetch(BASE+'/authenticate?lang=heb&apiloc=VendPayDeltaHeb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:credentials.username,password:credentials.password,code:credentials.code,rememberMe:credentials.rememberMe??false,role:credentials.role??''}),redirect:'manual',signal:AbortSignal.timeout(5000)});
 if(!auth.ok)return reply(voice('v_37058ca919733aa6ff91',["לא הצלחנו להתחבר לחשבון הלקוח"]));const data=await auth.json();if(typeof data.token!=='string'||data.token.length<20)return reply(voice('v_b10bfc2de6c231f3130c',["לא התקבל אישור התחברות"]));
 const headers={Authorization:'Bearer '+data.token,Accept:'application/json'};
 const valid=async(r:Response)=>{const body=await r.text();let d:any;try{d=JSON.parse(body)}catch{}return r.ok&&!/^\s*</.test(body)&&! /\b(unauthorized|forbidden|invalid token|token expired)\b/i.test(body)&&!(d&&(d.error||d.success===false||d.ok===false||d.status==='error'));};
 if(!await valid(await fetch(BASE+'/terminal/getOnline?lang=heb&apiloc=VendPayDeltaHeb',{headers,redirect:'manual',signal:AbortSignal.timeout(4000)})))return reply(voice('v_17f1f2d58f934a50fdbc',["בדיקת חשבון הלקוח נכשלה"]));
 if(action==='check')return reply(voice('v_aec8ff20888a5a76efa2',["החיבור לחשבון הלקוח תקין"]));
 const {error:claim}=await db.from('vendpay_tenant_door_operations').insert({tenant_id:tenant,call_hash:callHash,status:'sending'});if(claim)return reply(voice('v_2996bf0103b573d07866',["הבקשה כבר בטיפול או שלא ניתן לשמור אותה"]));
 // Exactly one command attempt; never retry an unknown result.
 let ok=false;try{ok=await valid(await fetch(BASE+'/terminal/setTerminalGateStatus?'+new URLSearchParams({terminal_id:String(t.terminal_id),gate_status:String(t.gate_status),lang:'heb',apiloc:'VendPayDeltaHeb'}),{headers,redirect:'manual',signal:AbortSignal.timeout(5000)}));}catch{}
 await db.from('vendpay_tenant_door_operations').update({status:ok?'sent':'uncertain'}).eq('tenant_id',tenant).eq('call_hash',callHash);
 return reply(ok?voice('v_ecc0e054bfc3e99e7370',["פקודת הפתיחה נשלחה"]):voice('v_bd99349d240423b708de',["תוצאת הבקשה לא ודאית בדקו את הדלת"]));
 }catch{return reply(voice('v_9f53b0dfd6cdd61a770e',["לא ניתן להשלים כעת את הפעולה"]));}
}
Deno.serve(withVoice(withAudit(handler,'vendpay-tenant-ivr'),'vendpay-tenant-ivr'));


import {summaryIntro,summaryReply} from './summary.ts';
import {withAudit} from './audit.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {makeHandler as createHandler} from './create.ts';
import {makeHandler as editHandler} from './edit-handler.ts';
const BASE='https://vendpay24.com/VendPayDeltaHeb';
const env=(k:string)=>Deno.env.get(k)||'';
const hash=async(v:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,'0')).join('');
export async function managementKey(tenant:string){const secret=env('VENDPAY_TENANT_ENCRYPTION_KEY');if(secret.length!==64)throw Error('configuration');const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode('vendpay-members-v1:'+tenant))),b=>b.toString(16).padStart(2,'0')).join('');}
function one(p:URLSearchParams,k:string){const v=p.getAll(k);if(v.length>1)throw Error('duplicate');return v[0]||'';}
export function groupList(d:any):Record<string,string>{
 const rows=Array.isArray(d)?d:d?.data;
 if(!Array.isArray(rows)||rows.some((x:any)=>!x||!Number.isSafeInteger(x.id)||x.id<=0||x.id>9999999999||typeof x.title!=='string'))throw Error('invalid_groups');
 const groups:Record<string,string>={};for(const x of rows){if(x.is_active!==1&&x.is_active!==true)continue;if(Object.hasOwn(groups,String(x.id)))throw Error('duplicate_group');groups[x.id]=x.title.replace(/[&=.,\r\n<>]/g,' ').slice(0,70);}
 if(!Object.keys(groups).length||Object.keys(groups).length>100)throw Error('invalid_groups');return groups;
}
export async function handler(req:Request){
 const reply=(message:string,status=200)=>new Response('id_list_message=t-'+message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 try{
 if(req.method!=='POST')return reply('נדרשת בקשת פוסט',405);
 if(!(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return reply('בקשה לא תקינה',415);
 const raw=await req.text();if(raw.length>16000)return reply('בקשה ארוכה מדי',413);
 const p=new URLSearchParams(raw),tenant=one(p,'tenant_id'),key=one(p,'tenant_key'),action=one(p,'action');
 if(!/^[0-9a-f-]{36}$/i.test(tenant)||!key||key.length>128||await hash(key)!==await hash(await managementKey(tenant)))return reply('אין הרשאה',401);
 const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
 const {data:t,error:te}=await db.from('vendpay_tenants').select('id,is_active').eq('id',tenant).maybeSingle();
 if(te||!t||!t.is_active)return reply('שלוחת הלקוח אינה פעילה');
 if(p.getAll('hangup').includes('yes'))return reply('השיחה הסתיימה');
 if(action==='health')return reply('חיבור שלוחת ניהול הלקוח תקין');
 if(!['create','edit','summary'].includes(action))return reply('פעולה לא נתמכת');
 const call=one(p,'ApiCallId'),did=one(p,'ApiDID');if(!call||call.length>200||!did||did.length>30)return reply('חסרים פרטי שיחה');
 if(action==='summary'&&!p.has('summary_0'))return new Response(summaryIntro(),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Admin-Result':'prompt'}});
 const {data:c,error:ce}=await db.from('vendpay_tenant_credentials').select('ciphertext,iv').eq('tenant_id',tenant).maybeSingle();if(ce||!c)throw Error('credentials');
 const secret=env('VENDPAY_TENANT_ENCRYPTION_KEY');const rawKey=/^[0-9a-f]{64}$/i.test(secret)?Uint8Array.from(secret.match(/../g)!,h=>parseInt(h,16)):new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
 const aes=await crypto.subtle.importKey('raw',rawKey,'AES-GCM',false,['decrypt']);const decode=(v:string)=>Uint8Array.from(atob(v),ch=>ch.charCodeAt(0));
 const credentials=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(c.iv)},aes,decode(c.ciphertext))));
 if(typeof credentials.username!=='string'||typeof credentials.password!=='string'||typeof credentials.code!=='string')return reply('יש לעדכן את פרטי התחברות הלקוח');
 const auth=await fetch(BASE+'/authenticate?lang=heb&apiloc=VendPayDeltaHeb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:credentials.username,password:credentials.password,code:credentials.code,rememberMe:credentials.rememberMe??false,role:credentials.role??''}),redirect:'manual',signal:AbortSignal.timeout(5000)});
 if(!auth.ok)return reply('לא הצלחנו להתחבר לחשבון הלקוח');const data=await auth.json();if(typeof data.token!=='string'||data.token.length<20||/\s/.test(data.token))return reply('לא התקבל אישור התחברות');
 const headers={Authorization:'Bearer '+data.token,Accept:'application/json'};
 const r=await fetch(BASE+'/restrict_group?lang=heb&apiloc=VendPayDeltaHeb',{headers,redirect:'manual',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('group_read_failed');
 const rawGroups=await r.json();
 if(action==='summary'){const users=await fetch(BASE+'/user?lang=heb&apiloc=VendPayDeltaHeb',{headers,redirect:'manual',signal:AbortSignal.timeout(8000)});if(!users.ok)throw Error('read');return new Response(summaryReply(p,await users.json(),rawGroups),{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Admin-Result':'summary'}});}
 const groups=groupList(rawGroups);
 // All account-specific data stays inside this request's closure, never shared across tenants.
 const context={tenant,active:true,groups,authenticatedCheck:async()=>({token:data.token,response:Response.json({ok:true})})};
 const delegated=new Request(req.url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:raw});
 return await (action==='create'?createHandler(context):editHandler(context))(delegated);
 }catch{return reply('לא ניתן להשלים כעת את הפעולה אם אישרתם שמירה בדקו באתר לפני ניסיון נוסף');}
}
Deno.serve(withAudit(handler,'vendpay-tenant-members'));


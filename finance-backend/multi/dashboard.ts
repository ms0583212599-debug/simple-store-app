import {scoped,profile,billing,auth,allowed,OWNER,normalizePhone,providerPending}from './shared.ts';
import {reportHTML}from './report.ts';
import {provider,clearCapabilities,capabilities,beginPhone,finishPhone,beginEmail,finishEmail,emailReport}from './delivery-routes.ts';
const origins=new Set(['https://simple-store-app-ms0583212599-1490s-projects.vercel.app','https://simple-store-app-ten.vercel.app','https://simple-store-app-git-main-ms0583212599-1490s-projects.vercel.app']);
const STORE='https://ksddrcalmszxxcuxoznd.supabase.co',PUBLIC='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
export async function handler(req){
 const origin=req.headers.get('origin')||'',headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{})};
 const reply=(d,status=200)=>new Response(JSON.stringify(d),{status,headers});
 if(!origins.has(origin))return reply({error:'כתובת האתר אינה מורשית'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(req.method))return reply({error:'פעולה לא נתמכת'},405);
 try{
 const p=new URL(req.url).searchParams,action=p.get('action')||'legacy';let b={};if(req.method==='POST'){const raw=await req.text();if(raw.length>12000)return reply({error:'בקשה ארוכה מדי'},400);b=JSON.parse(raw);if(!b||typeof b!=='object')return reply({error:'בקשה לא תקינה'},400);}
 if(action==='capabilities')return reply(await capabilities());
 if(action==='auth_login'){if(req.method!=='POST')return reply({error:'method'},405);return reply(await auth('login',{phone:normalizePhone(b.phone),pin:b.pin,channel:'web'}));}
 if(['auth_start','auth_verify'].includes(action)){if(req.method!=='POST')return reply({error:'method'},405);if(!(await capabilities()).phone_verification)return reply({error:providerPending},503);const d=action==='auth_start'?await beginPhone(b):await finishPhone(b);if(action==='auth_verify'){await auth('logout',{token:d.token});return reply({ok:true});}return reply(d);}
 const bearer=(req.headers.get('authorization')||'').replace(/^Bearer /,'');if(!bearer)return reply({error:'יש להתחבר לחשבון'},401);
 let account,custom=false;
 if(/^[a-f0-9]{64}$/.test(bearer)){try{account=(await auth('resolve',{token:bearer})).account_id;custom=true;}catch{return reply({error:'ההתחברות פגה יש להתחבר מחדש'},401);}}
 else{const r=await fetch(STORE+'/auth/v1/user',{headers:{apikey:PUBLIC,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});if(!r.ok)return reply({error:'ההתחברות פגה'},401);const u=await r.json();if(u.id!==OWNER||u.is_anonymous)return reply({error:'אין הרשאה'},403);account=OWNER;}
 if(action==='provider_settings'){if(req.method!=='POST')return reply({error:'method'},405);if(account!==OWNER||custom)return reply({error:'נדרשת כניסת מנהל קיימת להגדרת ספקים'},403);if(!['get','save','check'].includes(b.operation))return reply({error:'פעולה לא תקינה'},400);const d=await provider('settings_'+b.operation,{owner_token:bearer,data:b.data||{}});if(b.operation==='save')clearCapabilities();return reply(d);}
 if(action==='logout'){if(custom)await auth('logout',{token:bearer});return reply({ok:true});}
 if(action==='me')return reply({...await profile(account),is_owner:account===OWNER});
 if(action==='profile'){if(!['name'].includes(b.action))return reply({error:'פעולה לא נתמכת'},400);return reply(await profile(account,b.action,b.data||{}));}
 if(['email_start','email_verify','phone_link_start','phone_link_verify','email_report'].includes(action)){if(req.method!=='POST')return reply({error:'method'},405);const c=await capabilities();if(action.startsWith('phone_')){if(!c.phone_verification)return reply({error:providerPending},503);if(action==='phone_link_start')return reply(await beginPhone(b,account));const d=await finishPhone(b,account);await auth('logout',{token:d.token});return reply({ok:true});}if(!c.email_delivery)return reply({error:providerPending},503);if(action==='email_start')return reply(await beginEmail(account,b.email));if(action==='email_verify')return reply(await finishEmail(account,b));await allowed(account);if(typeof b.request_id!=='string'||!/^[-a-zA-Z0-9]{16,100}$/.test(b.request_id))return reply({error:'בקשה לא תקינה'},400);return reply(await emailReport(account,b.filters||{},b.request_id));}
 if(action==='billing'){if(!['catalog','mine','admin_list','service_save','cancel','join'].includes(b.action))return reply({error:'פעולה לא נתמכת'},400);return reply(await billing(account,b.action,b.data||{}));}
 await allowed(account);
 if(action==='export'){if(req.method!=='POST')return reply({error:'method'},405);return reply({html:await reportHTML(account,b),filename:'finance-report.html'});}
 if(action==='read')return reply(await scoped(account,'read',b));
 if(action==='manage'){if(!['transaction_save','recurring_save','budget_save','category_save','void','restore','mark_actual','refund','installments'].includes(b.action)||typeof b.request_id!=='string'||b.request_id.length<16)return reply({error:'פעולה לא תקינה'},400);return reply(await scoped(account,b.action,b.data,b.request_id));}
 // Compatibility for the original owner dashboard, always through the scoped API.
 if(action==='categories'){if(req.method==='GET')return reply({categories:(await scoped(account,'read',{mode:'categories'})).rows});return reply({category:await scoped(account,'category_save',b,crypto.randomUUID())});}
 if(action==='legacy'&&req.method==='GET'){const d=await scoped(account,'read',{from:p.get('from'),to:p.get('to'),kind:p.get('kind'),flow_type:p.get('type'),category_id:p.get('category'),page:Number(p.get('page')||0)});d.categories=(await scoped(account,'read',{mode:'categories'})).rows;return reply(d);}
 return reply({error:'פעולה לא נתמכת'},400);
 }catch(e){return reply({error:e.message||'לא ניתן להשלים את הפעולה'},400);}
}
if(import.meta.main)Deno.serve(handler);

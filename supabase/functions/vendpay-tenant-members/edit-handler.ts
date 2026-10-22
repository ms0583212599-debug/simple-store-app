import {deleteSession} from './delete.ts';
import {voice} from './voice.ts';
import {value,ask,editWizard,payload,same,listData,InputError} from './edit.ts';
import type {MemberContext} from './context.ts';
export function makeHandler(ctx:MemberContext){
const authenticatedCheck=ctx.authenticatedCheck;

const USER_URL='https://vendpay24.com/VendPayDeltaHeb/user?lang=heb&apiloc=VendPayDeltaHeb';
const TABLE='vendpay_tenant_edit_sessions';
const env=(k:string)=>Deno.env.get(k)||'';
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');}
async function keyMatches(a:string,b:string){return (await hash(a))===(await hash(b));}
async function db(method:string,q='',body?:any){q+=(q?'&':'?')+'tenant_id=eq.'+ctx.tenant;if(method==='POST')body={...body,tenant_id:ctx.tenant};const key=env('SUPABASE_SERVICE_ROLE_KEY');if(!key)throw Error('missing_database_key');return fetch(env('SUPABASE_URL')+'/rest/v1/'+TABLE+q,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});}
async function rows(r:Response){if(!r.ok)throw Error('database_error');const d=await r.json();if(!Array.isArray(d))throw Error('database_shape');return d;}
async function list(token:string){const r=await fetch(USER_URL,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('read_failed');return listData(await r.json());}
async function token(){const c=await authenticatedCheck();await c.response.body?.cancel();if(!c.response.ok)throw Error('auth_check_failed');return c.token;}
async function mark(call:string,status:string){await rows(await db('PATCH','?call_hash=eq.'+call,{status,updated_at:new Date().toISOString(),...(['confirmed','cancelled','conflict'].includes(status)?{baseline:{},intended:null}:{})}));}
async function handler(req:Request){
 const reply=(text:string,result:string,status=200)=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Edit-Result':result}});
 const say=(t:string,r:string)=>reply('id_list_message=t-'+t,r);
 try{
 if(req.method!=='POST')return reply('POST required','method',405);
 if(!(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return reply('Unsupported type','type',415);
 if(Number(req.headers.get('content-length')||0)>24000)return reply('Request too large','size',413);
 const raw=await req.text();if(raw.length>24000)return reply('Request too large','size',413);
 const p=new URLSearchParams(raw);
 if(p.getAll('hangup').includes('yes'))return say(voice('v_3fafa86ed4bafd928b93',["השיחה הסתיימה"]),'hangup');
 if(value(p,'action')==='health')return say(voice('v_e6dbea041867cd357e81',["שלוחת עריכת המשתמשים מוכנה"]),'health');
 const call=value(p,'ApiCallId'),did=value(p,'ApiDID');
 if(!call||!did||call.length>200||did.length>30)return say(voice('v_4e5b3f4bf08f86454568',["חסרים פרטי שיחה"]),'missing_call');
 const callHash=await hash(ctx.tenant+'|'+did+'|'+call);
 let session=(await rows(await db('GET','?call_hash=eq.'+callHash+'&select=*')))[0];
 if(session?.operation==='delete')return await deleteSession(p,session,callHash,{db,rows,list,token,active:ctx.active,reply});
 if(session?.status==='confirmed')return say(voice('v_4e8703127fb31ff0db0c',["הפרטים עודכנו בהצלחה"]),'confirmed');
 if(session?.status==='cancelled')return say(voice('v_287c9cca7b275ab308b4',["העריכה בוטלה"]),'cancelled');
 if(session?.status==='conflict')return say(voice('v_5d5c0fa27cf08081b611',["הפרטים השתנו בינתיים התחילו שיחה חדשה"]),'conflict');
 if(session&&['sending','uncertain'].includes(session.status)){
 const users=await list(await token());const found=users.filter(u=>String(u.id)===String(session.user_id));
 if(found.length===1&&session.intended&&same(found[0],session.intended)){await mark(callHash,'confirmed');return say(voice('v_4e8703127fb31ff0db0c',["הפרטים עודכנו בהצלחה"]),'confirmed');}
 return say(voice('v_6b96c84b301c0dc4c91d',["ניסיון השמירה הקודם עדיין בבדיקה לא נשלחה בקשה נוספת בדקו באתר"]),'uncertain');
 }
 if(session&&Date.parse(session.expires_at)<Date.now())return say(voice('v_91814a9a7b1265db3957',["זמן העריכה הסתיים התחילו שיחה חדשה"]),'expired');
 const card=value(p,'lookup_card');
 if(!session){
 if(card===undefined)return reply(ask('lookup_card',voice('v_0461ab043a383c2ce4c0',["הקישו את מספר הכרטיס של המשתמש לעריכה לסיום סולמית"])),'prompt');
 if(!/^[1-9]\d{0,14}$/.test(card))return say(voice('v_ccf14968a1ee5a41ea2b',["מספר כרטיס לא תקין"]),'invalid_card');
 const users=await list(await token());const found=users.filter(u=>String(u.card_number)===card);
 if(found.length!==1)return say(found.length?voice('v_6cb28ac0bec43bec1256',["נמצאו מספר משתמשים עם אותו כרטיס יש לבדוק באתר"]):voice('v_9d7d405ce4055bfeb959',["לא נמצא משתמש עם מספר הכרטיס הזה"]),'not_unique');
 const baseline=found[0];if(!Number.isSafeInteger(Number(baseline.id))||Number(baseline.id)<=0)throw Error('invalid_id');
 payload(baseline); // Verify the complete observed edit schema before collecting changes.
 const inserted=await db('POST','',{call_hash:callHash,user_id:Number(baseline.id),baseline});
 if(inserted.status===409)session=(await rows(await db('GET','?call_hash=eq.'+callHash+'&select=*')))[0];
 else session=(await rows(inserted))[0];
 if(!session)throw Error('missing_session');
 // Concurrent initial requests must never proceed with a different selected user.
 if(String(session.baseline.card_number)!==card)return say(voice('v_0c22531876da64ee1c0b',["כבר נבחר משתמש אחר בשיחה התחילו מחדש"]),'different_card');
 }
 if(card!==undefined&&String(session.baseline.card_number)!==card)return say(voice('v_0c22531876da64ee1c0b',["כבר נבחר משתמש אחר בשיחה התחילו מחדש"]),'different_card');
 if(value(p,'edit_mode')==='4')return await deleteSession(p,session,callHash,{db,rows,list,token,active:ctx.active,reply});
 const result=editWizard(p,session.baseline,new Date(session.created_at),ctx.groups);
 if('reply'in result)return reply(result.reply,'prompt');
 if(result.cancelled){await rows(await db('PATCH','?call_hash=eq.'+callHash+'&status=eq.editing',{status:'cancelled',baseline:{},intended:null}));return say(voice('v_6e1aa1d61511f3ca01ad',["לא נשמרו שינויים"]),'cancelled');}
 if(!ctx.active)return say(voice('v_732032c9342003a3e6d8',["הפרטים נקלטו אך השמירה עדיין לא הופעלה"]),'disabled');
 const out=payload(result.draft);
 const claim=await db('PATCH','?call_hash=eq.'+callHash+'&status=eq.editing',{status:'sending',intended:result.draft,updated_at:new Date().toISOString()});
 if(claim.status===409)return say(voice('v_81e66049a22796c999f6',["קיימת עריכה אחרת בטיפול לאותו משתמש בדקו באתר"]),'busy');
 if((await rows(claim)).length!==1)return say(voice('v_0cf605ee47883341fb8a',["השמירה כבר בטיפול לא נשלחה בקשה נוספת"]),'busy');
 const t=await token();const users=await list(t);const current=users.filter(u=>String(u.id)===String(session.user_id));
 if(current.length!==1||!same(current[0],session.baseline)){await mark(callHash,'conflict');return say(voice('v_8f130c0ee04b7d662510',["הפרטים או היתרה השתנו בינתיים באתר לא נשמר שינוי התחילו שיחה חדשה"]),'conflict');}
 if(users.some(u=>String(u.id)!==String(session.user_id)&&String(u.card_number)===String(result.draft.card_number))){await mark(callHash,'conflict');return say(voice('v_8861304871309d18d9f3',["מספר הכרטיס החדש שייך למשתמש אחר לא נשמר שינוי"]),'card_exists');}
 // At most one PUT. No retry on timeout, authentication failure or unknown response.
 try{
 const r=await fetch(USER_URL,{method:'PUT',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(out),redirect:'manual',signal:AbortSignal.timeout(8000)});
 const body=await r.text();let data:any;try{data=JSON.parse(body);}catch{}
 if(!r.ok||data?.success===false||data?.ok===false||data?.error||data?.status==='error'||/^\s*</.test(body))throw Error('update_not_acknowledged');
 const after=(await list(t)).filter(u=>String(u.id)===String(session.user_id));
 if(after.length===1&&same(after[0],result.draft)){await mark(callHash,'confirmed');return say(voice('v_4e8703127fb31ff0db0c',["הפרטים עודכנו בהצלחה"]),'confirmed');}
 }catch{}
 await mark(callHash,'uncertain');return say(voice('v_fd410d343cc25e3a0085',["בקשת העדכון נשלחה אך התוצאה לא אומתה בדקו באתר לפני ניסיון נוסף"]),'uncertain');
 }catch(e){if(e instanceof InputError)return say(e.message,'invalid_input');console.log(JSON.stringify({event:'vendpay_edit_error',kind:e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'operation_failed'}));return say(voice('v_ceec2bd52c99603b03c3',["לא ניתן להשלים כרגע את העריכה אם אישרתם שמירה בדקו באתר"]),'error');}
}
return handler;
}





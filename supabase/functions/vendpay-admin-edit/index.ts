import {withVoice} from './voice.ts';
import {voice} from './voice.ts';
import {withAudit} from './audit.ts';
import {authenticatedCheck} from './auth.ts';
import {value,ask,editWizard,payload,same,listData,InputError} from './edit.ts';
const USER_URL='https://vendpay24.com/VendPayDeltaHeb/user?lang=heb&apiloc=VendPayDeltaHeb';
const TABLE='vendpay_admin_edit_sessions';
const env=(k:string)=>Deno.env.get(k)||'';
async function hash(s:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');}
async function keyMatches(a:string,b:string){return (await hash(a))===(await hash(b));}
async function db(method:string,q='',body?:unknown){const key=env('SUPABASE_SERVICE_ROLE_KEY');if(!key)throw Error('missing_database_key');return fetch(env('SUPABASE_URL')+'/rest/v1/'+TABLE+q,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});}
async function rows(r:Response){if(!r.ok)throw Error('database_error');const d=await r.json();if(!Array.isArray(d))throw Error('database_shape');return d;}
async function list(token:string){const r=await fetch(USER_URL,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('read_failed');return listData(await r.json());}
async function token(){const c=await authenticatedCheck();await c.response.body?.cancel();if(!c.response.ok)throw Error('auth_check_failed');return c.token;}
async function mark(call:string,status:string){await rows(await db('PATCH','?call_hash=eq.'+call,{status,updated_at:new Date().toISOString(),...(['confirmed','cancelled','conflict'].includes(status)?{baseline:{},intended:null}:{})}));}
export async function handler(req:Request){
 const reply=(text:string,result:string,status=200)=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Edit-Result':result}});
 const say=(t:string,r:string)=>reply('id_list_message=t-'+t,r);
 try{
 if(req.method!=='POST')return reply('POST required','method',405);
 if(!(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return reply('Unsupported type','type',415);
 if(Number(req.headers.get('content-length')||0)>24000)return reply('Request too large','size',413);
 const raw=await req.text();if(raw.length>24000)return reply('Request too large','size',413);
 const p=new URLSearchParams(raw),expected=env('VENDPAY_ADMIN_KEY'),provided=value(p,'admin_key')||'';
 if(expected.length<32)return say(voice('v_b4ed670c7f8a057313b3',["חיבור הניהול טרם הוגדר"]),'unconfigured');
 if(provided.length>256||!await keyMatches(expected,provided))return reply('Unauthorized','unauthorized',401);
 if(p.getAll('hangup').includes('yes'))return say(voice('v_5443375a414b0401cfc1',["השיחה הסתיימה"]),'hangup');
 if(value(p,'action')==='health')return say(voice('v_e9729dce306a82ccc437',["שלוחת עריכת המשתמשים מוכנה"]),'health');
 const call=value(p,'ApiCallId'),did=value(p,'ApiDID');
 if(!call||!did||call.length>200||did.length>30)return say(voice('v_3f1a23afe8f6f6a7a584',["חסרים פרטי שיחה"]),'missing_call');
 const callHash=await hash(did+'|'+call);
 let session=(await rows(await db('GET','?call_hash=eq.'+callHash+'&select=*')))[0];
 if(session?.status==='confirmed')return say(voice('v_5f18fffb14d43303088d',["הפרטים עודכנו בהצלחה"]),'confirmed');
 if(session?.status==='cancelled')return say(voice('v_0ec29e5ab56f4e97556f',["העריכה בוטלה"]),'cancelled');
 if(session?.status==='conflict')return say(voice('v_7f176078659922fe1c8f',["הפרטים השתנו בינתיים התחילו שיחה חדשה"]),'conflict');
 if(session&&['sending','uncertain'].includes(session.status)){
 const users=await list(await token());const found=users.filter(u=>String(u.id)===String(session.user_id));
 if(found.length===1&&session.intended&&same(found[0],session.intended)){await mark(callHash,'confirmed');return say(voice('v_5f18fffb14d43303088d',["הפרטים עודכנו בהצלחה"]),'confirmed');}
 return say(voice('v_5a283cff4553239bb841',["ניסיון השמירה הקודם עדיין בבדיקה לא נשלחה בקשה נוספת בדקו באתר"]),'uncertain');
 }
 if(session&&Date.parse(session.expires_at)<Date.now())return say(voice('v_297c5a3b97a4b2641d5a',["זמן העריכה הסתיים התחילו שיחה חדשה"]),'expired');
 const card=value(p,'lookup_card');
 if(!session){
 if(card===undefined)return reply(ask('lookup_card',voice('v_2b100505291e1f1efc6b',["הקישו את מספר הכרטיס של המשתמש לעריכה לסיום סולמית"])),'prompt');
 if(!/^[1-9]\d{0,14}$/.test(card))return say(voice('v_5b6b7bec198f494963f6',["מספר כרטיס לא תקין"]),'invalid_card');
 const users=await list(await token());const found=users.filter(u=>String(u.card_number)===card);
 if(found.length!==1)return say(found.length?voice('v_b25fa9b1d0924910b09a',["נמצאו מספר משתמשים עם אותו כרטיס יש לבדוק באתר"]):voice('v_3cbffd34afc767e0b626',["לא נמצא משתמש עם מספר הכרטיס הזה"]),'not_unique');
 const baseline=found[0];if(!Number.isSafeInteger(Number(baseline.id))||Number(baseline.id)<=0)throw Error('invalid_id');
 payload(baseline); // Verify the complete observed edit schema before collecting changes.
 const inserted=await db('POST','',{call_hash:callHash,user_id:Number(baseline.id),baseline});
 if(inserted.status===409)session=(await rows(await db('GET','?call_hash=eq.'+callHash+'&select=*')))[0];
 else session=(await rows(inserted))[0];
 if(!session)throw Error('missing_session');
 // Concurrent initial requests must never proceed with a different selected user.
 if(String(session.baseline.card_number)!==card)return say(voice('v_ea6da9451b00f35eb6f8',["כבר נבחר משתמש אחר בשיחה התחילו מחדש"]),'different_card');
 }
 if(card!==undefined&&String(session.baseline.card_number)!==card)return say(voice('v_ea6da9451b00f35eb6f8',["כבר נבחר משתמש אחר בשיחה התחילו מחדש"]),'different_card');
 const result=editWizard(p,session.baseline,new Date(session.created_at));
 if('reply'in result)return reply(result.reply,'prompt');
 if(result.cancelled){await rows(await db('PATCH','?call_hash=eq.'+callHash+'&status=eq.editing',{status:'cancelled',baseline:{},intended:null}));return say(voice('v_b85f9ecd39dbf5546fe1',["לא נשמרו שינויים"]),'cancelled');}
 if(env('VENDPAY_ADMIN_ENABLED')!=='true')return say(voice('v_b016ec89aa9191e1859b',["הפרטים נקלטו אך השמירה עדיין לא הופעלה"]),'disabled');
 const out=payload(result.draft);
 const claim=await db('PATCH','?call_hash=eq.'+callHash+'&status=eq.editing',{status:'sending',intended:result.draft,updated_at:new Date().toISOString()});
 if(claim.status===409)return say(voice('v_f1ffe948eaea6959abb7',["קיימת עריכה אחרת בטיפול לאותו משתמש בדקו באתר"]),'busy');
 if((await rows(claim)).length!==1)return say(voice('v_404fdf85b50a04addb0e',["השמירה כבר בטיפול לא נשלחה בקשה נוספת"]),'busy');
 const t=await token();const users=await list(t);const current=users.filter(u=>String(u.id)===String(session.user_id));
 if(current.length!==1||!same(current[0],session.baseline)){await mark(callHash,'conflict');return say(voice('v_0f4c926b4f6157a026bc',["הפרטים או היתרה השתנו בינתיים באתר לא נשמר שינוי התחילו שיחה חדשה"]),'conflict');}
 if(users.some(u=>String(u.id)!==String(session.user_id)&&String(u.card_number)===String(result.draft.card_number))){await mark(callHash,'conflict');return say(voice('v_d44bc10456960fadc42a',["מספר הכרטיס החדש שייך למשתמש אחר לא נשמר שינוי"]),'card_exists');}
 // At most one PUT. No retry on timeout, authentication failure or unknown response.
 try{
 const r=await fetch(USER_URL,{method:'PUT',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(out),redirect:'manual',signal:AbortSignal.timeout(8000)});
 const body=await r.text();let data:any;try{data=JSON.parse(body);}catch{}
 if(!r.ok||data?.success===false||data?.ok===false||data?.error||data?.status==='error'||/^\s*</.test(body))throw Error('update_not_acknowledged');
 const after=(await list(t)).filter(u=>String(u.id)===String(session.user_id));
 if(after.length===1&&same(after[0],result.draft)){await mark(callHash,'confirmed');return say(voice('v_5f18fffb14d43303088d',["הפרטים עודכנו בהצלחה"]),'confirmed');}
 }catch{}
 await mark(callHash,'uncertain');return say(voice('v_81b269bf2b2ef1e6c1e8',["בקשת העדכון נשלחה אך התוצאה לא אומתה בדקו באתר לפני ניסיון נוסף"]),'uncertain');
 }catch(e){if(e instanceof InputError)return say(e.message,'invalid_input');console.log(JSON.stringify({event:'vendpay_edit_error',kind:e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'operation_failed'}));return say(voice('v_87711f5bc5976a2a218a',["לא ניתן להשלים כרגע את העריכה אם אישרתם שמירה בדקו באתר"]),'error');}
}
Deno.serve(withVoice(withAudit(handler,'vendpay-admin-edit'),'vendpay-admin-edit'));




import {duplicateCardPrompt} from './card-retry.ts';
import {voice} from './voice.ts';
import {wizard,value,InputError} from './wizard.ts';
import type {MemberContext} from './context.ts';
export function makeHandler(ctx:MemberContext){
const authenticatedCheck=ctx.authenticatedCheck;

const USER_URL='https://vendpay24.com/VendPayDeltaHeb/user?lang=heb&apiloc=VendPayDeltaHeb';
const TABLE='vendpay_tenant_create_operations';
const env=(k:string)=>Deno.env.get(k)||'';
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
function equal(a:string,b:string){const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);return diff===0;}
async function db(method:string,query='',body?:any){
 query+=(query?'&':'?')+'tenant_id=eq.'+ctx.tenant; if(method==='POST')body={...body,tenant_id:ctx.tenant};
 const key=env('SUPABASE_SERVICE_ROLE_KEY'); if(!key)throw new Error('database_unconfigured');
 return fetch(env('SUPABASE_URL')+'/rest/v1/'+TABLE+query,{method,headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});
}
async function rows(response:Response){if(!response.ok)throw new Error('database_failed');const d=await response.json();if(!Array.isArray(d))throw new Error('database_shape');return d;}
async function mark(callHash:string,status:string){await rows(await db('PATCH','?call_hash=eq.'+callHash,{status,updated_at:new Date().toISOString()}));}
function userList(data:unknown):Record<string,unknown>[] {
 let list:any=data;
 if(!Array.isArray(list)&&list&&typeof list==='object') {
  if(Array.isArray(list.users))list=list.users;
  else if(Array.isArray(list.data))list=list.data;
  else if(Array.isArray(list.content))list=list.content;
  else if(list.data&&Array.isArray(list.data.users))list=list.data.users;
 }
 if(!Array.isArray(list)||list.some(x=>!x||typeof x!=='object'||!('id' in x)||!('card_number' in x)))throw new Error('unrecognized_user_list');
 return list;
}
async function list(token:string){const r=await fetch(USER_URL,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('user_list_failed');return userList(await r.json());}
function matches(user:Record<string,unknown>,payload:Record<string,unknown>){
 return Number(user.id)>0&&['fname','lname','pel','card_number','card_value','restrict_id','date_start','date_end','is_active'].every(k=>String(user[k]??'')===String(payload[k]??''));
}
async function handler(req:Request):Promise<Response> {
 const reply=(text:string,result:string,status=200)=>new Response(text,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Admin-Result':result}});
 const say=(text:string,result:string)=>reply('id_list_message=t-'+text,result);
 if(req.method!=='POST')return reply('POST required','method',405);
 let p:URLSearchParams;
 try{
 if(Number(req.headers.get('content-length')||0)>16384)return reply('Request too large','size',413);
 if(!(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return reply('Unsupported type','type',415);
 const raw=await req.text();if(raw.length>16384)return reply('Request too large','size',413);
 p=new URLSearchParams(raw);
 
 if(p.getAll('hangup').includes('yes'))return say(voice('v_7b3558b00ca73c655fb6',["השיחה הסתיימה"]),'hangup');
 if(value(p,'action')==='health')return say(voice('v_f21605f7e3bbeff495d7',["חיבור שלוחת הניהול תקין"]),'health');
 const call=value(p,'ApiCallId'),did=value(p,'ApiDID');
 if(!call||!did||call.length>200||did.length>30)return say(voice('v_890027d6442d3ce9057c',["חסרים פרטי שיחה"]),'missing_call');
 const result=wizard(p,new Date(),ctx.groups);
 if('reply' in result){
  // No write before explicit final confirmation.
  return reply(result.reply,'prompt');
 }
 if(result.cancelled)return say(voice('v_4ce8cfc9b5a27787fc15',["ההוספה בוטלה לא נשמר משתמש"]),'cancelled');
 if(!ctx.active)return say(voice('v_0ae0262b0910bd8cf73d',["הפרטים נקלטו אך השמירה עדיין לא הופעלה"]),'disabled');
 const payload=result.payload;
 const callHash=await digest(ctx.tenant+'|'+did+'|'+call),cardHash=await digest(String(payload.card_number)),payloadHash=await digest(JSON.stringify(payload));
 let previous=(await rows(await db('GET','?call_hash=eq.'+callHash+'&select=*')))[0];
 if(previous&&previous.payload_hash!==payloadHash)return say(voice('v_470363102a207415bcc6',["כבר התקבלה פעולה אחרת בשיחה זו התחילו שיחה חדשה"]),'changed_payload');
 if(previous?.status==='confirmed')return say(voice('v_49b373f077f49dac2cd5',["המשתמש נוסף בהצלחה"]),'confirmed');
 if(previous&&['existing','rejected'].includes(previous.status))return say(voice('v_b827f5c28694a196fe84',["השמירה לא בוצעה יש לבדוק את מספר הכרטיס באתר"]),'rejected');
 const checked=await authenticatedCheck();
 const checkBody=await checked.response.text();
 if(!checked.response.ok||/^\s*</.test(checkBody))throw new Error('auth_check_failed');
 const token=checked.token;
 let users=await list(token);
 const cardUsers=users.filter(u=>String(u.card_number)===String(payload.card_number));
 if(previous){
  if(cardUsers.length===1&&matches(cardUsers[0],payload)){await mark(callHash,'confirmed');return say(voice('v_49b373f077f49dac2cd5',["המשתמש נוסף בהצלחה"]),'confirmed');}
  return say(voice('v_62e4ff3004ff91d25b20',["תוצאת ניסיון השמירה הקודם עדיין לא ודאית בדקו באתר לפני ניסיון נוסף"]),'uncertain');
 }
 if(cardUsers.length)return reply(duplicateCardPrompt(p),'prompt');
 const since=new Date(Date.now()-60000).toISOString();
 if((await rows(await db('GET','?select=call_hash&created_at=gte.'+encodeURIComponent(since)+'&limit=6'))).length>=5)return say(voice('v_9e625eac8b6dcb29e1c2',["בוצעו מספר פעולות בזמן קצר נסו שוב בעוד דקה"]),'rate_limited');
 const claim=await db('POST','',{call_hash:callHash,card_hash:cardHash,payload_hash:payloadHash,status:'reserved'});
 if(claim.status===409)return say(voice('v_05fe30c7591ecdc7952d',["הפעולה כבר בטיפול או שמספר הכרטיס כבר נשלח לבדיקה בדקו באתר"]),'duplicate');
 await rows(claim);
 // Persist BEFORE sending. Never retry the POST, including after timeout or 401.
 await mark(callHash,'sent');
 let response:Response;
 try {response=await fetch(USER_URL,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(8000)});}catch{await mark(callHash,'uncertain');return say(voice('v_c24435c511a03e063e98',["לא ניתן לאמת כרגע את השמירה בדקו באתר לפני ניסיון נוסף"]),'uncertain');}
 const body=await response.text();let data:any;try{data=body?JSON.parse(body):null;}catch{}
 if(!response.ok||data?.success===false||data?.ok===false||data?.error||data?.status==='error'||/^\s*</.test(body)){
 await mark(callHash,'uncertain');return say(voice('v_0c09695ebde3250cb4b6',["לא התקבל אישור תקין לשמירה בדקו באתר לפני ניסיון נוסף"]),'upstream_error');
 }
 try{users=await list(token);}catch{await mark(callHash,'uncertain');return say(voice('v_bec7d41ae298dbc0e25e',["בקשת השמירה נשלחה אך לא ניתן לאמת שנשמרה בדקו באתר"]),'uncertain');}
 const saved=users.filter(u=>String(u.card_number)===String(payload.card_number));
 if(saved.length===1&&matches(saved[0],payload)){await mark(callHash,'confirmed');return say(voice('v_49b373f077f49dac2cd5',["המשתמש נוסף בהצלחה"]),'confirmed');}
 await mark(callHash,'uncertain');return say(voice('v_7b8ff4729f41c21d146c',["בקשת השמירה נשלחה אך הפרטים עדיין לא אומתו בדקו באתר"]),'uncertain');
 }catch(error){
 if(error instanceof InputError)return say(error.message,'invalid_input');
 // No caller data, credentials, request bodies or upstream response bodies in logs.
 console.log(JSON.stringify({event:'vendpay_admin_error',kind:error instanceof Error&&/^[a-z_]+$/.test(error.message)?error.message:'operation_failed'}));
 return say(voice('v_2686e55f3b0ee6a7911a',["לא ניתן להשלים כרגע את הפעולה אם אישרתם שמירה בדקו באתר לפני ניסיון נוסף"]),'error');
 }
}
return handler;
}




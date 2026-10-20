import {voice} from './voice.ts';
import {wizard,validate,modeList,one,InputError} from './flow.ts';
const BASE='https://vendpay24.com/VendPayDeltaHeb';
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),n=>n.toString(16).padStart(2,'0')).join('');
function canonical(v:any):string{return JSON.stringify(v&&typeof v==='object'?Array.isArray(v)?v.map(x=>JSON.parse(canonical(x))):Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canonical(v[k]))])):v);}
export async function zoneHandler(req:Request,ctx:{tenant:string,terminal:number,kind:string,token:string}){
 const say=(t:string,result:string)=>new Response('id_list_message=t-'+t,{headers:{'Content-Type':'text/plain; charset=utf-8','X-Edit-Result':result,'Cache-Control':'no-store'}});
 const db=async(method:string,q='',body?:any)=>{const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/vendpay_zone_sessions'+(q||'?')+(q?'&':'')+'tenant_id=eq.'+ctx.tenant,{method,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});if(r.status===409)return null;if(!r.ok)throw Error('database');return await r.json();};
 const url=BASE+(ctx.kind==='price_zones'?'/priceZone':'/modeZone')+'?'+new URLSearchParams({terminal_id:String(ctx.terminal),lang:'heb',apiloc:'VendPayDeltaHeb'});
 const headers={Authorization:'Bearer '+ctx.token,Accept:'application/json','Content-Type':'application/json'};
 const read=async()=>{const r=await fetch(url,{headers,redirect:'manual',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('read');return validate(await r.json(),ctx.terminal,ctx.kind);};
 try{
 const p=new URLSearchParams(await req.text());const call=await hash(ctx.tenant+'|'+ctx.kind+'|'+one(p,'ApiDID')+'|'+one(p,'ApiCallId'));const q='?call_hash=eq.'+call;
 let s=(await db('GET',q))[0];
 if(s&&s.terminal_id!==ctx.terminal)return say(voice('v_a12e0597ed0f746662ae',["המסוף השתנה התחילו שיחה חדשה"]),'conflict');
 if(s?.status==='confirmed')return say(voice('v_607ce6e88e60993ded50',["השינוי נשמר באתר ונשלח למסוף יש לוודא שהמסוף קיבל אותו"]),'confirmed');
 if(s&&['sending','uncertain'].includes(s.status))return say(voice('v_7b36b85778a3ba48cdbb',["בקשת השמירה הקודמת נשלחה ותוצאתה אינה ודאית לא נשלחה שוב בדקו באתר"]),'uncertain');
 if(s?.status==='cancelled')return say(voice('v_1549d7de093a1eb9ea1a',["השינוי בוטל"]),'cancelled');
 if(s?.status==='conflict')return say(voice('v_ac7230b472ca084cf6d8',["הרשימה השתנתה התחילו שיחה חדשה"]),'conflict');
 if(s&&Date.parse(s.expires_at)<Date.now())return say(voice('v_6b61a1eb437009cb5718',["זמן העריכה הסתיים התחילו שיחה חדשה"]),'expired');
 if(!s){const baseline=await read();const created=await db('POST','',{tenant_id:ctx.tenant,call_hash:call,terminal_id:ctx.terminal,kind:ctx.kind,baseline});if(!created)return say(voice('v_720c227870ed4d5273d6',["השיחה כבר בטיפול נסו בשיחה חדשה"]),'busy');s=created[0];}
 let modes:Record<string,string>={};if(ctx.kind==='mode_zones'){const r=await fetch(BASE+'/fixed/getModes/?lang=heb&apiloc=VendPayDeltaHeb',{headers,redirect:'manual',signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('modes');modes=modeList(await r.json());}
 const result=wizard(p,s.baseline,ctx.kind,modes);
 if('reply'in result)return new Response(result.reply,{headers:{'Content-Type':'text/plain; charset=utf-8','X-Edit-Result':'prompt','Cache-Control':'no-store'}});
 if('cancelled'in result){await db('PATCH',q+'&status=eq.editing',{status:'cancelled',baseline:{}});return say(voice('v_1549d7de093a1eb9ea1a',["השינוי בוטל"]),'cancelled');}
 if(canonical(result.draft)===canonical(s.baseline))return say(voice('v_205205c91e2cb984c9a1',["לא נבחר שינוי"]),'cancelled');
 const claimed=await db('PATCH',q+'&status=eq.editing',{status:'sending',intended:result.draft});if(!claimed?.length)return say(voice('v_41d0fb8837b30ccc7464',["יש פעולה בטיפול למסוף זה לא נשלחה בקשה נוספת"]),'busy');
 const current=await read();if(canonical(current)!==canonical(s.baseline)){await db('PATCH',q,{status:'conflict',baseline:{},intended:null});return say(voice('v_14e6e69cb81f42ed0c18',["הרשימה השתנתה מאז תחילת השיחה לא נשמר שינוי התחילו מחדש"]),'conflict');}
 // Exactly one PUT. No retries, even on timeouts or authentication errors.
 try{const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify(result.draft),redirect:'manual',signal:AbortSignal.timeout(6000)});const text=await r.text();let d:any;try{d=JSON.parse(text)}catch{}if(!r.ok||/^\s*</.test(text)||d?.error||d?.success===false||d?.ok===false)throw Error('write');
 if(canonical(await read())===canonical(result.draft)){await db('PATCH',q,{status:'confirmed',baseline:{},intended:null});return say(voice('v_607ce6e88e60993ded50',["השינוי נשמר באתר ונשלח למסוף יש לוודא שהמסוף קיבל אותו"]),'confirmed');}
 }catch{}
 await db('PATCH',q,{status:'uncertain'});return say(voice('v_df9f3aaddc9f6e98479f',["הבקשה נשלחה אך התוצאה לא אומתה בדקו באתר לפני ניסיון נוסף"]),'uncertain');
 }catch(e){if(e instanceof InputError)return say(e.message,'invalid_input');return say(voice('v_5936775c45b6a9351dff',["לא ניתן להשלים את הפעולה אם אישרתם שמירה בדקו באתר לפני ניסיון נוסף"]),'error');}
}

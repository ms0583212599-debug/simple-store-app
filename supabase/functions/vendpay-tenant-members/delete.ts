import {voice} from './voice.ts';
import {retryField} from './retry.ts';
import {same} from './edit.ts';
const DELETE_BASE='https://vendpay24.com/VendPayDeltaHeb/user/';
const safe=(v:unknown)=>String(v??'').replace(/[&=.<>{}\r\n]/g,' ').slice(0,120);
export async function deleteSession(p:URLSearchParams,session:any,callHash:string,deps:any){
 const {db,rows,list,token,active,reply}=deps;
 const say=(text:string,result:string)=>reply('id_list_message=t-'+text,result);
 const success=()=>say(voice('v_ivr_members_delete_success',['המשתמש נמחק בהצלחה']),'deleted');
 const uncertain=()=>say(voice('v_ivr_members_delete_uncertain',['בקשת המחיקה נשלחה אך התוצאה לא אומתה לא נשלחה בקשה נוספת בדקו באתר']),'uncertain');
 const mark=async(status:string)=>rows(await db('PATCH','?call_hash=eq.'+callHash,{status,updated_at:new Date().toISOString(),...(['confirmed','cancelled','conflict'].includes(status)?{baseline:{},intended:null}:{})}));
 if(session.operation==='delete'){
  if(session.status==='confirmed')return success();
  if(session.status==='cancelled')return say(voice('v_ivr_members_delete_cancelled',['המחיקה בוטלה המשתמש לא נמחק']),'cancelled');
  if(session.status==='conflict')return say(voice('v_ivr_members_delete_conflict',['פרטי המשתמש השתנו לא בוצעה מחיקה התחילו שיחה חדשה']),'conflict');
  if(['sending','uncertain'].includes(session.status)){
   try{const users=await list(await token());if(!users.some((u:any)=>String(u.id)===String(session.user_id))){await mark('confirmed');return success();}}catch{}
   return uncertain();
  }
 }
 if(Date.parse(session.expires_at)<Date.now())return say(voice('v_ivr_members_delete_expired',['זמן העריכה הסתיים התחילו שיחה חדשה']),'expired');
 const baseline=session.baseline;
 const who=safe(baseline.fname)+' '+safe(baseline.lname),card=safe(baseline.card_number);
 const confirm=retryField(p,'delete_confirm',k=>`read=t-${voice('v_ivr_members_delete_confirm',['בחרתם למחוק את המשתמש ',who,' מספר כרטיס ',card,' המחיקה אינה ניתנת לביטול להמשך הקישו אחת לביטול הקישו אפס'])}=${k},,1,1,30,NO`,v=>{if(!['0','1'].includes(v))throw Error();return v;});
 if('reply'in confirm)return reply(confirm.reply,'prompt');
 const cancel=async()=>{const changed=await rows(await db('PATCH','?call_hash=eq.'+callHash+'&status=eq.editing',{status:'cancelled',operation:'delete',baseline:{},intended:null}));return changed.length===1?say(voice('v_ivr_members_delete_cancelled',['המחיקה בוטלה המשתמש לא נמחק']),'cancelled'):uncertain();};
 if(confirm.data==='0')return cancel();
 const retype=retryField(p,'delete_card',k=>`read=t-${voice('v_ivr_members_delete_card',['לאישור סופי של המחיקה הקישו שוב את מספר הכרטיס לסיום סולמית לביטול הקישו אפס'])}=${k},,15,1,30,Digits`,v=>{if(v==='0'||v===String(baseline.card_number))return v;throw Error();});
 if('reply'in retype)return reply(retype.reply,'prompt');if(retype.data==='0')return cancel();
 if(!active)return say(voice('v_ivr_members_delete_disabled',['המחיקה אינה פעילה עבור חשבון זה']),'disabled');
 const claim=await db('PATCH','?call_hash=eq.'+callHash+'&status=eq.editing',{status:'sending',operation:'delete',intended:null,updated_at:new Date().toISOString()});
 if(claim.status===409)return say(voice('v_ivr_members_delete_busy',['קיימת פעולה אחרת בטיפול לאותו משתמש לא נשלחה מחיקה']),'busy');
 if((await rows(claim)).length!==1)return uncertain();
 try{
  const t=await token();const users=await list(t);const found=users.filter((u:any)=>String(u.id)===String(session.user_id));
  if(found.length!==1||!same(found[0],baseline)){await mark('conflict');return say(voice('v_ivr_members_delete_conflict',['פרטי המשתמש השתנו לא בוצעה מחיקה התחילו שיחה חדשה']),'conflict');}
  // Observed in VendPay's own frontend: DELETE /user/{id}. Never retry this request.
  const r=await fetch(DELETE_BASE+encodeURIComponent(String(session.user_id))+'?lang=heb&apiloc=VendPayDeltaHeb',{method:'DELETE',headers:{Authorization:'Bearer '+t,Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});
  await r.body?.cancel();
  const after=await list(t);
  if(!after.some((u:any)=>String(u.id)===String(session.user_id))){await mark('confirmed');return success();}
 }catch{}
 await mark('uncertain');return uncertain();
}

import {beginPhone,finishPhone,capabilities}from './delivery-routes.ts';
import {db,auth}from './shared.ts';
const clean=s=>String(s||'').replace(/[.=&<>\r\n]/g,' ');
export async function registration(row,p,phone){
 let state=row.state,seq=row.seq;const key='signup'+seq;let value=p.get(key);
 const save=async next=>{const rows=await db('finance_entry_calls?id=eq.'+row.id+'&seq=eq.'+seq,{state:next,seq:seq+1},'PATCH');if(!rows.length)throw Error('הבקשה כבר טופלה יש לחזור לשלוחה');state=next;seq++;};
 if(state.expires_at&&new Date(state.expires_at)<=new Date()){await save({stage:'register_choice',notice:'קוד האימות פג תוקף יש לבקש קוד חדש'});value=null;}
 if(value!==null){
  try{
   if(state.stage==='register_choice'){
    if(!['1','2'].includes(value))throw Error('בחרו 1 להרשמה או 2 לאיפוס קוד');
    if(!(await capabilities()).phone_verification)throw Error('אימות קולי עדיין אינו מוגדר');
    const c=await beginPhone({phone,purpose:value==='1'?'register':'reset'});await save({stage:'otp',challenge_id:c.challenge_id,expires_at:c.expires_at,notice:'קוד האימות נשלח ניתן לנתק ולחזור לאחר קבלת השיחה'});
   }else if(state.stage==='otp'){
    if(!/^\d{6}$/.test(value))throw Error('קוד האימות כולל שש ספרות');
    // Keep only the parameter name; never persist the OTP or the personal PIN.
    await save({...state,stage:'new_pin',otp_key:key,notice:''});
   }else if(state.stage==='new_pin'){
    const otp=p.get(state.otp_key);if(!otp){await save({...state,stage:'otp',notice:'הקישו שוב את קוד האימות'});}else{
     const d=await finishPhone({phone,challenge_id:state.challenge_id,code:otp,pin:value,channel:'phone'});
     await auth('logout',{token:d.token});
     const rows=await db('finance_entry_calls?id=eq.'+row.id+'&seq=eq.'+seq,{state:{stage:'complete'},account_id:d.account_id,authenticated_until:new Date(Date.now()+3600000).toISOString(),seq:seq+1},'PATCH');
     if(!rows.length)throw Error('האימות הושלם יש להיכנס מחדש');return {account_id:d.account_id};
    }
   }
  }catch(e){await save({...state,notice:e.message,...(state.stage==='new_pin'?{stage:'otp',otp_key:null}:{})});}
 }
 const text=state.stage==='register_choice'?'להרשמה חדשה 1 לאיפוס הקוד האישי 2':state.stage==='otp'?'הקישו את קוד האימות שקיבלתם בן שש ספרות וסולמית':'בחרו קוד אישי חדש בן שש עד שתים עשרה ספרות וסיימו בסולמית';
 return {text:'read=t-'+clean((state.notice||'')+' '+text)+'=signup'+seq+',,'+(state.stage==='new_pin'?12:state.stage==='otp'?6:1)+',1,30,NO,no'};
}
export async function pendingRegistration(phone){
 const rows=await db('finance_challenges?select=id,expires_at&phone=eq.'+encodeURIComponent(phone)+'&purpose=in.(register,reset)&used_at=is.null&attempts=lt.5&expires_at=gt.'+encodeURIComponent(new Date().toISOString())+'&order=created_at.desc&limit=1');
 return rows[0]?{stage:'otp',challenge_id:rows[0].id,expires_at:rows[0].expires_at}:null;
}

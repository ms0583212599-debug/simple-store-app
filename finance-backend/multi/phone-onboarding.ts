// Prepared for activation after explicit approval of the voice verification provider.
import {beginPhone,finishPhone,beginEmail,finishEmail,emailReport}from './delivery-routes.ts';
export async function onboarding(state,value,phone){
 if(state.stage==='register_choice'){
  if(!['1','2'].includes(value))throw Error('בחירה לא תקינה');
  const d=await beginPhone({phone,purpose:value==='1'?'register':'reset'});
  return {stage:'otp',challenge_id:d.challenge_id,notice:'קוד אימות יישלח בשיחה קולית למספר שלכם ניתן לנתק ולחזור לאחר קבלת הקוד'};
 }
 if(state.stage==='otp'){if(!/^\d{6}$/.test(value))throw Error('קוד האימות צריך לכלול שש ספרות');return {...state,stage:'new_pin',otp:value};}
 if(state.stage==='new_pin'){
  if(!/^\d{6,12}$/.test(value))throw Error('קוד אישי צריך לכלול שש עד שתים עשרה ספרות');
  const d=await finishPhone({phone,challenge_id:state.challenge_id,code:state.otp,pin:value,channel:'phone'});
  // PIN is never returned or persisted in call state.
  return {stage:'complete',account_id:d.account_id,notice:'החשבון הוכן בהצלחה'};
 }
 throw Error('שלב לא תקין');
}
export async function accountEmail(state,value,account){
 if(state.stage==='email_address'){const d=await beginEmail(account,value);return {stage:'email_code',challenge_id:d.challenge_id};}
 if(state.stage==='email_code'){await finishEmail(account,{challenge_id:state.challenge_id,code:value});return {stage:'main',notice:'כתובת המייל אומתה ונשמרה'};}
 if(state.stage==='email_report_confirm'){if(value!=='1')return {stage:'main'};const result=await emailReport(account,state.filter,state.request_id);return {stage:'main',notice:result.ok?'הדוח נשלח למייל המאומת':'שליחת הדוח לא אושרה'};}
 throw Error('שלב לא תקין');
}

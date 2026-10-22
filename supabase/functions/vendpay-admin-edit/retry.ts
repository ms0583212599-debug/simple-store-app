import {voice} from './voice.ts';
export function retryField<T>(p:URLSearchParams,key:string,prompt:(key:string)=>string,parse:(raw:string)=>T):{reply:string}|{data:T}{
 for(let n=0;n<20;n++){
  const k=n?key+'_retry_'+n:key,values=p.getAll(k);
  if(values.length>1)throw Error('duplicate_parameter');
  if(!values.length)return {reply:prompt(k).replace('read=t-', 'read=t-'+(n?voice('v_ivr_edit_input_retry',['הערך אינו תקין נסו שוב ']):''))};
  try{return {data:parse(values[0])};}catch{}
 }
 return {reply:'id_list_message=t-'+voice('v_ivr_edit_input_limit',['לא נקלט ערך תקין לאחר ניסיונות רבים אנא התחילו שיחה חדשה'])};
}

import {retryField} from './retry.ts';
import {voice} from './voice.ts';
// Pure IVR building blocks. No HTTP calls, writes, or deployment.
// Source: https://f2.freeivr.co.il/topic/56
function read(text: string, options: string[]) {
  return `read=t-${text}=${options.join(',')}`;
}
function one(p: URLSearchParams, key: string) {
  const values=p.getAll(key);
  if(values.length>1) throw new Error('duplicate_parameter');
  return values[0];
}
export function cleanName(value: string) {
  const name=value.normalize('NFC').trim().replace(/\s+/g,' ');
  // Reject protocol delimiters instead of inserting caller text into IVR commands.
  if(name.length<1 || name.length>60 || !/^[\p{L}\p{M} '\u05f3\u05f4’-]+$/u.test(name))
    throw new Error('invalid_name');
  return name;
}
export function collectNames(p:URLSearchParams):{reply:string}|{fname:string,lname:string}{
 for(let attempt=0;attempt<20;attempt++){
  const names:string[]=[];
  for(const [field,label] of [['fname','השם הפרטי'],['lname','שם המשפחה']]){
   let accepted=false;
   for(let n=0;n<20;n++){
    const key=`admin_${attempt}_${field}`+(n?'_retry_'+n:'');const spoken=one(p,key);
    if(spoken===undefined)return {reply:read((n?voice('v_ivr_members_input_retry',['הערך אינו תקין נסו שוב ']):'')+voice('v_ivr_members_name_retry_prompt',['אמרו את ',label,' בקול ברור או הקישו אחת להזנת אותיות']),[key,'','voice','he-IL','','1'])};
    let input=spoken;
    if(spoken.startsWith('Digits-')){
     const typed=retryField(p,key+'_typed',k=>read(voice('v_ivr_members_name_typed',['הקלידו את ',label,'']),[k,'','60','1','30','HebrewKeyboard']),cleanName);
     if('reply'in typed)return typed;input=typed.data;
    }
    try{names.push(cleanName(input));accepted=true;break;}catch{}
   }
   if(!accepted)return {reply:'id_list_message=t-'+voice('v_ivr_members_input_limit',['לא נקלט ערך תקין לאחר ניסיונות רבים אנא התחילו שיחה חדשה'])};
  }
  const ok=retryField(p,`admin_${attempt}_names_ok`,k=>read(voice('v_ivr_members_names_confirm',['השם שנקלט הוא ',names.join(' '),' לאישור הקישו אחת לתיקון הקישו שתיים']),[k,'','1','1','10','NO','','','','12','','','','','no']),v=>{if(!['1','2'].includes(v))throw Error();return v;});
  if('reply'in ok)return ok;if(ok.data==='1')return {fname:names[0],lname:names[1]};
 }
 return {reply:'id_list_message=t-'+voice('v_ivr_members_input_limit',['לא נקלט ערך תקין לאחר ניסיונות רבים אנא התחילו שיחה חדשה'])};
}
export function shekelsToAgorot(value: string): number {
  // Yemot Price input translates asterisk into decimal point.
  if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(value)) throw new Error('invalid_amount');
  const [whole,fraction='']=value.split('.');
  return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function validDate(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('invalid_date');
  const date=new Date(value+'T00:00:00Z');
  if(!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw new Error('invalid_date');
  return value;
}







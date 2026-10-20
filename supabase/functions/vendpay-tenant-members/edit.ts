import {voice} from './voice.ts';
import {requestDate,CalendarInputError,hebrewSpoken,nextHebrewMonthStart} from './calendar.ts';
import {cleanName,shekelsToAgorot,validDate} from './flow.ts';
export class InputError extends Error {}
export function value(p:URLSearchParams,k:string){const a=p.getAll(k);if(a.length>1)throw new InputError(voice('v_69df783a48fe40fba8e7',["התקבל ערך כפול אנא התחילו שיחה חדשה"]));return a[0];}
export const safe=(v:unknown,limit=180)=>String(v??'').replace(/[&=.,\r\n<>]/g,' ').slice(0,limit);
export function ask(k:string,t:string,type='Digits',max='15',min='1'){return `read=t-${safe(t,2500)}=${[k,'',max,min,'30',type].join(',')}`;}
const FIELDS=[
 ['fname',voice('v_5b14528d53489c6d0fd6',["שם פרטי"]),'voice'],['lname',voice('v_8b24a82e72d04a3574d7',["שם משפחה"]),'voice'],['pel',voice('v_60f41a8b9293a184c5b2',["טלפון נייד"]),'phone'],['tel',voice('v_5a2c8c7c7cf641a68aa9',["טלפון נוסף"]),'phone'],
 ['email',voice('v_27810fcfc929e03968e1',["מייל"]),'email'],['card_number',voice('v_694b51cd66cc01976cf9',["מספר כרטיס"]),'card'],['card_value',voice('v_114263e73998b1ca26ec',["יתרה חדשה בשקלים"]),'money'],['restrict_id',voice('v_6839fb6b75a860d68192',["קבוצה"]),'group'],
 ['date_start',voice('v_ce928d02e92c74123139',["תאריך התחלה"]),'date'],['date_end',voice('v_898c40a2fa1c491cb3ba',["תאריך סיום"]),'date'],['is_active',voice('v_b8dae6aa839ece61ac77',["פעיל אחת או לא פעיל אפס"]),'active'],
 ['passport',voice('v_aff90f540383a8d0ec28',["תעודת זהות"]),'digits'],['address',voice('v_db77bdbaa65d80e03c92',["כתובת"]),'text'],['city',voice('v_3a880a5be1a73430cc01',["עיר"]),'text'],['zip',voice('v_aafe09292edc8ef884c7',["מיקוד"]),'digits'],
 ['date_birth',voice('v_3b1880a9baff778d3526',["תאריך לידה"]),'nullableDate'],['parent_id',voice('v_779544700fbfacd79624',["מזהה משתמש אב"]),'integer'],
 ['note1',voice('v_4739f8d9693acfe034d4',["הערה ראשונה"]),'text'],['note2',voice('v_b41f0d5d4ebd09349a81',["הערה שנייה"]),'text'],['note3',voice('v_b2ef62eb811dd21f2648',["הערה שלישית"]),'text'],['msg',voice('v_39b6f5befeed36a8cf92',["הודעה"]),'text'],
] as const;
export const PUT_FIELDS=['address','alert','card_media','card_number','city','created_by','created_on','customer_type','date_birth','date_end','date_start','debt','email','fname','id','is_active','is_finger','label','lname','msg','note1','note2','note3','parent_id','passport','pel','picture','restrict_id','tel','uuid','value_unusable','zip'];
export function payload(u:Record<string,any>){const out:Record<string,any>={};for(const k of PUT_FIELDS){if(!(k in u))throw Error('incomplete_user');out[k]=u[k];}if(!Number.isSafeInteger(Number(u.card_value))||Number(u.card_value)<0)throw Error('invalid_existing_balance');return {...out,cash_delta:Number(u.card_value),cash_do_mode:2,month_added:0};}
export function same(a:Record<string,any>,b:Record<string,any>){return [...PUT_FIELDS,'card_value'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));}
export function listData(d:any):Record<string,any>[]{if(!Array.isArray(d)||d.some(x=>!x||typeof x!=='object'||!('id'in x)||!('card_number'in x)))throw Error('invalid_list');return d;}
function date(v:string){if(!/^\d{8}$/.test(v))throw new InputError(voice('v_cb669c414166cb409bec',["יש להקיש תאריך בשמונה ספרות"]));try{return validDate(v.slice(4)+'-'+v.slice(2,4)+'-'+v.slice(0,2));}catch{throw new InputError(voice('v_7f05ce56039c3e027709',["התאריך אינו תקין"]));}}
function parse(v:string,type:string,groups:Record<string,string>){
 if(type==='voice')return cleanName(v);
 if(type==='money')return shekelsToAgorot(v);
 if(type==='date')return date(v);
 if(type==='nullableDate')return v==='0'?null:date(v);
 if(type==='active'){if(!/^[01]$/.test(v))throw Error();return Number(v);}
 if(type==='group'){if(!Object.hasOwn(groups,v))throw Error();return Number(v);}
 if(['card','integer'].includes(type)){if(!/^(0|[1-9]\d{0,14})$/.test(v)||(type==='card'&&v==='0'))throw Error();return Number(v);}
 if(v==='0')return '';
 if(type==='phone'&&!/^0\d{8,9}$/.test(v))throw Error();
 if(type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error();
 if(type==='digits'&&!/^\d{1,15}$/.test(v))throw Error();
 if(v.length>120||/[&=\r\n<>]/.test(v))throw Error();return v.trim();
}
function getField(p:URLSearchParams,key:string,label:string,type:string,groups:Record<string,string>):{reply:string}|{data:any}{
 if((type==='date'||type==='nullableDate')&&!p.has(key+'_0')){
  try{const date=requestDate(p,key,label,type==='nullableDate'?{value:null,label:voice('v_86f41142646544e4cb2a',["ללא תאריך"])}:undefined);return 'reply'in date?date:{data:date.iso};}
  catch(e){if(e instanceof CalendarInputError)throw new InputError(e.message);throw e;}
 }

 for(let n=0;n<3;n++){
 const k=key+'_'+n,raw=value(p,k);
 if(raw===undefined){
 if(type==='group')return {reply:ask(k,voice('v_3053e115b0444b358de6',["בחרו קבוצה "])+Object.entries(groups).map(([id,title])=>title+' '+id).join(' '),'Digits','10')};
 if(type==='voice')return {reply:`read=t-אמרו את ${label} או הקישו אחת להזנת אותיות=${k},,voice,he-IL,,1`};
 const keyboard=type==='text'?'HebrewKeyboard':type==='email'?'EmailKeyboard':type==='money'?'Price':'Digits';
 const max=type==='date'||type==='nullableDate'?'8':type==='phone'?'10':type==='text'||type==='email'?'120':'15';
 return {reply:ask(k,voice('v_612ca096b80d52493855',["הזינו ",String(label),"",String(type==='date'?' בשמונה ספרות יום חודש ושנה':type==='money'?' זוהי היתרה הסופית ולא סכום להוספה לאגורות הקישו כוכבית':['text','email','phone','digits','nullableDate'].includes(type)?' או אפס למחיקת הערך':''),""]),keyboard,max,type==='date'?'8':'1')};
 }
 let input=raw;
 if(type==='voice'&&raw.startsWith('Digits-')){const typed=value(p,k+'_typed');if(typed===undefined)return {reply:ask(k+'_typed',voice('v_4369ddba42aebc0e8ff9',["הקלידו ",String(label),""]),'HebrewKeyboard','60')};input=typed;}
 try{
 const parsed=parse(input,type,groups);
 if(type==='voice'){const ok=value(p,k+'_ok');if(ok===undefined)return {reply:ask(k+'_ok',voice('v_20c9a9d820eaff95c808',["נקלט ",String(safe(parsed))," לאישור אחת לתיקון שתיים"]),'NO','1')};if(ok!=='1')continue;}
 return {data:parsed};
 }catch{continue;}
 }
 throw new InputError(voice('v_e8b542f7d0b32b52a83e',["לא נקלט ערך תקין אנא התחילו שיחה חדשה"]));
}
export function editWizard(p:URLSearchParams,baseline:Record<string,any>,sessionTime:Date=new Date(),groups:Record<string,string>):{reply:string}|{draft:Record<string,any>,changes:Record<string,any>,cancelled:boolean,confirmed:boolean}{
 const who=safe(baseline.fname)+' '+safe(baseline.lname);
 const mode=value(p,'edit_mode');
 if(mode===undefined)return {reply:ask('edit_mode',voice('v_6f5d87119e6061183d32',["נמצא המשתמש ",String(who)," לשינוי תוקף בלבד הקישו אחת לעריכת פרטים הקישו שתיים לתוקף עד ראש חודש הבא הקישו שלוש לביטול הקישו אפס"]),'NO','1')};
 if(mode==='0')return {draft:baseline,changes:{},cancelled:true,confirmed:false};
 if(!['1','2','3'].includes(mode))throw new InputError(voice('v_929e6ded38747874f1ab',["בחירה לא תקינה אנא התחילו מחדש"]));
 const draft={...baseline},changes:Record<string,any>={};
 if(mode==='3'){
 draft.date_end=nextHebrewMonthStart(sessionTime);changes.date_end=draft.date_end;
 }else if(mode==='1'){
 const hasManual=[...p.keys()].some(k=>k.startsWith('expiry_')&&k!=='expiry_choice');
 const choice=value(p,'expiry_choice');
 if(!hasManual&&choice===undefined)return {reply:ask('expiry_choice',voice('v_45b662fb563f3b8409a4',["לתוקף עד ",String(hebrewSpoken(nextHebrewMonthStart(sessionTime)))," ראש חודש הבא הקישו אחת להזנת תאריך אחר הקישו שתיים"]),'NO','1')};
 if(!hasManual&&choice==='1'){draft.date_end=nextHebrewMonthStart(sessionTime);changes.date_end=draft.date_end;}
 else {
 if(!hasManual&&choice!=='2')throw new InputError(voice('v_5b170aa597c6e87e2f79',["בחירה לא תקינה"]));
 const f=getField(p,'expiry',voice('v_3999efd4496c646313d3',["תאריך סיום חדש"]),'date',groups);if('reply'in f)return f;draft.date_end=f.data;changes.date_end=f.data;
 }
 }else{
 let done=false;
 for(let step=0;step<25;step++){
 const k=`edit_${step}`;
 const category=value(p,k+'_category');
 if(category===undefined)return {reply:ask(k+'_category',voice('v_56c0e45fe05928ef6437',["לשם וטלפונים אחת לכרטיס יתרה וקבוצה שתיים לתאריכים שלוש לפרטי קשר נוספים ארבע להערות חמש לסיום ושמירה אפס לביטול תשעים ותשע"]),'NO','2')};
 if(category==='0'){done=true;break;}
 if(category==='99')return {draft,changes,cancelled:true,confirmed:false};
 const categories:Record<string,number[]>={'1':[1,2,3,4],'2':[6,7,8,11,17],'3':[9,10,16],'4':[5,12,13,14,15],'5':[18,19,20,21]};
 const allowed=categories[category];if(!allowed)throw new InputError(voice('v_5b170aa597c6e87e2f79',["בחירה לא תקינה"]));
 const choice=value(p,k+'_field');
 if(choice===undefined){
 const menu=allowed.map(n=>`${FIELDS[n-1][1]} ${n}`).join(' ');
 return {reply:ask(k+'_field',voice('v_953ff9d44aef217e891e',["בחרו שדה לשינוי ",String(menu)," לסיום ושמירה אפס לביטול תשעים ותשע"]),'NO','2')};
 }
 if(choice==='99')return {draft,changes,cancelled:true,confirmed:false};
 if(choice==='0'){done=true;break;}
 const index=Number(choice)-1;if(!/^\d{1,2}$/.test(choice)||index<0||index>=FIELDS.length||!allowed.includes(index+1))throw new InputError(voice('v_a1ccedcaff483b08101b',["בחירת שדה לא תקינה"]));
 const [field,label,type]=FIELDS[index];const f=getField(p,k+'_value',label,type,groups);if('reply'in f)return f;
 draft[field]=f.data;changes[field]=f.data;
 }
 if(!done)throw new InputError(voice('v_a91127b817af56404aad',["הגעתם למספר השינויים המרבי התחילו מחדש"]));
 }
 if(draft.date_start&&draft.date_end&&String(draft.date_end).slice(0,10)<String(draft.date_start).slice(0,10))throw new InputError(voice('v_afe6617bc332a847c045',["תאריך הסיום מוקדם מתאריך ההתחלה"]));
 const actual=Object.fromEntries(Object.entries(changes).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(baseline[k])));
 if(!Object.keys(actual).length)return {draft,changes:actual,cancelled:true,confirmed:false};
 const confirm=value(p,'edit_save');
 if(confirm===undefined){
 const summary=Object.entries(actual).map(([k,v])=>{
 const label=FIELDS.find(x=>x[0]===k)?.[1]||k;
 const spoken=k==='card_value'?voice('v_0b2544a63e48cbddfef2',["",String(Math.floor(Number(v)/100))," שקלים ו ",String(Number(v)%100)," אגורות"]):v===null||v===''?voice('v_955b039c66858e00c2ad',["ריק"]):['date_start','date_end','date_birth'].includes(k)?hebrewSpoken(String(v)):safe(v).replaceAll('-',' ');
 return `${label} ${spoken}`;
 }).join(' ');
 return {reply:ask('edit_save',voice('v_70f0da2758d1677e6d45',["עדכון ",String(who)," ",String(summary)," לשמירה הקישו אחת לביטול שתיים"]),'NO','1')};
 }
 if(!['1','2'].includes(confirm))throw new InputError(voice('v_82c5768b6af0289d23d2',["אישור לא תקין"]));
 return {draft,changes:actual,cancelled:confirm==='2',confirmed:confirm==='1'};
}





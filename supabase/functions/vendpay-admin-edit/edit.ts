import {voice} from './voice.ts';
import {requestDate,CalendarInputError,hebrewSpoken,nextHebrewMonthStart} from './calendar.ts';
import {cleanName,shekelsToAgorot,validDate} from './flow.ts';
export class InputError extends Error {}
export function value(p:URLSearchParams,k:string){const a=p.getAll(k);if(a.length>1)throw new InputError(voice('v_1bea7b92d35918dae57c',["התקבל ערך כפול אנא התחילו שיחה חדשה"]));return a[0];}
export const safe=(v:unknown,limit=180)=>String(v??'').replace(/[&=.,\r\n<>]/g,' ').slice(0,limit);
export function ask(k:string,t:string,type='Digits',max='15',min='1'){return `read=t-${safe(t,2500)}=${[k,'',max,min,'30',type].join(',')}`;}
const FIELDS=[
 ['fname',voice('v_745ffa3df4473ed2dfab',["שם פרטי"]),'voice'],['lname',voice('v_14fa034f50fd4bdb84a8',["שם משפחה"]),'voice'],['pel',voice('v_fd073911bfd52c6dea1f',["טלפון נייד"]),'phone'],['tel',voice('v_8b71c307a4698a441736',["טלפון נוסף"]),'phone'],
 ['email',voice('v_a0fec675da68726f1cc8',["מייל"]),'email'],['card_number',voice('v_d6fe14bd9649193964c1',["מספר כרטיס"]),'card'],['card_value',voice('v_4378749866d46848f69b',["יתרה חדשה בשקלים"]),'money'],['restrict_id',voice('v_2d77cadb1176819afbb2',["קבוצה"]),'group'],
 ['date_start',voice('v_47219203b0ae7bc5890f',["תאריך התחלה"]),'date'],['date_end',voice('v_e2ef5fa9413746b9e767',["תאריך סיום"]),'date'],['is_active',voice('v_9294b892fb2819185472',["פעיל אחת או לא פעיל אפס"]),'active'],
 ['passport',voice('v_e013bdccd072f06caa82',["תעודת זהות"]),'digits'],['address',voice('v_9e6c31d5c725ebbe4ad1',["כתובת"]),'text'],['city',voice('v_baa7d8fba5e52939e173',["עיר"]),'text'],['zip',voice('v_0d5606df000ea2a455d3',["מיקוד"]),'digits'],
 ['date_birth',voice('v_cf9df1472c532e4654c8',["תאריך לידה"]),'nullableDate'],['parent_id',voice('v_768c27d60c27692245b5',["מזהה משתמש אב"]),'integer'],
 ['note1',voice('v_5c2f039c11a62233d08a',["הערה ראשונה"]),'text'],['note2',voice('v_ba746b5524ba21ab6ab2',["הערה שנייה"]),'text'],['note3',voice('v_20e9c107e45558458ff2',["הערה שלישית"]),'text'],['msg',voice('v_4827395b1b89431bce54',["הודעה"]),'text'],
] as const;
export const PUT_FIELDS=['address','alert','card_media','card_number','city','created_by','created_on','customer_type','date_birth','date_end','date_start','debt','email','fname','id','is_active','is_finger','label','lname','msg','note1','note2','note3','parent_id','passport','pel','picture','restrict_id','tel','uuid','value_unusable','zip'];
export function payload(u:Record<string,any>){const out:Record<string,any>={};for(const k of PUT_FIELDS){if(!(k in u))throw Error('incomplete_user');out[k]=u[k];}if(!Number.isSafeInteger(Number(u.card_value))||Number(u.card_value)<0)throw Error('invalid_existing_balance');return {...out,cash_delta:Number(u.card_value),cash_do_mode:2,month_added:0};}
export function same(a:Record<string,any>,b:Record<string,any>){return [...PUT_FIELDS,'card_value'].every(k=>JSON.stringify(a[k])===JSON.stringify(b[k]));}
export function listData(d:any):Record<string,any>[]{if(!Array.isArray(d)||d.some(x=>!x||typeof x!=='object'||!('id'in x)||!('card_number'in x)))throw Error('invalid_list');return d;}
function date(v:string){if(!/^\d{8}$/.test(v))throw new InputError(voice('v_ebf74e5b3156f192729c',["יש להקיש תאריך בשמונה ספרות"]));try{return validDate(v.slice(4)+'-'+v.slice(2,4)+'-'+v.slice(0,2));}catch{throw new InputError(voice('v_32020baeda32fb033e8e',["התאריך אינו תקין"]));}}
function parse(v:string,type:string){
 if(type==='voice')return cleanName(v);
 if(type==='money')return shekelsToAgorot(v);
 if(type==='date')return date(v);
 if(type==='nullableDate')return v==='0'?null:date(v);
 if(type==='active'){if(!/^[01]$/.test(v))throw Error();return Number(v);}
 if(type==='group'){if(!/^[1-5789]$/.test(v))throw Error();return Number(v);}
 if(['card','integer'].includes(type)){if(!/^(0|[1-9]\d{0,14})$/.test(v)||(type==='card'&&v==='0'))throw Error();return Number(v);}
 if(v==='0')return '';
 if(type==='phone'&&!/^0\d{8,9}$/.test(v))throw Error();
 if(type==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))throw Error();
 if(type==='digits'&&!/^\d{1,15}$/.test(v))throw Error();
 if(v.length>120||/[&=\r\n<>]/.test(v))throw Error();return v.trim();
}
function getField(p:URLSearchParams,key:string,label:string,type:string):{reply:string}|{data:any}{
 if((type==='date'||type==='nullableDate')&&!p.has(key+'_0')){
  try{const date=requestDate(p,key,label,type==='nullableDate'?{value:null,label:voice('v_580fa5651862daaa0993',["ללא תאריך"])}:undefined);return 'reply'in date?date:{data:date.iso};}
  catch(e){if(e instanceof CalendarInputError)throw new InputError(e.message);throw e;}
 }

 for(let n=0;n<3;n++){
 const k=key+'_'+n,raw=value(p,k);
 if(raw===undefined){
 if(type==='voice')return {reply:`read=t-אמרו את ${label} או הקישו אחת להזנת אותיות=${k},,voice,he-IL,,1`};
 const keyboard=type==='text'?'HebrewKeyboard':type==='email'?'EmailKeyboard':type==='money'?'Price':'Digits';
 const max=type==='date'||type==='nullableDate'?'8':type==='phone'?'10':type==='text'||type==='email'?'120':'15';
 return {reply:ask(k,voice('v_fb134df906f1f9b00e99',["הזינו ",String(label),"",String(type==='date'?' בשמונה ספרות יום חודש ושנה':type==='money'?' זוהי היתרה הסופית ולא סכום להוספה לאגורות הקישו כוכבית':['text','email','phone','digits','nullableDate'].includes(type)?' או אפס למחיקת הערך':''),""]),keyboard,max,type==='date'?'8':'1')};
 }
 let input=raw;
 if(type==='voice'&&raw.startsWith('Digits-')){const typed=value(p,k+'_typed');if(typed===undefined)return {reply:ask(k+'_typed',voice('v_d8b8b194744d7e890c29',["הקלידו ",String(label),""]),'HebrewKeyboard','60')};input=typed;}
 try{
 const parsed=parse(input,type);
 if(type==='voice'){const ok=value(p,k+'_ok');if(ok===undefined)return {reply:ask(k+'_ok',voice('v_f37ca8aba841d3d4ca01',["נקלט ",String(safe(parsed))," לאישור אחת לתיקון שתיים"]),'NO','1')};if(ok!=='1')continue;}
 return {data:parsed};
 }catch{continue;}
 }
 throw new InputError(voice('v_a69e7c138adf4e8b1400',["לא נקלט ערך תקין אנא התחילו שיחה חדשה"]));
}
export function editWizard(p:URLSearchParams,baseline:Record<string,any>,sessionTime:Date=new Date()):{reply:string}|{draft:Record<string,any>,changes:Record<string,any>,cancelled:boolean,confirmed:boolean}{
 const who=safe(baseline.fname)+' '+safe(baseline.lname);
 const mode=value(p,'edit_mode');
 if(mode===undefined)return {reply:ask('edit_mode',voice('v_c0469babf5ce58caa5b7',["נמצא המשתמש ",String(who)," לשינוי תוקף בלבד הקישו אחת לעריכת פרטים הקישו שתיים לתוקף עד ראש חודש הבא הקישו שלוש לביטול הקישו אפס"]),'NO','1')};
 if(mode==='0')return {draft:baseline,changes:{},cancelled:true,confirmed:false};
 if(!['1','2','3'].includes(mode))throw new InputError(voice('v_8dad437cafcb8d44d7a1',["בחירה לא תקינה אנא התחילו מחדש"]));
 const draft={...baseline},changes:Record<string,any>={};
 if(mode==='3'){
 draft.date_end=nextHebrewMonthStart(sessionTime);changes.date_end=draft.date_end;
 }else if(mode==='1'){
 const hasManual=[...p.keys()].some(k=>k.startsWith('expiry_')&&k!=='expiry_choice');
 const choice=value(p,'expiry_choice');
 if(!hasManual&&choice===undefined)return {reply:ask('expiry_choice',voice('v_60d276dfb3ac63a144da',["לתוקף עד ",String(hebrewSpoken(nextHebrewMonthStart(sessionTime)))," ראש חודש הבא הקישו אחת להזנת תאריך אחר הקישו שתיים"]),'NO','1')};
 if(!hasManual&&choice==='1'){draft.date_end=nextHebrewMonthStart(sessionTime);changes.date_end=draft.date_end;}
 else {
 if(!hasManual&&choice!=='2')throw new InputError(voice('v_bdd086a6cec30eb23e61',["בחירה לא תקינה"]));
 const f=getField(p,'expiry',voice('v_78336bdb8e982874c2ae',["תאריך סיום חדש"]),'date');if('reply'in f)return f;draft.date_end=f.data;changes.date_end=f.data;
 }
 }else{
 let done=false;
 for(let step=0;step<25;step++){
 const k=`edit_${step}`;
 const category=value(p,k+'_category');
 if(category===undefined)return {reply:ask(k+'_category',voice('v_97e649b8c4a1e3b9b298',["לשם וטלפונים אחת לכרטיס יתרה וקבוצה שתיים לתאריכים שלוש לפרטי קשר נוספים ארבע להערות חמש לסיום ושמירה אפס לביטול תשעים ותשע"]),'NO','2')};
 if(category==='0'){done=true;break;}
 if(category==='99')return {draft,changes,cancelled:true,confirmed:false};
 const categories:Record<string,number[]>={'1':[1,2,3,4],'2':[6,7,8,11,17],'3':[9,10,16],'4':[5,12,13,14,15],'5':[18,19,20,21]};
 const allowed=categories[category];if(!allowed)throw new InputError(voice('v_bdd086a6cec30eb23e61',["בחירה לא תקינה"]));
 const choice=value(p,k+'_field');
 if(choice===undefined){
 const menu=allowed.map(n=>`${FIELDS[n-1][1]} ${n}`).join(' ');
 return {reply:ask(k+'_field',voice('v_7f83fe1cc6c0184ab000',["בחרו שדה לשינוי ",String(menu)," לסיום ושמירה אפס לביטול תשעים ותשע"]),'NO','2')};
 }
 if(choice==='99')return {draft,changes,cancelled:true,confirmed:false};
 if(choice==='0'){done=true;break;}
 const index=Number(choice)-1;if(!/^\d{1,2}$/.test(choice)||index<0||index>=FIELDS.length||!allowed.includes(index+1))throw new InputError(voice('v_4b2a64b73ed0eeff690b',["בחירת שדה לא תקינה"]));
 const [field,label,type]=FIELDS[index];const f=getField(p,k+'_value',label,type);if('reply'in f)return f;
 draft[field]=f.data;changes[field]=f.data;
 }
 if(!done)throw new InputError(voice('v_51793cdfbe0dd9d15c8c',["הגעתם למספר השינויים המרבי התחילו מחדש"]));
 }
 if(draft.date_start&&draft.date_end&&String(draft.date_end).slice(0,10)<String(draft.date_start).slice(0,10))throw new InputError(voice('v_9d3d66b415d094678af1',["תאריך הסיום מוקדם מתאריך ההתחלה"]));
 const actual=Object.fromEntries(Object.entries(changes).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(baseline[k])));
 if(!Object.keys(actual).length)return {draft,changes:actual,cancelled:true,confirmed:false};
 const confirm=value(p,'edit_save');
 if(confirm===undefined){
 const summary=Object.entries(actual).map(([k,v])=>{
 const label=FIELDS.find(x=>x[0]===k)?.[1]||k;
 const spoken=k==='card_value'?voice('v_a6ff79e7316df65fc990',["",String(Math.floor(Number(v)/100))," שקלים ו ",String(Number(v)%100)," אגורות"]):v===null||v===''?voice('v_1022872be8c34cebef13',["ריק"]):['date_start','date_end','date_birth'].includes(k)?hebrewSpoken(String(v)):safe(v).replaceAll('-',' ');
 return `${label} ${spoken}`;
 }).join(' ');
 return {reply:ask('edit_save',voice('v_cbfa3f6851dfbe8412a1',["עדכון ",String(who)," ",String(summary)," לשמירה הקישו אחת לביטול שתיים"]),'NO','1')};
 }
 if(!['1','2'].includes(confirm))throw new InputError(voice('v_efc884beefe02d55e594',["אישור לא תקין"]));
 return {draft,changes:actual,cancelled:confirm==='2',confirmed:confirm==='1'};
}




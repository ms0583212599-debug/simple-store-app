import {retryField} from './retry.ts';
import {voice} from './voice.ts';
// Native ICU Hebrew calendar; no network calls or external runtime dependencies.
const formatter=new Intl.DateTimeFormat('he-IL-u-ca-hebrew',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'});
const gregorian=new Intl.DateTimeFormat('he-IL-u-ca-gregory',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'});
const DAY=86400000;
type Month={name:string,days:Map<number,string>};
const cache=new Map<number,Month[]>();
export class CalendarInputError extends Error {}
function parts(date:Date){if(formatter.resolvedOptions().calendar!=='hebrew')throw Error('hebrew_calendar_unavailable');const p=formatter.formatToParts(date);return {year:Number(p.find(x=>x.type==='year')?.value),month:p.find(x=>x.type==='month')?.value||'',day:Number(p.find(x=>x.type==='day')?.value)};}
export function yearMonths(year:number):Month[]{
 if(!Number.isInteger(year)||year<5600||year>5900)throw new CalendarInputError(voice('v_a7900a4491dad0664c2d',["שנה מחוץ לטווח הנתמך"]));
 const previous=cache.get(year);if(previous)return previous;
 const months:Month[]=[];
 for(let t=Date.UTC(year-3761,7,1,12);t<Date.UTC(year-3760,10,1,12);t+=DAY){const d=new Date(t),p=parts(d);if(p.year!==year)continue;let m=months[months.length-1];if(!m||m.name!==p.month){m={name:p.month,days:new Map()};months.push(m);}m.days.set(p.day,d.toISOString().slice(0,10));}
 if(![12,13].includes(months.length)||months.some(m=>![29,30].includes(m.days.size)))throw Error('hebrew_calendar_incomplete');
 if(cache.size>=4)cache.delete(cache.keys().next().value!);cache.set(year,months);return months;
}
export function hebrewToISO(year:number,month:number,day:number){const iso=yearMonths(year)[month-1]?.days.get(day);if(!iso)throw new CalendarInputError(voice('v_7c67d85d21f600a41ad2',["התאריך אינו קיים בשנה שנבחרה"]));return iso;}
export function isoValid(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new CalendarInputError(voice('v_f8652b6e6114517aee89',["תאריך לא תקין"]));const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw new CalendarInputError(voice('v_f8652b6e6114517aee89',["תאריך לא תקין"]));return value;}
export function hebrewSpoken(iso:string){const p=parts(new Date(isoValid(iso)+'T12:00:00Z'));return voice('v_5d0bdfe8578641a91a40',["",String(p.day)," ב",String(p.month.replace('א׳','אלף').replace('ב׳','בית'))," ",String(p.year),""]);}
export function gregorianSpoken(iso:string){return gregorian.format(new Date(isoValid(iso)+'T12:00:00Z'));}
function get(p:URLSearchParams,k:string){const a=p.getAll(k);if(a.length>1)throw new CalendarInputError(voice('v_084531d2dee18a9fe2c7',["נתון כפול התחילו שיחה חדשה"]));return a[0];}
function read(k:string,text:string,max:string,min='1'){return {reply:`read=t-${text}=${[k,'',max,min,'30','NO','','','','','','','','','no'].join(',')}`};}
export function requestDate(p:URLSearchParams,prefix:string,label:string,optional?:{value:string|null,label:string},minimum?:string):{reply:string}|{iso:string|null}{
 for(let attempt=0;attempt<20;attempt++){
  const k=prefix+'_cal_'+attempt;
  const y=retryField(p,k+'_year',key=>read(key,voice('v_ivr_members_date_year_prompt',['',String(attempt?'התאריך לא אושר או אינו תקין ':''),'',label,' הקישו שנה עברית בארבע ספרות לתאריך לועזי הקישו אפס',String(optional?' '+optional.label+' הקישו אחת':''),'']),'4').reply,v=>{if(v==='0'||(v==='1'&&optional))return v;if(!/^\d{4}$/.test(v)||Number(v)<5600||Number(v)>5900)throw Error();return v;});
  if('reply'in y)return y;const year=y.data;let iso:string|null;
  if(year==='1'&&optional)iso=optional.value;
  else if(year==='0'){
   const g=retryField(p,k+'_gregorian',key=>read(key,voice('v_ivr_members_date_gregorian',['הקישו תאריך לועזי בשמונה ספרות יום חודש ושנה']),'8','8').reply,v=>{if(!/^\d{8}$/.test(v))throw Error();const d=isoValid(v.slice(4)+'-'+v.slice(2,4)+'-'+v.slice(0,2));if(minimum&&d<minimum)throw Error();return d;});
   if('reply'in g)return g;iso=g.data;
  }else{
   const months=yearMonths(Number(year));const menu=months.map((m,i)=>m.name.replace('א׳','אלף').replace('ב׳','בית')+' '+(i+1)).join(' ');
   const m=retryField(p,k+'_month',key=>read(key,voice('v_ivr_members_date_month',['בחרו חודש ',menu,'']),'2').reply,v=>{if(!/^\d{1,2}$/.test(v)||Number(v)<1||Number(v)>months.length)throw Error();return Number(v);});
   if('reply'in m)return m;
   const d=retryField(p,k+'_day',key=>read(key,voice('v_ivr_members_date_day',['הקישו את היום בחודש']),'2').reply,v=>{if(!/^\d{1,2}$/.test(v))throw Error();return hebrewToISO(Number(year),m.data,Number(v));});
   if('reply'in d)return d;iso=d.data;
  }
  if(minimum&&iso&&iso<minimum)continue;
  const desc=iso===null?'ללא תאריך':hebrewSpoken(iso)+' ובתאריך הלועזי '+gregorianSpoken(iso);
  const ok=retryField(p,k+'_ok',key=>read(key,voice('v_ivr_members_date_confirm',['',label,' ',desc,' לאישור אחת לתיקון שתיים']),'1').reply,v=>{if(!['1','2'].includes(v))throw Error();return v;});
  if('reply'in ok)return ok;if(ok.data==='1')return {iso};
 }
 return {reply:'id_list_message=t-'+voice('v_ivr_members_input_limit',['לא נקלט ערך תקין לאחר ניסיונות רבים אנא התחילו שיחה חדשה'])};
}

// Anchor to the session creation time so a call crossing midnight keeps its proposal.
export function nextHebrewMonthStart(now:Date):string {
 const fields=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const field=(k:string)=>fields.find(x=>x.type===k)!.value;
 const civil=isoValid(`${field('year')}-${field('month')}-${field('day')}`);
 const start=new Date(civil+'T12:00:00Z').getTime();
 for(let n=1;n<=30;n++){const d=new Date(start+n*DAY);if(parts(d).day===1)return d.toISOString().slice(0,10);}
 throw Error('next_hebrew_month_not_found');
}




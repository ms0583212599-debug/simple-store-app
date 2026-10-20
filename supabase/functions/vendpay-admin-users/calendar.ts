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
 if(!Number.isInteger(year)||year<5600||year>5900)throw new CalendarInputError(voice('v_64a15c61497bca3ad4ba',["שנה מחוץ לטווח הנתמך"]));
 const previous=cache.get(year);if(previous)return previous;
 const months:Month[]=[];
 for(let t=Date.UTC(year-3761,7,1,12);t<Date.UTC(year-3760,10,1,12);t+=DAY){const d=new Date(t),p=parts(d);if(p.year!==year)continue;let m=months[months.length-1];if(!m||m.name!==p.month){m={name:p.month,days:new Map()};months.push(m);}m.days.set(p.day,d.toISOString().slice(0,10));}
 if(![12,13].includes(months.length)||months.some(m=>![29,30].includes(m.days.size)))throw Error('hebrew_calendar_incomplete');
 if(cache.size>=4)cache.delete(cache.keys().next().value!);cache.set(year,months);return months;
}
export function hebrewToISO(year:number,month:number,day:number){const iso=yearMonths(year)[month-1]?.days.get(day);if(!iso)throw new CalendarInputError(voice('v_80460bf0458635931fe7',["התאריך אינו קיים בשנה שנבחרה"]));return iso;}
export function isoValid(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new CalendarInputError(voice('v_9debee53cb6567f3df09',["תאריך לא תקין"]));const d=new Date(value+'T12:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw new CalendarInputError(voice('v_9debee53cb6567f3df09',["תאריך לא תקין"]));return value;}
export function hebrewSpoken(iso:string){const p=parts(new Date(isoValid(iso)+'T12:00:00Z'));return voice('v_1def310272701fdc440f',["",String(p.day)," ב",String(p.month.replace('א׳','אלף').replace('ב׳','בית'))," ",String(p.year),""]);}
export function gregorianSpoken(iso:string){return gregorian.format(new Date(isoValid(iso)+'T12:00:00Z'));}
function get(p:URLSearchParams,k:string){const a=p.getAll(k);if(a.length>1)throw new CalendarInputError(voice('v_009832491ab8b013da98',["נתון כפול התחילו שיחה חדשה"]));return a[0];}
function read(k:string,text:string,max:string,min='1'){return {reply:`read=t-${text}=${[k,'',max,min,'30','NO','','','','','','','','','no'].join(',')}`};}
export function requestDate(p:URLSearchParams,prefix:string,label:string,optional?:{value:string|null,label:string}):{reply:string}|{iso:string|null}{
 for(let attempt=0;attempt<3;attempt++){
 const k=prefix+'_cal_'+attempt;
 const year=get(p,k+'_year');
 if(year===undefined)return read(k+'_year',voice('v_adb80752d44deeebbcae',["",String(attempt?'התאריך לא אושר או אינו תקין ':''),"",String(label)," הקישו שנה עברית בארבע ספרות לתאריך לועזי הקישו אפס",String(optional?' '+optional.label+' הקישו אחת':''),""]),'4');
 let iso:string|null;
 if(year==='1'&&optional)iso=optional.value;
 else if(year==='0'){
 const raw=get(p,k+'_gregorian');if(raw===undefined)return read(k+'_gregorian',voice('v_048d57466e20f2c55a11',["הקישו תאריך לועזי בשמונה ספרות יום חודש ושנה"]),'8','8');
 try{if(!/^\d{8}$/.test(raw))throw Error();iso=isoValid(raw.slice(4)+'-'+raw.slice(2,4)+'-'+raw.slice(0,2));}catch{continue;}
 }else{
 if(!/^\d{4}$/.test(year)||Number(year)<5600||Number(year)>5900)continue;
 const months=yearMonths(Number(year));const month=get(p,k+'_month');
 if(month===undefined){const menu=months.map((m,i)=>`${m.name.replace(voice('v_fd2de01f66bec0d93e49',["א׳"]),voice('v_66692d1de516d3b33f6f',["אלף"])).replace(voice('v_e65ae84898b62dfbeb34',["ב׳"]),voice('v_58dcefb377ee5bd7ec5c',["בית"]))} ${i+1}`).join(' ');return read(k+'_month',voice('v_e5e8928850677e6c3ab6',["בחרו חודש "])+menu,'2');}
 if(!/^\d{1,2}$/.test(month)||Number(month)<1||Number(month)>months.length)continue;
 const day=get(p,k+'_day');if(day===undefined)return read(k+'_day',voice('v_f6426ae8aab5d50377f1',["הקישו את היום בחודש"]),'2');
 try{if(!/^\d{1,2}$/.test(day))throw Error();iso=hebrewToISO(Number(year),Number(month),Number(day));}catch{continue;}
 }
 const confirmation=get(p,k+'_ok');
 if(confirmation===undefined){const desc=iso===null?voice('v_50e6db8a35e4468b2cf4',["ללא תאריך"]):voice('v_ef8ecf0ee0b0836558fe',["",String(hebrewSpoken(iso))," ובתאריך הלועזי ",String(gregorianSpoken(iso)),""]);return read(k+'_ok',voice('v_8e459e4dc6fdda466012',["",String(label)," ",String(desc)," לאישור אחת לתיקון שתיים"]),'1');}
 if(confirmation==='1')return {iso};
 }
 throw new CalendarInputError(voice('v_a7a6f14c1567e0c54bbd',["לא אושר תאריך תקין התחילו שיחה חדשה"]));
}


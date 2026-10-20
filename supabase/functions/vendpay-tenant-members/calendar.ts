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
export function requestDate(p:URLSearchParams,prefix:string,label:string,optional?:{value:string|null,label:string}):{reply:string}|{iso:string|null}{
 for(let attempt=0;attempt<3;attempt++){
 const k=prefix+'_cal_'+attempt;
 const year=get(p,k+'_year');
 if(year===undefined)return read(k+'_year',voice('v_5b6a50431638b926c14d',["",String(attempt?'התאריך לא אושר או אינו תקין ':''),"",String(label)," הקישו שנה עברית בארבע ספרות לתאריך לועזי הקישו אפס",String(optional?' '+optional.label+' הקישו אחת':''),""]),'4');
 let iso:string|null;
 if(year==='1'&&optional)iso=optional.value;
 else if(year==='0'){
 const raw=get(p,k+'_gregorian');if(raw===undefined)return read(k+'_gregorian',voice('v_e875b55517d9574311f6',["הקישו תאריך לועזי בשמונה ספרות יום חודש ושנה"]),'8','8');
 try{if(!/^\d{8}$/.test(raw))throw Error();iso=isoValid(raw.slice(4)+'-'+raw.slice(2,4)+'-'+raw.slice(0,2));}catch{continue;}
 }else{
 if(!/^\d{4}$/.test(year)||Number(year)<5600||Number(year)>5900)continue;
 const months=yearMonths(Number(year));const month=get(p,k+'_month');
 if(month===undefined){const menu=months.map((m,i)=>`${m.name.replace(voice('v_dfd418f5840e790d8fd7',["א׳"]),voice('v_7100883af3c81e50f5a9',["אלף"])).replace(voice('v_36ca0c701ef94444c9b6',["ב׳"]),voice('v_c492ffeb737c57f658d7',["בית"]))} ${i+1}`).join(' ');return read(k+'_month',voice('v_4faed17f26d2b68b4776',["בחרו חודש "])+menu,'2');}
 if(!/^\d{1,2}$/.test(month)||Number(month)<1||Number(month)>months.length)continue;
 const day=get(p,k+'_day');if(day===undefined)return read(k+'_day',voice('v_4cf8b93a6b3cb5bfa0d0',["הקישו את היום בחודש"]),'2');
 try{if(!/^\d{1,2}$/.test(day))throw Error();iso=hebrewToISO(Number(year),Number(month),Number(day));}catch{continue;}
 }
 const confirmation=get(p,k+'_ok');
 if(confirmation===undefined){const desc=iso===null?voice('v_56abc4d2a8068ac327f0',["ללא תאריך"]):voice('v_6f0afdc6ab65ad9c4fd5',["",String(hebrewSpoken(iso))," ובתאריך הלועזי ",String(gregorianSpoken(iso)),""]);return read(k+'_ok',voice('v_9c45988d4379cc867c31',["",String(label)," ",String(desc)," לאישור אחת לתיקון שתיים"]),'1');}
 if(confirmation==='1')return {iso};
 }
 throw new CalendarInputError(voice('v_af8e855251f79e695016',["לא אושר תאריך תקין התחילו שיחה חדשה"]));
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



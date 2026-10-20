import {voice} from './voice.ts';
const MENU=voice('v_53301a01b937773ce467',["לכל הלקוחות הקישו אחת לכרטיסים בתוקף שתיים למנוי רגיל בתוקף שלוש למנוי מורחב בתוקף ארבע לאחראי בתוקף חמש לפגי תוקף שש לתוקף שמסתיים בשבעת הימים הקרובים שבע לכרטיסים לא פעילים שמונה לרשומות ללא תאריך תוקף תקין תשע לסיום אפס"]);
const ask=(key:string,text:string)=>`read=t-${text}=${[key,'','1','1','30','Digits'].join(',')}`;
export const summaryIntro=()=>ask('summary_0',MENU);
function date(v:unknown){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(v))return null;const s=v.slice(0,10),d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:null;}
const normalize=(s:string)=>s.normalize('NFC').trim().replace(/\s+/g,' ');
export function counts(data:any,rawGroups:any,now=new Date()){
 if(!Array.isArray(data)||data.some(u=>!u||!Number.isSafeInteger(Number(u.id))||Number(u.id)<=0)||new Set(data.map(u=>String(u.id))).size!==data.length)throw Error('invalid_users');
 const groups=Array.isArray(rawGroups)?rawGroups:rawGroups?.data;if(!Array.isArray(groups)||groups.some(g=>!g||typeof g.title!=='string'||!Number.isSafeInteger(Number(g.id))))throw Error('invalid_groups');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=(t:string)=>parts.find(x=>x.type===t)!.value;const today=get('year')+'-'+get('month')+'-'+get('day');
 const endWeek=new Date(Date.parse(today+'T12:00:00Z')+6*86400000).toISOString().slice(0,10);
 const active=(u:any)=>u.is_active===1||u.is_active===true||u.is_active==='1';
 const valid=(u:any)=>{const end=date(u.date_end);const start=date(u.date_start);return active(u)&&!!end&&end>=today&&((u.date_start==null||u.date_start==='')||!!start&&start<=today);};
 const current=data.filter(valid);
 const byGroup=(name:string)=>{const ids=new Set(groups.filter(g=>normalize(g.title)===name).map(g=>String(g.id)));return ids.size?current.filter(u=>ids.has(String(u.restrict_id))).length:null;};
 return {total:data.length,valid:current.length,regular:byGroup(voice('v_410190ad963b7c3b3567',["מנוי רגיל"])),extended:byGroup(voice('v_0ed292ca00f3d56fc3b8',["מנוי מורחב"])),responsible:byGroup(voice('v_cae8655af8e879ced503',["אחראי"])),expired:data.filter(u=>{const e=date(u.date_end);return e&&e<today}).length,expiring:current.filter(u=>date(u.date_end)!<=endWeek).length,inactive:data.filter(u=>u.is_active===0||u.is_active===false||u.is_active==='0').length,unknown:data.filter(u=>!date(u.date_end)).length};
}
export function summaryReply(p:URLSearchParams,data:any,groups:any,now=new Date()){
 const c=counts(data,groups,now);const missing=voice('v_d953c770ee58b1e73cfc',["לא נמצאה בחשבון קבוצה בשם הזה"]);
 const say:Record<string,string>={
 '1':voice('v_0b572e50673ee2ff6c07',["מספר הלקוחות הכולל ",String(c.total),""]),
 '2':voice('v_4c94bab7b55c06c3bc89',["מספר הכרטיסים הפעילים שבתוקף היום ",String(c.valid),""]),
 '3':c.regular===null?missing:voice('v_3335c3a600c83890062e',["מספר מנויי רגיל בתוקף ",String(c.regular),""]),
 '4':c.extended===null?missing:voice('v_565632b5756b75848010',["מספר מנויי מורחב בתוקף ",String(c.extended),""]),
 '5':c.responsible===null?missing:voice('v_450e12138075346015bb',["מספר אחראים בתוקף ",String(c.responsible),""]),
 '6':voice('v_b57c08ccc7e97584d283',["מספר הלקוחות שתאריך תוקפם חלף ",String(c.expired),""]),
 '7':voice('v_6ae2ac9cf36087fbae6e',["מספר הכרטיסים הפעילים שתוקפם מסתיים בשבעת הימים הקרובים כולל היום ",String(c.expiring),""]),
 '8':voice('v_252bde913179c80a2bd5',["מספר הכרטיסים הלא פעילים ",String(c.inactive),""]),
 '9':voice('v_cb6e1c83d0e6131bf681',["מספר הרשומות ללא תאריך סיום תקין ",String(c.unknown)," רשומות אלה לא נספרות ככרטיסים בתוקף"])};
 let last='';for(let i=0;i<20;i++){const a=p.getAll('summary_'+i);if(a.length>1)throw Error('duplicate');const v=a[0];if(v===undefined)return ask('summary_'+i,(last?last+voice('v_5a21249907c6193ed270',[" להמשך "]):'')+MENU);if(v==='0')return "id_list_message=t-"+voice('v_da778c405a8c61125edb',["סיום הסיכום"]);if(!say[v])return "id_list_message=t-"+voice('v_8a1f2457eefefefc725c',["בחירה לא תקינה התחילו מחדש"]);last=say[v];}
 return 'id_list_message=t-'+last+voice('v_0b5f41a144cfa264e099',[" סיום הסיכום"]);
}

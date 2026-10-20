const MENU='לכל הלקוחות הקישו אחת לכרטיסים בתוקף שתיים למנוי רגיל בתוקף שלוש למנוי מורחב בתוקף ארבע לאחראי בתוקף חמש לפגי תוקף שש לתוקף שמסתיים בשבעת הימים הקרובים שבע לכרטיסים לא פעילים שמונה לרשומות ללא תאריך תוקף תקין תשע לסיום אפס';
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
 return {total:data.length,valid:current.length,regular:byGroup('מנוי רגיל'),extended:byGroup('מנוי מורחב'),responsible:byGroup('אחראי'),expired:data.filter(u=>{const e=date(u.date_end);return e&&e<today}).length,expiring:current.filter(u=>date(u.date_end)!<=endWeek).length,inactive:data.filter(u=>u.is_active===0||u.is_active===false||u.is_active==='0').length,unknown:data.filter(u=>!date(u.date_end)).length};
}
export function summaryReply(p:URLSearchParams,data:any,groups:any,now=new Date()){
 const c=counts(data,groups,now);const missing='לא נמצאה בחשבון קבוצה בשם הזה';
 const say:Record<string,string>={
 '1':`מספר הלקוחות הכולל ${c.total}`,
 '2':`מספר הכרטיסים הפעילים שבתוקף היום ${c.valid}`,
 '3':c.regular===null?missing:`מספר מנויי רגיל בתוקף ${c.regular}`,
 '4':c.extended===null?missing:`מספר מנויי מורחב בתוקף ${c.extended}`,
 '5':c.responsible===null?missing:`מספר אחראים בתוקף ${c.responsible}`,
 '6':`מספר הלקוחות שתאריך תוקפם חלף ${c.expired}`,
 '7':`מספר הכרטיסים הפעילים שתוקפם מסתיים בשבעת הימים הקרובים כולל היום ${c.expiring}`,
 '8':`מספר הכרטיסים הלא פעילים ${c.inactive}`,
 '9':`מספר הרשומות ללא תאריך סיום תקין ${c.unknown} רשומות אלה לא נספרות ככרטיסים בתוקף`};
 let last='';for(let i=0;i<20;i++){const a=p.getAll('summary_'+i);if(a.length>1)throw Error('duplicate');const v=a[0];if(v===undefined)return ask('summary_'+i,(last?last+' להמשך ':'')+MENU);if(v==='0')return 'id_list_message=t-סיום הסיכום';if(!say[v])return 'id_list_message=t-בחירה לא תקינה התחילו מחדש';last=say[v];}
 return 'id_list_message=t-'+last+' סיום הסיכום';
}

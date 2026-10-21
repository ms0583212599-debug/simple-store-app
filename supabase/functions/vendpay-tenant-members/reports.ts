export const KIND='לסיכום כניסות הקישו אחת לסיכום הכנסות שתיים לסיום אפס';
export const PERIOD='להיום הקישו אחת לאתמול שתיים לשבוע הנוכחי שלוש לשבוע הקודם ארבע לחודש הנוכחי חמש לחודש הקודם שש ליום מסוים שבע לטווח תאריכים שמונה';
const ask=(key,text,n=1)=>`read=t-${text}=${key},,${n},${n},30,Digits`;
const one=(p,k)=>{const a=p.getAll(k);if(a.length>1)throw Error('duplicate');return a[0];};
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('date');const d=new Date(s+'T12:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)throw Error('date');return s;}
const shift=(s,n)=>new Date(Date.parse(s+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const entered=s=>{if(!/^\d{8}$/.test(s||''))throw Error('date');return validDate(s.slice(4)+'-'+s.slice(2,4)+'-'+s.slice(0,2));};
export function reportState(p,now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),v=k=>parts.find(x=>x.type===k).value,today=v('year')+'-'+v('month')+'-'+v('day');
 for(let i=0;i<10;i++){
  const key='report_'+i+'_',kind=one(p,key+'kind');
  if(kind===undefined)return {prompt:ask(key+'kind',KIND)};
  if(kind==='0')return {prompt:'id_list_message=t-סיום הסיכום'};
  if(!['1','2'].includes(kind))throw Error('choice');
  const period=one(p,key+'period');if(period===undefined)return {prompt:ask(key+'period',PERIOD)};
  let from=today,to=today;
  const weekday=new Date(today+'T12:00:00Z').getUTCDay();
  if(period==='2')from=to=shift(today,-1);
  else if(period==='3')from=shift(today,-weekday);
  else if(period==='4'){from=shift(today,-weekday-7);to=shift(today,-weekday-1);}
  else if(period==='5')from=today.slice(0,7)+'-01';
  else if(period==='6'){to=shift(today.slice(0,7)+'-01',-1);from=to.slice(0,7)+'-01';}
  else if(period==='7'||period==='8'){
   const first=one(p,key+'from');if(first===undefined)return {prompt:ask(key+'from','הקישו תאריך בשמונה ספרות שתי ספרות ליום שתי ספרות לחודש וארבע ספרות לשנה לפי הלוח הלועזי',8)};
   from=to=entered(first);
   if(period==='8'){const end=one(p,key+'to');if(end===undefined)return {prompt:ask(key+'to','הקישו תאריך סיום בשמונה ספרות לפי הלוח הלועזי',8)};to=entered(end);}
  }else if(period!=='1')throw Error('choice');
  if(from>to||to>today||(Date.parse(to)-Date.parse(from))/86400000>365||from<'2000-01-01')throw Error('range');
  const again=one(p,key+'again');if(again==='1')continue;if(again==='0')return {prompt:'id_list_message=t-סיום הסיכום'};if(again!==undefined)throw Error('choice');
  return {kind,from,to,key};
 }return {prompt:'id_list_message=t-סיום הסיכום'};
}
export function sumEntryRows(rows,month,from,to){
 if(!Array.isArray(rows))throw Error('invalid_report');let total=0;const seen=new Set();
 for(const row of rows){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(row.bar_name||'');if(!m)throw Error('invalid_report');const date=validDate(m[3]+'-'+m[2]+'-'+m[1]);if(!date.startsWith(month)||seen.has(date)||!/^\d+$/.test(String(row.value)))throw Error('invalid_report');seen.add(date);const n=Number(row.value);if(!Number.isSafeInteger(n))throw Error('invalid_report');if(date>=from&&date<=to)total+=n;}
 if(!Number.isSafeInteger(total))throw Error('invalid_report');return total;
}
export function incomeTotals(d){const keys=['sum_cash_for_entries','sum_cash_for_selfcharging','sum_cashless_for_entries','sum_cashless_for_selfcharging'];if(!d||keys.some(k=>!Object.hasOwn(d,k)||!Number.isSafeInteger(Number(d[k]))))throw Error('invalid_report');const vals=keys.map(k=>Number(d[k]));return {total:vals.reduce((a,b)=>a+b,0),cash:vals[0]+vals[1],credit:vals[2]+vals[3]};}
export async function readReport(state,headers){
 const get=async(path,params)=>{const q=new URLSearchParams({lang:'heb',apiloc:'VendPayDeltaHeb',...params});const r=await fetch('https://vendpay24.com/VendPayDeltaHeb'+path+'?'+q,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('report_unavailable');return r.json();};
 if(state.kind==='2')return incomeTotals(await get('/chart/getChartIncomeSplit',{date_time_start:state.from+'T00:00:00',date_time_end:state.to+'T23:59:59',approved:'true'}));
 const months=[];let month=state.from.slice(0,7);while(month<=state.to.slice(0,7)){months.push(month);const [y,m]=month.split('-').map(Number);month=m===12?(y+1)+'-01':y+'-'+String(m+1).padStart(2,'0');}
 let total=0;for(let i=0;i<months.length;i+=4){const batch=await Promise.all(months.slice(i,i+4).map(async m=>sumEntryRows(await get('/chart/getChartEntryBars',{dater:'3',date_time_start:m+'-01',approved:'true'}),m,state.from,state.to)));total+=batch.reduce((a,b)=>a+b,0);}return {entries:total};
}
const money=n=>`${n<0?'מינוס ':''}${Math.floor(Math.abs(n)/100)} שקלים ${Math.abs(n)%100} אגורות`;
const spoken=s=>{const [y,m,d]=s.split('-');return `${Number(d)} ${Number(m)} ${y}`;};
export function reportReply(s,result){const intro=`מיום ${spoken(s.from)} עד יום ${spoken(s.to)} `;const text=s.kind==='1'?intro+`מספר הכניסות המאושרות ${result.entries}`:intro+`ההכנסות שהתקבלו לפי וונד פיי ${money(result.total)} מתוכן במזומן ${money(result.cash)} ובאשראי ${money(result.credit)} חיוב מיתרה בכרטיס אינו נספר כהכנסה נוספת`;return ask(s.key+'again',text+' לסיכום נוסף הקישו אחת לסיום אפס');}

export function agorot(value:unknown):number{
 const s=String(value??'').trim();if(!/^\d{1,6}(\.\d{1,2})?$/.test(s))throw Error('invalid_amount');
 const [a,b='']=s.split('.'),n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>10000000)throw Error('invalid_amount');return n;
}
function minute(s:unknown,end=false):number{
 if(end&&s==='24:00')return 1440;if(typeof s!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))throw Error('invalid_time');
 return Number(s.slice(0,2))*60+Number(s.slice(3));
}
export function validatePeriods(periods:any){
 if(!Array.isArray(periods)||periods.length>30)throw Error('invalid_periods');
 const used=new Uint8Array(10080);
 return periods.map(p=>{
  if(!Array.isArray(p.days)||!p.days.length||p.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(p.days).size!==p.days.length)throw Error('invalid_days');
  const start=minute(p.from),end=minute(p.to,true);if(start===end)throw Error('empty_period');
  if(!Number.isInteger(p.agorot)||p.agorot<0||p.agorot>10000000)throw Error('invalid_amount');
  const length=end>start?end-start:1440-start+end;
  for(const day of p.days)for(let i=0;i<length;i++){const slot=(day*1440+start+i)%10080;if(used[slot])throw Error('overlapping_periods');used[slot]=1;}
  return {days:[...p.days].sort(),from:p.from,to:p.to,agorot:p.agorot};
 });
}
export function effective(plan:any,now=new Date()):number{
 const periods=validatePeriods(plan.periods);
 if(!Number.isInteger(plan.default_agorot)||plan.default_agorot<0||plan.default_agorot>10000000)throw Error('invalid_amount');
 const fields=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jerusalem',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const field=k=>fields.find(x=>x.type===k)?.value;
 const day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(field('weekday')||''),slot=day*1440+Number(field('hour'))*60+Number(field('minute'));
 for(const p of periods){const start=minute(p.from),end=minute(p.to,true),length=end>start?end-start:1440-start+end;
  for(const d of p.days)if((slot-(d*1440+start)+10080)%10080<length)return p.agorot;
 }return plan.default_agorot;
}

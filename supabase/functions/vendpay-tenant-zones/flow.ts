export class InputError extends Error{}
export const safe=(s:unknown)=>String(s??'').replace(/[&=.,<>\r\n]/g,' ').slice(0,120);
export function one(p:URLSearchParams,k:string){const a=p.getAll(k);if(a.length>1)throw new InputError('נתון כפול התחילו שיחה חדשה');return a[0];}
export const ask=(k:string,text:string,max='2',type='Digits')=>({reply:`read=t-${text}=${[k,'',max,'1','30',type].join(',')}`});
const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const money=(n:number|null)=>n===null?'אפס':`${Math.floor(n/100)} שקלים ו ${n%100} אגורות`;
export function validate(d:any,terminal:number,kind:string){
 if(!d||Number(d.terminal_id)!==terminal||!Array.isArray(d.zoneData)||d.zoneData.length>100)throw Error('invalid_zone_list');
 for(const r of d.zoneData){if(!r||!Number.isInteger(r.mask_days)||r.mask_days<0||r.mask_days>127||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time_from)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time_to))throw Error('invalid_zone');
 if(kind==='price_zones'){for(const k of ['price','price_member'])if(r[k]!==null&&(!Number.isSafeInteger(r[k])||r[k]<0))throw Error('invalid_price');}
 else if(!Number.isInteger(r.mode_entry)||!Number.isInteger(r.mode_custom))throw Error('invalid_mode');}
 return d;
}
export function modeList(d:any){const modes:Record<string,string>={};for(const v of Object.values(d||{}) as any[]){if(!Array.isArray(v)||v.length<2||!/^\d+$/.test(String(v[0]))||typeof v[1]!=='string')throw Error('invalid_modes');const name=v[1].toLowerCase();const labels:Record<string,string>={normal:'רגיל',open:'פתוח',closed:'סגור',vip:'אחראים בלבד',custom:'מותאם אישית',regular:'רגיל'};modes[String(Number(v[0]))]=labels[name]||safe(v[1]);}if(!Object.keys(modes).length)throw Error('invalid_modes');return modes;}
export function describe(r:any,kind:string,modes:Record<string,string>){return `ימים ${days.filter((_,i)=>r.mask_days&(1<<i)).join(' ')||'ללא ימים'} משעה ${r.time_from.replace(':',' ו ')} עד ${r.time_to.replace(':',' ו ')} `+(kind==='price_zones'?`מחיר ${money(r.price)} מחיר חבר ${money(r.price_member)}`:`מצב ${modes[r.mode_entry]||r.mode_entry} אמצעי כניסה ${[[1,'מזומן'],[2,'אחראים'],[4,'מנוי'],[8,'כרטיס מזומן'],[128,'אשראי']].filter(([n])=>r.mode_custom&Number(n)).map(([,name])=>name).join(' ')||'לפי המצב'}`);}
export function wizard(p:URLSearchParams,baseline:any,kind:string,modes:Record<string,string>){
 const rows=baseline.zoneData,op=one(p,'zone_op');if(op===undefined)return ask('zone_op',`יש ${rows.length} אזורים לשמיעת אזור אחת לעריכת אזור שתיים להוספת אזור שלוש למחיקת אזור ארבע לביטול אפס`,'1');
 if(op==='0')return {cancelled:true};if(!['1','2','3','4'].includes(op))throw new InputError('בחירה לא תקינה');
 let index=rows.length;if(op!=='3'){const n=one(p,'zone_row');if(n===undefined)return ask('zone_row',`בחרו מספר שורה מאחת עד ${rows.length}`,'3');index=Number(n)-1;if(!/^\d+$/.test(n)||index<0||index>=rows.length)throw new InputError('השורה לא קיימת');}
 if(op==='1')return {reply:'id_list_message=t-שורה '+(index+1)+' '+describe(rows[index],kind,modes)};
 const draft=structuredClone(baseline);let summary='';
 if(op==='4'){summary=`מחיקת שורה ${index+1} ${describe(rows[index],kind,modes)} השורות שאחריה ימוספרו מחדש`;draft.zoneData.splice(index,1);}
 else{
 if(op==='3'&&rows.length>=100)throw new InputError('מספר האזורים המרבי הושג');
 const row=op==='3'?{mask_days:0,time_from:'00:00',time_to:'23:59',mode_entry:kind==='price_zones'?-100:0,mode_custom:kind==='price_zones'?-100:0,price:null,price_member:null}:structuredClone(rows[index]);
 let field=one(p,'zone_field');if(op==='3')field='all';else if(field===undefined)return ask('zone_field',`שורה ${index+1} ${describe(row,kind,modes)} לשינוי ימים אחת לשעות שתיים ${kind==='price_zones'?'למחירים שלוש':'למצב ואמצעי כניסה שלוש'} לשינוי הכל ארבע`,'1');
 if(field==='4')field='all';if(!['1','2','3','all'].includes(field!))throw new InputError('בחירת שדה לא תקינה');
 if(field==='1'||field==='all'){const v=one(p,'zone_days');if(v===undefined)return ask('zone_days','הקישו את מספרי הימים ברצף ראשון אחת שני שתיים עד שבת שבע לכל השבוע שמונה לסיום סולמית','7');if(v==='8')row.mask_days=127;else{if(!/^[1-7]{1,7}$/.test(v)||new Set(v).size!==v.length)throw new InputError('בחירת ימים לא תקינה');row.mask_days=[...v].reduce((a,c)=>a|(1<<(Number(c)-1)),0);}}
 if(field==='2'||field==='all'){for(const [key,label] of [['time_from','שעת התחלה'],['time_to','שעת סיום']]){const v=one(p,'zone_'+key);if(v===undefined)return ask('zone_'+key,`הקישו ${label} בארבע ספרות שעות ודקות`,'4');if(!/^([01]\d|2[0-3])[0-5]\d$/.test(v))throw new InputError('שעה לא תקינה');row[key]=v.slice(0,2)+':'+v.slice(2);}if(row.time_from>=row.time_to)throw new InputError('שעת הסיום חייבת להיות אחרי ההתחלה לחציית חצות הגדירו שני אזורים');}
 if(field==='3'||field==='all'){
 if(kind==='price_zones'){for(const [key,label] of [['price','מחיר רגיל'],['price_member','מחיר חבר']]){const v=one(p,'zone_'+key);if(v===undefined)return ask('zone_'+key,`הקישו ${label} בשקלים לאגורות כוכבית`,'10','Price');if(!/^\d{1,7}(?:\.\d{1,2})?$/.test(v))throw new InputError('מחיר לא תקין');const [whole,frac='']=v.split('.');row[key]=(Number(whole)*100+Number(frac.padEnd(2,'0')))||null;}}
 else{const v=one(p,'zone_mode');const ids=Object.keys(modes);if(v===undefined)return ask('zone_mode','בחרו מצב '+ids.map((id,i)=>modes[id]+' '+(i+1)).join(' '),'3');if(!/^\d+$/.test(v)||!ids[Number(v)-1])throw new InputError('מצב לא תקין');row.mode_entry=Number(ids[Number(v)-1]);row.mode_custom=0;if(row.mode_entry===5){const methods=one(p,'zone_methods');if(methods===undefined)return ask('zone_methods','בחרו אמצעי כניסה ברצף מזומן אחת אחראים שתיים מנוי שלוש כרטיס מזומן ארבע אשראי חמש לסיום סולמית','5');if(!/^[1-5]{1,5}$/.test(methods)||new Set(methods).size!==methods.length)throw new InputError('בחירה לא תקינה');row.mode_custom=[...methods].reduce((a,c)=>a|[1,2,4,8,128][Number(c)-1],0);}}}
 if(op==='3')draft.zoneData.push(row);else draft.zoneData[index]=row;
 summary=`${op==='3'?'הוספת':'עדכון'} שורה ${index+1} ${describe(row,kind,modes)}`;
 }
 const confirmation=one(p,'zone_confirm');if(confirmation===undefined)return ask('zone_confirm',summary+' שורה גבוהה יותר גוברת במקרה חפיפה השינוי יישלח למסוף ועלול להשפיע מיד לאישור אחת לביטול שתיים','1');
 if(confirmation==='2')return {cancelled:true};if(confirmation!=='1')throw new InputError('אישור לא תקין');return {draft};
}

import {scoped,profile,billing,providerPending,today,period,money,summaryText,itemText,typeNames,methodNames}from './shared.ts';
export function createFlow(account){
 const readData=d=>scoped(account,'read',d),manage=(a,d,id)=>scoped(account,a,d,id);
 const rpc=(name,d)=>scoped(account,'call',{id:d.p_id,seq:d.p_seq,state:d.p_state,response:d.p_response});
// The configured key is checked by its digest, never stored in this public source.
const EXPECTED_HASH='12ccca974400e26882199733fa1ebdc6b3654e62ec08fd1f04f47d9e5558ec02';
const clean=s=>String(s??'').replace(/[.=&<>\r\n]/g,' ').replace(/\s+/g,' ').trim();
const response=(s,status=200)=>new Response(s,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
async function digest(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');}
const main=()=>({stage:'main'});
const types={'1':'current','2':'exceptional','3':'annual','4':'fixed'};
function dateInput(v){if(v==='1')return today();if(!/^\d{8}$/.test(v))throw Error('הקישו שמונה ספרות יום חודש ושנה');const d=v.slice(4)+'-'+v.slice(2,4)+'-'+v.slice(0,2);if(new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw Error('התאריך אינו תקין');return d;}
function fields(action,d){
 if(action==='category_save')return ['name'];
 if(action==='budget_save')return ['month','category_id','shekels','agorot'];
 if(action==='recurring_save')return ['category_id','name','shekels','agorot','due_day',...(d.id?[]:['start_month']),'payment_method',...(d.id?['active']:[])];
 if(action==='refund')return ['shekels','agorot','occurred_on','payment_method','note'];
 return ['category_id',...(d.recurring_id||d.reversal_of||(!d.id&&d.flow_type)?[]:['flow_type']),'shekels','agorot','occurred_on','status','payment_method','note',...(d.id?[]:['installment_count'])];
}
function wizard(action,data){return {stage:'wizard',action,data:{payment_method:'unspecified',status:'actual',occurred_on:today(),active:true,...data},fields:fields(action,data),index:0};}
function catsFor(cats,kind){return cats.filter(c=>c.active&&c.kind===kind);}
function fieldPrompt(s,cats){const f=s.fields[s.index],d=s.data,keep=d.id?' לשמירת הערך הקיים הקישו כוכבית וסולמית':'';
 const prompts={category_id:'בחרו קטגוריה '+catsFor(cats,d.kind||'expense').map(c=>c.name+' הקישו '+c.dial_code).join(' '),name:'הקלידו שם במקלדת העברית',flow_type:'לשוטפות 1 לחריגות 2 לשנתיות 3 לקבועות 4',shekels:'הקישו סכום בשקלים שלמים וסולמית',agorot:'הקישו אגורות וסולמית אם אין הקישו 0',occurred_on:'לתאריך היום הקישו 1 וסולמית לתאריך אחר הקישו יום חודש ושנה בשמונה ספרות וסולמית',month:'לחודש הנוכחי הקישו 1 וסולמית אחרת הקישו תאריך בחודש הרצוי בשמונה ספרות',start_month:'לחודש התחלה נוכחי הקישו 1 וסולמית אחרת תאריך בשמונה ספרות',due_day:'הקישו את היום בחודש מ 1 עד 31 וסולמית',status:'לבוצע הקישו 1 לצפוי הקישו 2',payment_method:'למזומן 1 לבנק 2 לאשראי 3 ללא ציון 4',active:'לקבועה פעילה הקישו 1 להפסקת הקבועה 2',note:'להזנת הערה במקלדת העברית הקישו 1 ללא הערה הקישו 2',note_text:'הקלידו הערה במקלדת העברית',installment_count:'לפעולה אחת הקישו 1 וסולמית לפריסה לתשלומים הקישו מספר תשלומים מ 2 עד 60 וסולמית כל תשלום יירשם כצפוי עד אישור ביצוע'};
 return {text:prompts[f]+keep,max:['name','note_text'].includes(f)?60:['occurred_on','month','start_month'].includes(f)?8:f==='shekels'?6:['agorot','due_day','installment_count'].includes(f)?2:1,keyboard:['name','note_text'].includes(f)};
}
function review(s,cats){const d=s.data,c=cats.find(c=>c.id==d.category_id);if(s.action==='category_save')return 'קטגוריה '+d.name;if(s.action==='budget_save')return 'תקציב '+c?.name+' לחודש '+d.month+' בסך '+money(d.amount_agorot);if(s.action==='recurring_save')return 'קבועה '+d.name+' '+c?.name+' '+money(d.amount_agorot)+' ביום '+d.due_day+' '+(d.active?'פעילה':'מופסקת');return itemText({...d,id:d.id||'חדשה',category_name:c?.name})+(d.installment_count>1?' בפריסה ל '+d.installment_count+' תשלומים צפויים':'');}
async function ledgerPrompt(s,cats,seq){let text='',max=1,keyboard=false;
 switch(s.stage){
 case 'main':text='ניהול כלכלה להוספת הוצאות והכנסות חודשיות 1 לניהול קבועות 2 לסיכומים 3 לפירוט חיפוש ועריכת פעולות 4 לניהול קטגוריות 5 לתקציבים 6 להגדרות החשבון 7 למנויים וביטול 8 ליציאה 9';break;
 case 'monthly':text='להוספת הוצאות 1 להוספת הכנסות 2 לחזרה 0';break;
 case 'type':text='לשוטפות 1 לחריגות 2 לשנתיות 3 לחזרה 0';break;
 case 'fixed':text='להוספה ועריכת הוצאות קבועות 1 להכנסות קבועות 2 לחזרה 0';break;
 case 'recurring':text=s.rows.map(r=>`מספר ${r.id} ${r.name} ${money(r.amount_agorot)} ביום ${r.due_day} ${r.active?'פעילה':'מופסקת'}`).join(' ')+' להוספת קבועה הקישו 1 לעריכת קבועה 2 להיסטוריית קבועה 3 לחזרה 0';break;
 case 'recurring_id':text='הקישו מספר קבועה לעריכה וסולמית לחזרה 0';max=12;break;
 case 'kind':text='להוצאות 1 להכנסות 2 לחזרה 0';break;
 case 'categories':text=catsFor(cats,s.kind).map(c=>c.name+' מקש '+c.dial_code).join(' ')+' להוספת קטגוריה 1 לשינוי שם קטגוריה 2 לחזרה 0';break;
 case 'category_edit':text='בחרו את מקש הקטגוריה לעריכה '+catsFor(cats,s.kind).map(c=>c.name+' '+c.dial_code).join(' ')+' לחזרה 0';break;
 case 'report_period':text='לחודש הנוכחי 1 לחודש הקודם 2 לשנה הנוכחית 3 להיום 4 לטווח תאריכים 5 לחזרה 0';break;
 case 'from':case 'to':text='הקישו תאריך '+(s.stage==='from'?'התחלה':'סיום')+' יום חודש ושנה שמונה ספרות וסולמית';max=8;break;
 case 'report_type':text='לכל הסוגים ביחד והפרש 5 לשוטפות 1 לחריגות 2 לשנתיות 3 לקבועות 4 לחזרה 0';break;
 case 'report_kind':text='להוצאות 1 להכנסות 2 לשניהם ביחד עם הפרש 3 לחזרה 0';break;
 case 'report_category':text='לכל הקטגוריות 0 '+catsFor(cats,s.filter.kind).map(c=>c.name+' '+c.dial_code).join(' ');break;
 case 'report':text=s.text+' לפירוט פעולות 1 להשוואה לחודש הקודם 2 לפירוט קטגוריות 3 לסינון סכום מדויק 4 לחיפוש בהערות 5 לסינון צפוי או בוצע 6 להקראת הסיכום שוב 7 למשלוח הדוח במייל 8 לתפריט הראשי 0';break;
 case 'filter_amount':text='הקישו סכום מדויק באגורות וסולמית לדוגמה למאה שקלים הקישו עשרת אלפים';max=8;break;
 case 'filter_search':text='הקלידו מילים לחיפוש במקלדת העברית';max=60;keyboard=true;break;
 case 'filter_status':text='לבוצע 1 לצפוי 2 לשניהם 3';break;
 case 'list':text=(s.rows.length?s.rows.map(itemText).join(' '):'אין פעולות בטווח שנבחר')+' לבחירת פעולה לפי מספר הקישו 1 לעמוד הבא 2 לעמוד הקודם 3 להצגה כולל מבוטלות 4 לחזרה לסיכום 5 לתפריט הראשי 0';break;
 case 'item_id':text='הקישו מספר פעולה וסולמית לחזרה 0';max=12;break;
 case 'item':text=itemText(s.item)+' לעריכה 1 לאישור שבוצע 2 לביטול 3 לשחזור ביטול 4 לרישום החזר 5 להיסטוריית שינויים 6 לשמיעה חוזרת 7 לחיפוש פעולה אחרת 8 לתפריט הראשי 0';break;
 case 'state_confirm':text=s.label+' '+itemText(s.item)+' לאישור 1 לביטול 0';break;
 case 'budgets':text=s.rows.map(b=>b.category_name+' תקציב '+money(b.amount_agorot)+' הוצאה בפועל '+money(b.spent)+' נותרו '+money(b.amount_agorot-b.spent)).join(' ')+' להוספה או עריכת תקציב 1 לחודש אחר 2 לתפריט הראשי 0';break;
 case 'budget_month':text='הקישו תאריך בחודש הרצוי יום חודש ושנה בשמונה ספרות וסולמית';max=8;break;
 case 'wizard':({text,max,keyboard}=fieldPrompt(s,cats));break;
 case 'confirm':text=review(s,cats)+' לאישור ושמירה 1 להזנה מחדש 2 לביטול 0';break;
 }
 return `read=t-${clean((s.notice||'')+' '+text)}=z${seq},,${max},1,30,${keyboard?'HebrewKeyboard':'NO'},no`;
}
async function report(s){const d=await readData(s.filter);return {...s,stage:'report',text:summaryText(d),notice:''};}
async function listing(s){const n=s.listPage||0;const d=await readData({...s.filter,page:Math.floor(n/10)});return {...s,stage:'list',rows:d.rows.slice(n%10*5,n%10*5+5),notice:''};}
async function recurring(kind){return {stage:'recurring',kind,rows:(await readData({mode:'recurring',kind})).rows};}
async function budgets(month=today()){const filter=period('month',month);return {stage:'budgets',month:filter.from,rows:(await readData(filter)).budgets};}
async function ledgerAdvance(s,v,cats,request){
 const invalid=()=>{throw Error('הבחירה אינה תקינה');};
 if(s.stage!=='wizard'&&v==='0'&&!['report_category'].includes(s.stage))return main();
 switch(s.stage){
 case 'main':return v==='1'?{stage:'monthly'}:v==='2'?{stage:'fixed'}:v==='3'?{stage:'report_period'}:v==='4'?{stage:'report_period',wantList:true}:v==='5'?{stage:'kind'}:v==='6'?await budgets():v==='9'?{stage:'exit'}:invalid();
 case 'monthly':return ['1','2'].includes(v)?{stage:'type',kind:v==='1'?'expense':'income'}:invalid();
 case 'type':return ['1','2','3'].includes(v)?wizard('transaction_save',{kind:s.kind,flow_type:types[v]}):invalid();
 case 'fixed':return ['1','2'].includes(v)?await recurring(v==='1'?'expense':'income'):invalid();
 case 'recurring':return v==='1'?wizard('recurring_save',{kind:s.kind,start_month:period('month').from}):['2','3'].includes(v)?{...s,stage:'recurring_id',history:v==='3'}:invalid();
 case 'recurring_id':{const r=s.rows.find(r=>String(r.id)===v);if(!r)return invalid();if(s.history){const h=await readData({mode:'history',entity:'finance_recurring',id:r.id});return {...s,stage:'recurring',history:false,notice:h.rows.map(x=>'שינוי בתאריך '+x.created_at.slice(0,10)+' '+x.after_data.name+' '+money(x.after_data.amount_agorot)+' '+(x.after_data.active?'פעילה':'מופסקת')).join(' ')||'אין היסטוריה'};}return wizard('recurring_save',r);}
 case 'kind':return ['1','2'].includes(v)?{stage:'categories',kind:v==='1'?'expense':'income'}:invalid();
 case 'categories':return v==='1'?wizard('category_save',{kind:s.kind}):v==='2'?{...s,stage:'category_edit'}:invalid();
 case 'category_edit':{const c=catsFor(cats,s.kind).find(c=>String(c.dial_code)===v);return c?wizard('category_save',c):invalid();}
 case 'report_period':{if(v==='5')return {...s,stage:'from',filter:{}};if(!['1','2','3','4'].includes(v))return invalid();return {...s,stage:'report_type',filter:period({'1':'month','2':'previous','3':'year','4':'today'}[v])};}
 case 'from':return {...s,stage:'to',filter:{...s.filter,from:dateInput(v)}};
 case 'to':return {...s,stage:'report_type',filter:{...s.filter,to:dateInput(v)}};
 case 'report_type':if(!types[v]&&v!=='5')return invalid();return {...s,stage:'report_kind',filter:{...s.filter,flow_type:types[v]||''}};
 case 'report_kind':{if(!['1','2','3'].includes(v))return invalid();s={...s,filter:{...s.filter,kind:{'1':'expense','2':'income','3':''}[v]}};return v==='3'?(s.wantList?await listing(s):await report(s)):{...s,stage:'report_category'};}
 case 'report_category':{const c=catsFor(cats,s.filter.kind).find(c=>String(c.dial_code)===v);if(v!=='0'&&!c)return invalid();s={...s,filter:{...s.filter,category_id:c?.id||''}};return s.wantList?await listing(s):await report(s);}
 case 'report':{
  if(v==='1')return listing(s);
  if(v==='2'){const prev=await readData({...s.filter,...period('previous',s.filter.from)});return {...s,notice:summaryText(prev,'החודש הקודם')};}
  if(v==='3'){const d=await readData(s.filter);return {...s,notice:d.by_category.map(c=>c.category_name+' '+(c.kind==='income'?'הכנסות':'הוצאות')+' בוצע '+money(c.actual||0)+' צפוי '+money(c.planned||0)).join(' ')};}
  if(['4','5','6'].includes(v))return {...s,stage:{'4':'filter_amount','5':'filter_search','6':'filter_status'}[v]};if(v==='7')return report(s);return invalid();
 }
 case 'filter_amount':if(!/^\d{1,8}$/.test(v))return invalid();return report({...s,filter:{...s.filter,amount_agorot:Number(v)}});
 case 'filter_search':return report({...s,filter:{...s.filter,search:v}});
 case 'filter_status':if(!['1','2','3'].includes(v))return invalid();return report({...s,filter:{...s.filter,status:{'1':'actual','2':'planned','3':''}[v]}});
 case 'list':if(v==='1')return {...s,stage:'item_id'};if(v==='2'||v==='3')return listing({...s,listPage:Math.max(0,(s.listPage||0)+(v==='2'?1:-1))});if(v==='4')return listing({...s,filter:{...s.filter,include_voided:true}});if(v==='5')return report(s);return invalid();
 case 'item_id':{if(!/^\d{1,12}$/.test(v))return invalid();const item=await readData({mode:'item',id:Number(v)});if(!item)throw Error('הפעולה לא נמצאה');return {stage:'item',item};}
 case 'item':{
  if(v==='1')return wizard('transaction_save',s.item);
  if(['2','3','4'].includes(v))return {...s,stage:'state_confirm',action:{'2':'mark_actual','3':'void','4':'restore'}[v],label:{'2':'אישור שבוצע היום','3':'ביטול פעולה','4':'שחזור פעולה'}[v]};
  if(v==='5')return wizard('refund',{kind:s.item.kind,category_id:s.item.category_id,flow_type:s.item.flow_type,reversal_of:s.item.id});
  if(v==='6'){const d=await readData({mode:'history',id:s.item.id});return {...s,notice:d.rows.map(h=>'שינוי בתאריך '+h.created_at.slice(0,10)+' '+itemText({...h.after_data,category_name:''})).join(' ')||'אין היסטוריה'};}
  if(v==='7')return {...s,notice:''};if(v==='8')return {stage:'item_id'};return invalid();
 }
 case 'state_confirm':if(v!=='1')return invalid();await manage(s.action,{id:s.item.id,revision:s.item.revision,occurred_on:today()},request);return {stage:'item',item:await readData({mode:'item',id:s.item.id}),notice:'הפעולה נשמרה'};
 case 'budgets':return v==='1'?wizard('budget_save',{kind:'expense',month:s.month}):v==='2'?{stage:'budget_month'}:invalid();
 case 'budget_month':return budgets(dateInput(v));
 case 'wizard':{
  const d={...s.data},f=s.fields[s.index];
  if(v==='*'&&d.id){if(f==='shekels')d._shekels=Math.floor(d.amount_agorot/100);if(f==='agorot')d.amount_agorot=d._shekels*100+d.amount_agorot%100;}
  else if(f==='category_id'){const c=catsFor(cats,d.kind).find(c=>String(c.dial_code)===v);if(!c)return invalid();d.category_id=c.id;}
  else if(f==='flow_type'){if(!types[v])return invalid();d.flow_type=types[v];}
  else if(f==='shekels'){if(!/^\d{1,6}$/.test(v))return invalid();d._shekels=Number(v);}
  else if(f==='agorot'){if(!/^\d{1,2}$/.test(v))return invalid();d.amount_agorot=d._shekels*100+Number(v);}
  else if(['occurred_on','month','start_month'].includes(f)){d[f]=dateInput(v);if(f!=='occurred_on')d[f]=d[f].slice(0,7)+'-01';}
  else if(f==='name'||f==='note_text'){if(!v.trim())return invalid();d[f==='name'?'name':'note']=v.trim();}
  else if(f==='note'){if(v==='1'){const fs=[...s.fields];fs.splice(s.index+1,0,'note_text');return {...s,data:d,fields:fs,index:s.index+1};}if(v!=='2')return invalid();d.note='';}
  else if(f==='status'){if(!['1','2'].includes(v))return invalid();d.status=v==='1'?'actual':'planned';}
  else if(f==='payment_method'){if(!['1','2','3','4'].includes(v))return invalid();d.payment_method={'1':'cash','2':'bank','3':'credit','4':'unspecified'}[v];}
  else if(f==='active'){if(!['1','2'].includes(v))return invalid();d.active=v==='1';}
  else if(f==='due_day'){if(!/^\d{1,2}$/.test(v)||+v<1||+v>31)return invalid();d.due_day=+v;}
  else if(f==='installment_count'){if(!/^\d{1,2}$/.test(v)||+v<1||+v>60)return invalid();d.installment_count=+v;}
  const next={...s,data:d,index:s.index+1};if(next.index>=s.fields.length){next.stage='confirm';if(s.action==='budget_save'){const b=(await readData(period('month',d.month))).budgets.find(b=>b.category_id===d.category_id);if(b){next.data.id=b.id;next.data.revision=b.revision;}}}return next;
 }
 case 'confirm':if(v==='2')return wizard(s.action,s.data);if(v!=='1')return invalid();{const d={...s.data};delete d._shekels;await manage(s.action==='transaction_save'&&d.installment_count>1&&!d.id?'installments':s.action,d,request);return {...main(),notice:'הנתונים נשמרו בהצלחה וזמינים גם באתר'};}
 }
 return invalid();
}
async function handler(req){
 if(!['GET','POST'].includes(req.method))return response('Method not allowed',405);
 const p=new URL(req.url).searchParams;if(p.get('health')==='1')return response('ok finance-ivr complete-v24');
 try{
 if(req.method==='POST'){const raw=await req.text();if(raw.length>64000)return response('Request too large',413);for(const[k,v]of new URLSearchParams(raw))p.append(k,v);}
 for(const k of new Set(p.keys()))if(p.getAll(k).length>1)throw Error('התקבל נתון כפול יש להיכנס מחדש לשלוחה');
 if(await digest(p.get('finance_key')||'')!==EXPECTED_HASH)return response('id_list_message=t-מפתח החיבור אינו תקין');
 if(p.has('hangup'))return response('');
 const call=p.get('ApiCallId')||'';if(!/^[A-Za-z0-9_-]{8,160}$/.test(call))throw Error('חסר מזהה שיחה תקין');
 const id=await digest(call+':'+(p.get('ApiExtension')||'')),cats=(await readData({mode:'categories'})).rows;
 let row=await rpc('finance_call',{p_id:id,p_seq:0,p_state:null,p_response:null});
 if(!row?.id){let s=main();const start=p.get('start');if(start==='monthly')s={stage:'monthly'};else if(start==='fixed')s={stage:'fixed'};else if(start==='summary')s={stage:'report_period'};else if(['expense','income'].includes(start))s={stage:'type',kind:start};else if(['expense_current','expense_exceptional','expense_annual','income_current','income_exceptional','income_annual'].includes(start)){const[k,t]=start.split('_');s=wizard('transaction_save',{kind:k,flow_type:t});}else if(['fixed_expense','fixed_income'].includes(start))s=await recurring(start.split('_')[1]);
 row=await rpc('finance_call',{p_id:id,p_seq:-1,p_state:s,p_response:await prompt(s,cats,0)});}
 if(row.state.stage==='exit'&&![...p.keys()].some(k=>/^z\d+$/.test(k))){const s=main();row=await rpc('finance_call',{p_id:id,p_seq:row.seq,p_state:s,p_response:await prompt(s,cats,row.seq+1)});}
 const value=p.get('z'+row.seq);if(value===null)return response(row.response);
 let next;try{next=await advance(row.state,value,cats,row.state.write_request||await digest(id+':'+row.seq));}catch(e){next={...row.state,notice:e.message};}
 if(['confirm','state_confirm'].includes(next.stage)&&!next.write_request)next.write_request=await digest(id+':confirm:'+ (row.seq+1));
 const out=next.stage==='exit'?'go_to_folder=/3/4':await prompt(next,cats,row.seq+1);
 row=await rpc('finance_call',{p_id:id,p_seq:row.seq,p_state:next,p_response:out});return response(row.response);
 }catch(e){return response('id_list_message=t-'+clean(e.message||'אירעה תקלה זמנית נסו שוב'));}
}


async function advance(s,v,cats,id){
 if(s.stage==='main'&&v==='7')return {stage:'account',details:await profile(account)};
 if(s.stage==='main'&&v==='8')return {stage:'subscriptions',rows:(await billing(account,'mine')).subscriptions};
 if(s.stage==='report'&&v==='8')return {...s,notice:providerPending};
 if(s.stage==='account'){if(v==='0')return main();if(v==='1')return {stage:'account_name'};if(v==='2')return {...s,notice:providerPending};throw Error('הבחירה אינה תקינה');}
 if(s.stage==='account_name'){await profile(account,'name',{name:v});return {stage:'account',details:await profile(account),notice:'השם נשמר'};}
 if(s.stage==='subscriptions'){if(v==='0')return main();const r=s.rows[Number(v)-1];if(!r)throw Error('הבחירה אינה תקינה');return {stage:'cancel_subscription',subscription:r};}
 if(s.stage==='cancel_subscription'){if(v==='0')return main();if(v!=='1')throw Error('הבחירה אינה תקינה');await billing(account,'cancel',{service_id:s.subscription.service_id});return {...main(),notice:'המנוי בוטל לא ייווצרו חיובים נוספים עבור שירות זה הגישה לתקופה ששולמה נשמרת'};}
 return ledgerAdvance(s,v,cats,id);
}
async function prompt(s,cats,seq){
 let text='',max=1,keyboard='NO';
 if(s.stage==='account')text='החשבון של '+s.details.display_name+' מספר טלפון '+s.details.phone+' '+(s.details.email?'מייל '+s.details.email.replaceAll('.',' נקודה ').replace('@',' שטרודל '):'טרם הוגדר מייל')+' לשינוי שם 1 להגדרת מייל 2 לחזרה 0';
 else if(s.stage==='account_name'){text='הקלידו שם במקלדת העברית';max=60;keyboard='HebrewKeyboard';}
 else if(s.stage==='subscriptions')text=(s.rows.length?s.rows.map((r,i)=>r.service_name+' '+(r.status==='cancelled'?'מבוטל':r.status==='free'?'חינמי':'מנוי')+' לביטול הקישו '+(i+1)).join(' '):'אין מנויים')+' לחזרה 0';
 else if(s.stage==='cancel_subscription')text='לביטול המנוי לשירות '+s.subscription.service_name+' והפסקת החיובים העתידיים הקישו 1 לחזרה ללא ביטול 0';
 else return ledgerPrompt(s,cats,seq);
 return `read=t-${clean((s.notice||'')+' '+text)}=z${seq},,${max},1,30,${keyboard},no`;
}
return {handler,advance};
}

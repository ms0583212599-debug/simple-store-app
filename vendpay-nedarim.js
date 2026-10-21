(()=>{
 const $=id=>document.getElementById(id),dialog=$('vpNedarimDialog');
 let selected='',model=null,groups=[],editing=null,version=0,busy=false,lastFocus=null;
 const actions={renew:'הארכת תוקף כמו בטלפון',open:'פתיחת דלת',both:'הארכת תוקף ופתיחת דלת'};
 const time=v=>v?new Date(v).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}):'טרם בוצעה';
 const message=(text,error=false)=>{$('npMessage').textContent=text;$('npMessage').classList.toggle('np-error',error);};
 function lock(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);if(!value){$('npAdd').disabled=!model?.connection;$('npRefreshCategories').disabled=!model?.connection;$('npPriceAdd').disabled=!model?.connection;$('npPriceCategory').disabled=!!priceEditing;$('npPricePeriods').querySelectorAll('[data-full]').forEach(el=>el.closest('fieldset').querySelectorAll('input[type=time]').forEach(t=>t.disabled=el.checked));}}
 async function request(action,body={}){
  return vendpayRequest('POST',{tenant_id:selected,...body},action);
 }
 function cancel(){editing=null;$('npEditor').hidden=true;$('npPriceEditor').hidden=true;priceEditing=null;}
 function fillCategories(value=''){
  const select=$('npCategory');select.replaceChildren(new Option('בחרו קטגוריה',''));
  for(const group of groups){const option=new Option(group.name+(group.redirected?' — מפנה ליעד אחר':''),group.name);option.disabled=group.redirected;select.add(option);}
  if(value&&!groups.some(g=>g.name===value))select.add(new Option(value+' (כלל קיים)',value));
  select.value=value;
 }
 function render(){
  const connection=model?.connection,state=model?.state;
  $('npInstitution').textContent=connection?.mosad||'לא הוגדר';$('npMosad').value=connection?.mosad||'';
  $('npBadge').textContent=!connection?'לא מחובר':!state?.initialized?'מכין חיבור לתשלומים חדשים':state.enabled?'פעיל': 'כבוי';
  $('npConnection').open=!connection;
  $('npRunStatus').textContent=!connection?'הגדירו מוסד כדי להתחיל.':'בדיקה אחרונה: '+time(state?.last_run_at)+(state?.last_error?' — יש שגיאה בחיבור.':'.');
  const root=$('npRules');root.replaceChildren();
  if(!model?.rules?.length){const p=document.createElement('p');p.className='np-note';p.textContent='עדיין אין כללים ללקוח זה. הוסיפו כלל כדי לבחור מה יקרה לאחר התשלום.';root.append(p);}
  (model?.rules||[]).forEach(rule=>{
   const card=document.createElement('div');card.className='np-rule';
   const text=document.createElement('div'),title=document.createElement('strong'),description=document.createElement('p');title.textContent=rule.category;description.textContent=actions[rule.action]||rule.action;description.className='np-note';text.append(title,description);
   const controls=document.createElement('div');controls.className='np-controls';
   const edit=document.createElement('button');edit.type='button';edit.className='light';edit.textContent='עריכה';edit.onclick=()=>editRule(rule);
   const remove=document.createElement('button');remove.type='button';remove.className='np-delete';remove.textContent='מחיקה';remove.onclick=()=>{
    controls.replaceChildren();const confirm=document.createElement('button'),back=document.createElement('button');
    confirm.type=back.type='button';confirm.className='np-delete';back.className='light';confirm.textContent='אישור מחיקה';back.textContent='ביטול';
    confirm.onclick=()=>mutate('np_rule_delete',{mosad:model.connection.mosad,id:rule.id},'הכלל נמחק.');back.onclick=render;controls.append(confirm,back);
   };
   controls.append(edit,remove);card.append(text,controls);root.append(card);
  });
  const events=$('npEvents');events.replaceChildren();
  if(!model?.events?.length){events.textContent='טרם נקלט תשלום בקטגוריות של חיבור זה.';return;}
  const table=document.createElement('table'),head=document.createElement('tr');
  ['מועד','עסקה','קטגוריה','כרטיס','תוצאה','תוקף יעד'].forEach(v=>{const th=document.createElement('th');th.textContent=v;head.append(th);});table.append(head);
  const statuses={completed:'הפעולה הושלמה',already_valid:'התוקף הקיים מספיק',processing:'בטיפול — אין לנסות שוב',review_card:'מספר כרטיס לא תקין',review_payment:'נדרשת בדיקת תשלום',review_member:'כרטיס לא נמצא או כפול',review_door_after_renew:'המנוי טופל; פתיחת הדלת דורשת בדיקה'};
  model.events.forEach(e=>{const tr=document.createElement('tr');[time(e.created_at),String(e.transaction_id),e.category,e.card_number||'—',statuses[e.status]||'נדרשת בדיקה לפני ניסיון נוסף',e.target_date||'—'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});table.append(tr);});events.append(table);
 }
 async function loadCategories(epoch){
  if(!model?.connection)return;
  $('npCategoriesInfo').textContent='טוען קטגוריות מנדרים פלוס...';
  try{
   const data=await request('np_categories',{mosad:model.connection.mosad});if(epoch!==version)return;
   groups=data.categories;$('npInstitutionName').textContent=data.institution_name;
   $('npCategoriesInfo').textContent='נטענו '+groups.length+' קטגוריות מדף המוסד בנדרים פלוס.';
   fillCategories(editing?.category||'');
  }catch(e){if(epoch===version){groups=[];$('npCategoriesInfo').textContent='טעינת הקטגוריות נכשלה. אפשר לרענן ולנסות שוב.';fillCategories(editing?.category||'');}}
 }
 async function load(){
  const epoch=++version,token=vpToken;cancel();model=null;groups=[];pricePlans=[];priceGroups=[];renderPrices();$('npKey').value='';$('npInstitutionName').textContent='';$('npCategoriesInfo').textContent='';render();lock(true);message('טוען את חיבור הלקוח...');
  try{
   const data=await request('np_load');if(epoch!==version||token!==vpToken)return;
   model=data;render();message(data.connection?'':'הגדירו מספר מוסד ומפתח API עבור הלקוח שנבחר.');
   await loadCategories(epoch);await loadPrices(epoch);
  }catch(e){if(epoch===version)message(e.message,true);}
  finally{if(epoch===version)lock(false);}
 }
 async function mutate(action,body,success){
  if(busy)return;const epoch=version,token=vpToken;lock(true);message('שומר...');
  try{
   const data=await request(action,body);if(epoch!==version||token!==vpToken)return;
   if(data.rules){model.rules=data.rules;cancel();render();message(success);}
   else{await load();message(success);}
  }catch(e){if(epoch===version)message(e.message,true);}
  finally{if(epoch===version)lock(false);}
 }
 function editRule(rule=null){
  if(busy||!model?.connection)return;
  editing=rule;fillCategories(rule?.category||'');$('npAction').value=rule?.action||'renew';
  $('npEditorTitle').textContent=rule?'עריכת כלל':'הוספת כלל';$('npEditor').hidden=false;$('npEditor').scrollIntoView({behavior:'smooth',block:'nearest'});$('npCategory').focus();
 }
 window.vendpayNedarimOpen=async()=>{
  if(!vpToken){vendpayMessage('יש להתחבר לניהול תחילה');return;}
  lastFocus=document.activeElement;
  const select=$('npTenant');select.replaceChildren(new Option('בחרו לקוח',''));
  vpTenants.forEach(t=>select.add(new Option(t.display_name+' — שלוחה '+t.extension,t.id)));
  selected=$('vpCredentialTenant')?.value||vpTenants[0]?.id||'';select.value=selected;
  dialog.showModal();if(selected)await load();else{model=null;render();lock(false);message('הוסיפו לקוח בניהול VendPay לפני הגדרת החיבור.');}
 };
 window.vendpayNedarimClose=()=>{if(busy)return;dialog.close();};
 window.vendpayNedarimReset=()=>{pricePlans=[];priceGroups=[];priceEditing=null;$('npPrices').replaceChildren();$('npPriceInfo').textContent='';version++;busy=false;selected='';model=null;groups=[];cancel();$('npKey').value='';$('npRules').replaceChildren();$('npEvents').replaceChildren();dialog.close();};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{version++;$('npKey').value='';cancel();lastFocus?.focus();});
 $('npTenant').onchange=async()=>{selected=$('npTenant').value;if(selected)await load();else{version++;model=null;groups=[];pricePlans=[];priceGroups=[];renderPrices();cancel();render();lock(false);}};
 $('npAdd').onclick=()=>editRule();$('npCancel').onclick=cancel;
 $('npRefreshStatus').onclick=()=>{if(selected)load();};
 $('npRefreshCategories').onclick=async()=>{if(busy)return;lock(true);try{await loadCategories(version);}finally{lock(false);}};
 $('npConnectionForm').onsubmit=e=>{e.preventDefault();mutate('np_connect',{mosad:$('npMosad').value.trim(),api_password:$('npKey').value},'החיבור נבדק ונשמר. המפתח נשמר מוצפן.');};
 $('npEditor').onsubmit=e=>{e.preventDefault();mutate('np_rule_save',{mosad:model.connection.mosad,id:editing?.id||null,category:$('npCategory').value,rule_action:$('npAction').value},'הכלל נשמר.');};

 const dayNames=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
 let pricePlans=[],priceGroups=[],priceEditing=null;
 const money=n=>(Number(n)/100).toLocaleString('he-IL',{minimumFractionDigits:0,maximumFractionDigits:2})+' ₪';
 function pricePeriod(period={days:[],from:'08:00',to:'12:00',agorot:0}){
  const row=document.createElement('fieldset');row.className='np-period';
  const legend=document.createElement('legend');legend.textContent='טווח ימים ושעות';row.append(legend);
  const days=document.createElement('div');days.className='np-days';
  dayNames.forEach((name,i)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=String(i);input.dataset.day='';input.checked=period.days.includes(i);label.append(input,document.createTextNode(name));days.append(label);});row.append(days);
  const fields=document.createElement('div');fields.className='np-fields';
  const field=(title,type,value,key)=>{const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type=type;input.value=value;input.dataset.priceField=key;input.required=true;label.append(input);fields.append(label);return input;};
  const from=field('משעה','time',period.from,'from'),to=field('עד שעה','time',period.to==='24:00'?'23:59':period.to,'to'),amount=field('סכום מינימום בשקלים','number',String(period.agorot/100),'amount');amount.min='0';amount.max='100000';amount.step='0.01';row.append(fields);
  const full=document.createElement('label'),check=document.createElement('input');full.className='np-check';check.type='checkbox';check.dataset.full='';check.checked=period.from==='00:00'&&period.to==='24:00';full.append(check,document.createTextNode('כל היום'));row.append(full);
  const update=()=>{from.disabled=to.disabled=check.checked;};check.onchange=update;update();
  const note=document.createElement('p');note.className='np-note';note.textContent='טווח שמסתיים בשעה מוקדמת משעת ההתחלה ממשיך ליום הבא.';row.append(note);
  const remove=document.createElement('button');remove.type='button';remove.className='np-delete';remove.textContent='הסר טווח';remove.onclick=()=>row.remove();row.append(remove);
  $('npPricePeriods').append(row);
 }
 function renderPrices(){
  const root=$('npPrices');root.replaceChildren();
  if(!pricePlans.length){root.textContent='עדיין לא הוגדר תזמון. הסכומים בנדרים נשארים ללא שינוי.';return;}
  const statuses={pending:'ממתין לסנכרון',paused:'העדכון האוטומטי כבוי',synced:'הסכום אומת בנדרים',category_permission:'אין הרשאה לקריאת קטגוריות',category_missing:'הקטגוריה לא נמצאה או מפנה ליעד אחר',price_write_not_confirmed:'עדכון הסכום לא אושר. בדקו הרשאת עריכת קטגוריות במפתח API',verification_failed:'העדכון טרם אומת בנדרים'};
  pricePlans.forEach(plan=>{
   const card=document.createElement('div');card.className='np-rule';const body=document.createElement('div'),title=document.createElement('strong'),amount=document.createElement('p'),summary=document.createElement('p'),state=document.createElement('p');
   title.textContent=plan.category_name;amount.className='np-amount';amount.textContent='לפי התזמון עכשיו: '+money(plan.target_now);
   summary.className=state.className='np-note';summary.textContent='סכום רגיל: '+money(plan.default_agorot)+' · '+plan.periods.length+' טווחים · '+(plan.enabled?'פעיל':'כבוי');
   state.textContent=(statuses[plan.last_status]||'לא ניתן להשלים את העדכון. בדקו את החיבור והרשאות המפתח.')+' · בדיקה אחרונה: '+time(plan.last_checked_at)+(plan.last_observed_agorot!==null?' · נצפה בנדרים: '+money(plan.last_observed_agorot):'');
   body.append(title,amount,summary,state);
   const edit=document.createElement('button');edit.type='button';edit.className='light';edit.textContent='עריכת סכום ושעות';edit.onclick=()=>editPrice(plan);card.append(body,edit);root.append(card);
  });
 }
 async function loadPrices(epoch){
  pricePlans=[];priceGroups=[];$('npPriceEditor').hidden=true;renderPrices();
  if(!model?.connection){$('npPriceInfo').textContent='יש לחבר מוסד תחילה.';return;}
  $('npPriceInfo').textContent='טוען סכומים ותזמונים...';
  try{
   const result=await request('np_price_load',{mosad:model.connection.mosad});if(epoch!==version)return;
   pricePlans=result.plans;priceGroups=result.categories;
   $('npPriceInfo').textContent=result.provider_error?'לא ניתן לקרוא סכומים מנדרים. בדקו הרשאת רשימת קטגוריות במפתח API.':'הסכומים נטענו מנדרים. שינויים יישלחו רק לתזמונים שהפעלתם.';
   renderPrices();
  }catch(e){if(epoch===version)$('npPriceInfo').textContent=e.message;}
 }
 function editPrice(plan=null){
  if(busy||!model?.connection)return;cancel();priceEditing=plan;
  const select=$('npPriceCategory');select.replaceChildren(new Option('בחרו קטגוריה',''));
  priceGroups.forEach(g=>{const option=new Option(g.name+' — כיום '+(g.minimum===''?'ללא מינימום':g.minimum+' ₪'),g.id);option.disabled=g.redirected;select.add(option);});
  if(plan&&!priceGroups.some(g=>g.id===plan.category_id))select.add(new Option(plan.category_name,plan.category_id));
  select.value=plan?.category_id||'';select.disabled=!!plan;
  $('npPriceDefault').value=plan?String(plan.default_agorot/100):'';
  $('npPriceEnabled').checked=plan?.enabled||false;$('npPricePeriods').replaceChildren();(plan?.periods||[]).forEach(pricePeriod);
  $('npPriceTitle').textContent=plan?'עריכת תזמון סכום':'תזמון סכום מינימום חדש';$('npPriceEditor').hidden=false;$('npPriceEditor').scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 async function savePrice(event){
  event.preventDefault();if(busy||!model?.connection)return;
  const epoch=version,token=vpToken;
  const periods=[...$('npPricePeriods').children].map(row=>{
   const full=row.querySelector('[data-full]').checked,field=k=>row.querySelector('[data-price-field="'+k+'"]').value;
   return {days:[...row.querySelectorAll('[data-day]:checked')].map(el=>Number(el.value)),from:full?'00:00':field('from'),to:full?'24:00':field('to'),amount:field('amount')};
  });
  const body={mosad:model.connection.mosad,category_id:$('npPriceCategory').value,revision:priceEditing?.revision||null,enabled:$('npPriceEnabled').checked,default_amount:$('npPriceDefault').value,periods};
  lock(true);message('שומר תזמון...');
  try{
   await request('np_price_save',body);if(epoch!==version||token!==vpToken)return;
   await loadPrices(epoch);message(body.enabled?'התזמון נשמר והופעל. התוצאה תופיע לאחר הסנכרון לנדרים.':'התזמון נשמר ככבוי. הסכום בנדרים לא שונה.');
  }catch(e){if(epoch===version)message(e.message,true);}
  finally{if(epoch===version){lock(false);$('npPriceCategory').disabled=!!priceEditing;$('npPricePeriods').querySelectorAll('[data-full]').forEach(el=>{const row=el.closest('fieldset');row.querySelectorAll('input[type=time]').forEach(t=>t.disabled=el.checked);});}}
 }
 $('npPriceAdd').onclick=()=>editPrice();
 $('npPriceCancel').onclick=()=>{$('npPriceEditor').hidden=true;priceEditing=null;};
 $('npPricePeriodAdd').onclick=()=>{if($('npPricePeriods').children.length>=30){message('ניתן להגדיר עד 30 טווחים.',true);return;}pricePeriod();};
 $('npPriceCategory').onchange=()=>{
  const selectedPlan=pricePlans.find(p=>p.category_id===$('npPriceCategory').value);if(selectedPlan){editPrice(selectedPlan);return;}
  const group=priceGroups.find(g=>g.id===$('npPriceCategory').value);$('npPriceDefault').value=group?.minimum||'0';
 };
 $('npPriceEditor').onsubmit=savePrice;

})();
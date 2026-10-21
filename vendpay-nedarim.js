(()=>{
 const $=id=>document.getElementById(id),dialog=$('vpNedarimDialog');
 let selected='',model=null,groups=[],editing=null,version=0,busy=false,lastFocus=null;
 const actions={renew:'הארכת תוקף כמו בטלפון',open:'פתיחת דלת',both:'הארכת תוקף ופתיחת דלת'};
 const time=v=>v?new Date(v).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}):'טרם בוצעה';
 const message=(text,error=false)=>{$('npMessage').textContent=text;$('npMessage').classList.toggle('np-error',error);};
 function lock(value){busy=value;dialog.querySelectorAll('button,input,select').forEach(e=>e.disabled=value);if(!value){$('npAdd').disabled=!model?.connection;$('npRefreshCategories').disabled=!model?.connection;}}
 async function request(action,body={}){
  return vendpayRequest('POST',{tenant_id:selected,...body},action);
 }
 function cancel(){editing=null;$('npEditor').hidden=true;}
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
  const epoch=++version,token=vpToken;cancel();model=null;groups=[];$('npKey').value='';$('npInstitutionName').textContent='';$('npCategoriesInfo').textContent='';render();lock(true);message('טוען את חיבור הלקוח...');
  try{
   const data=await request('np_load');if(epoch!==version||token!==vpToken)return;
   model=data;render();message(data.connection?'':'הגדירו מספר מוסד ומפתח API עבור הלקוח שנבחר.');
   await loadCategories(epoch);
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
 window.vendpayNedarimReset=()=>{version++;busy=false;selected='';model=null;groups=[];cancel();$('npKey').value='';$('npRules').replaceChildren();$('npEvents').replaceChildren();dialog.close();};
 dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 dialog.addEventListener('close',()=>{version++;$('npKey').value='';cancel();lastFocus?.focus();});
 $('npTenant').onchange=async()=>{selected=$('npTenant').value;if(selected)await load();else{version++;model=null;groups=[];cancel();render();lock(false);}};
 $('npAdd').onclick=()=>editRule();$('npCancel').onclick=cancel;
 $('npRefreshStatus').onclick=()=>{if(selected)load();};
 $('npRefreshCategories').onclick=async()=>{if(busy)return;lock(true);try{await loadCategories(version);}finally{lock(false);}};
 $('npConnectionForm').onsubmit=e=>{e.preventDefault();mutate('np_connect',{mosad:$('npMosad').value.trim(),api_password:$('npKey').value},'החיבור נבדק ונשמר. המפתח נשמר מוצפן.');};
 $('npEditor').onsubmit=e=>{e.preventDefault();mutate('np_rule_save',{mosad:model.connection.mosad,id:editing?.id||null,category:$('npCategory').value,rule_action:$('npAction').value},'הכלל נשמר.');};
})();
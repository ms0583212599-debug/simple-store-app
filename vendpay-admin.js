
const VP_BASE='https://ksddrcalmszxxcuxoznd.supabase.co';
const VP_KEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
let vpToken='',vpExpires=0,vpTenants=[];
function vendpayFilterRows(){const q=document.getElementById('vendpayFilter').value.trim().toLocaleLowerCase('he');document.querySelectorAll('#vendpayCustomers tr[data-vp-search]').forEach(row=>{row.hidden=!row.dataset.vpSearch.includes(q);});}
function vendpayMessage(message){document.getElementById('vendpayMessage').textContent=message;}
function vendpayClose(){vendpayLogout();if(document.body.classList.contains('vp-standalone')){document.getElementById('vendpayEmail').focus();}else{document.getElementById('vendpayPanel').classList.add('hidden');}}
function vendpayLogout(){window.vendpayNedarimReset?.();vpVoiceMessages=[];document.getElementById('vpVoiceRows').replaceChildren();document.getElementById('vpVoicePanel').classList.add('hidden');document.getElementById('vpLogRows').replaceChildren();document.getElementById('vpLogPanel').classList.add('hidden');vendpayClearConfig();vpTenants=[];vpToken='';vpExpires=0;document.getElementById('vendpayPassword').value='';['vpCredentialUser','vpCredentialPass','vpCredentialCode'].forEach(id=>document.getElementById(id).value='');document.getElementById('vendpayLogin').classList.remove('hidden');document.getElementById('vendpayWorkspace').classList.add('hidden');document.getElementById('vendpayCustomers').replaceChildren();document.getElementById('vendpayEmail').value='';vendpayMessage('');}


async function vendpaySignIn(){
 const email=document.getElementById('vendpayEmail').value.trim(),password=document.getElementById('vendpayPassword').value;
 if(!email||!password){vendpayMessage('יש להזין מייל וסיסמה');return;}
 vendpayMessage('מאמת פרטים...');
 try{
  const r=await fetch(VP_BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':VP_KEY,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data=await r.json();document.getElementById('vendpayPassword').value='';
  if(!r.ok||!data.access_token)throw Error('פרטי הכניסה לא אושרו');
  vpToken=data.access_token;vpExpires=Date.now()+Math.max(0,(data.expires_in||3600)-60)*1000;
  await vendpayLoad();
  document.getElementById('vendpayLogin').classList.add('hidden');document.getElementById('vendpayWorkspace').classList.remove('hidden');await vendpayOpenSelected();
 }catch(e){vpToken='';vpExpires=0;vendpayMessage(e.message||'החיבור נכשל');}
}
async function vendpayRequest(method,body,action=''){
 if(!vpToken||Date.now()>vpExpires){vendpayLogout();throw Error('יש להתחבר מחדש');}
 const r=await fetch(VP_BASE+'/functions/v1/vendpay-tenants-admin'+(action?'?action='+encodeURIComponent(action):''),{method,headers:{'apikey':VP_KEY,'authorization':'Bearer '+vpToken,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(({ 'Access denied':'אין הרשאה לחשבון זה','Extension already exists':'מספר השלוחה כבר קיים','Origin not allowed':'כתובת האתר אינה מורשית'})[data.error]||data.error||'שגיאת שרת');
 return data;
}
async function vendpayLoad(){
 vendpayMessage('טוען לקוחות...');
 try{
  const data=await vendpayRequest('GET');vpTenants=data.tenants||[];const logs=document.getElementById('vpLogTenant'),savedLog=logs.value;logs.replaceChildren(new Option('כל הלקוחות והחשבון המקורי',''));vpTenants.forEach(t=>logs.add(new Option(t.display_name,t.id)));logs.value=savedLog;const root=document.getElementById('vendpayCustomers');root.replaceChildren();
  const select=document.getElementById('vpCredentialTenant');if(select){const previous=select.value;select.replaceChildren(new Option('בחר לקוח',''));(data.tenants||[]).forEach(t=>select.add(new Option(t.display_name+' — '+t.extension,t.id)));select.value=vpTenants.some(t=>t.id===previous)?previous:(vpTenants.length===1?vpTenants[0].id:'');vendpaySelectTenant();}
  if(!data.tenants?.length){root.textContent='עדיין לא נוספו לקוחות';vendpayMessage('');return;}
  const table=document.createElement('table'),head=document.createElement('tr');
  ['שם לקוח','שלוחה','פעילות','חיבור VendPay24','בדיקה אחרונה','פעולות'].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th);});table.append(head);
  data.tenants.forEach(t=>{const tr=document.createElement('tr');tr.dataset.vpSearch=(String(t.display_name)+' '+String(t.extension)).toLocaleLowerCase('he');[t.display_name,t.extension,t.is_active?'פעיל':'לא פעיל',({not_configured:'לא הוגדר',pending:'ממתין',connected:'מחובר',failed:'שגיאת חיבור'})[t.connection_status]||'לא ידוע',t.last_checked_at?new Date(t.last_checked_at).toLocaleString('he-IL'):'טרם נבדק'].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});const td=document.createElement('td'),copy=document.createElement('button');copy.className='light';copy.type='button';copy.textContent='העתק שלוחה';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(String(t.extension));vendpayMessage('מספר השלוחה הועתק');}catch{vendpayMessage('לא ניתן להעתיק אוטומטית');}});td.append(copy);const manage=document.createElement('button');manage.className='blue';manage.type='button';manage.textContent='ניהול וחיבור';manage.addEventListener('click',()=>{document.getElementById('vpCredentialTenant').value=t.id;vendpaySelectTenant(true);document.getElementById('vpSavedConnection').scrollIntoView({behavior:'smooth',block:'center'});});td.append(manage);tr.append(td);table.append(tr);});
  root.append(table);vendpayFilterRows();vendpayMessage('נמצאו '+data.tenants.length+' לקוחות');
 }catch(e){vendpayMessage(e.message||'טעינה נכשלה');throw e;}
}
async function vendpayCheckAdmin(){
 vendpayMessage('בודק את ההרשאה מול Supabase...');
 try{const data=await vendpayRequest('GET');vendpayMessage('החיבור ל-Supabase והרשאת המנהל תקינים. נמצאו '+(data.tenants?.length||0)+' לקוחות. בדיקה זו אינה בודקת חיבור ל-VendPay24.');}
 catch(e){vendpayMessage('בדיקת החיבור נכשלה: '+(e.message||'שגיאה לא ידועה'));}
}
async function vendpayCheckConnection(){
 const tenant_id=document.getElementById('vpCredentialTenant').value;
 if(!tenant_id){vendpayMessage('יש לבחור לקוח לבדיקה');return;}
 if(vpChecking.has(tenant_id))return;vpChecking.add(tenant_id);const session=vpToken;document.getElementById('vpSavedConnection').textContent='בודק את החיבור באמצעות הפרטים השמורים...';
 vendpayMessage('בודק חיבור VendPay24 ללקוח שנבחר...');
 try{
  const result=await vendpayRequest('POST',{tenant_id},'check_connection');
  if(session!==vpToken||document.getElementById('vpCredentialTenant').value!==tenant_id)return;
  await vendpayLoad();
  if(session!==vpToken||document.getElementById('vpCredentialTenant').value!==tenant_id)return;
  document.getElementById('vpSavedConnection').textContent=result.connected?'החיבור תקין — נבדק כעת באמצעות הפרטים השמורים':'בדיקת החיבור נכשלה. אפשר לנסות שוב או לפתוח עדכון פרטי התחברות';
  if(vpTenants.find(t=>t.id===tenant_id)?.is_active)await vendpayShowConfig();
  vendpayMessage(result.connected?'החיבור ל-VendPay24 תקין. מצב ההפעלה מופיע בטבלה.':'בדיקת החיבור נכשלה: '+(result.reason==='credentials_need_code'?'יש לשמור מחדש שם משתמש וסיסמה':result.reason==='terminal_list_unavailable'?'לא התקבלה רשימת דלתות תקינה מהחשבון':result.reason||'שגיאה לא ידועה'));
 }catch(e){if(session===vpToken&&document.getElementById('vpCredentialTenant').value===tenant_id)vendpayMessage('בדיקת החיבור נכשלה: '+(e.message||'שגיאה לא ידועה'));}finally{vpChecking.delete(tenant_id);}
}
async function vendpaySaveCredentials(){
 const tenant_id=document.getElementById('vpCredentialTenant').value,username=document.getElementById('vpCredentialUser').value.trim(),password=document.getElementById('vpCredentialPass').value,code=document.getElementById('vpCredentialCode').value;
 if(!tenant_id||!username||!password){vendpayMessage('בחר לקוח והזן שם משתמש וסיסמה');return;}
 vendpayMessage('שומר פרטי התחברות מוצפנים...');
 try{await vendpayRequest('POST',{tenant_id,username,password,code,rememberMe:false,role:''},'save_credentials');document.getElementById('vpCredentialPass').value='';document.getElementById('vpCredentialCode').value='';document.getElementById('vpCredentialUser').value='';await vendpayLoad();await vendpayCheckConnection();}
 catch(e){vendpayMessage(e.message||'השמירה נכשלה');}
}
function vendpayClearConfig(){['vpCheckConfig','vpOpenConfig','vpCreateConfig','vpEditConfig','vpPriceZonesConfig','vpModeZonesConfig','vpSummaryConfig','vpReportsConfig'].forEach(id=>document.getElementById(id).value='');document.getElementById('vpConfigPanel').classList.add('hidden');}
function vendpaySelectTenant(auto=false){
 vendpayClearConfig();['vpCredentialUser','vpCredentialPass','vpCredentialCode'].forEach(id=>document.getElementById(id).value='');
 const t=vpTenants.find(t=>t.id===document.getElementById('vpCredentialTenant').value);
 const saved=!!t&&t.connection_status!=='not_configured';document.getElementById('vpCredentialsEditor').open=!!t&&!saved;document.getElementById('vpSavedConnection').textContent=!t?'בחרו לקוח':saved?'פרטי החיבור שמורים. אין צורך להזין אותם מחדש.':'לקוח חדש — יש להזין פרטי התחברות פעם אחת';
 const select=document.getElementById('vpTerminal');select.replaceChildren(new Option('בחרו דלת',''));(t?.discovered_terminals||[]).forEach(x=>select.add(new Option(x.description+' — '+x.terminal_id,String(x.terminal_id))));select.value=t?.terminal_id?String(t.terminal_id):'';document.getElementById('vpGateStatus').value='2';if(auto)void vendpayOpenSelected();
}
const vpChecking=new Set();
async function vendpayOpenSelected(){
 const tenant_id=document.getElementById('vpCredentialTenant').value;const t=vpTenants.find(x=>x.id===tenant_id);
 if(!t||t.connection_status==='not_configured')return;
 await vendpayCheckConnection();
}
async function vendpaySetActive(active){
 const tenant_id=document.getElementById('vpCredentialTenant').value;
 if(!tenant_id){vendpayMessage('בחר לקוח');return;}
 const terminal=document.getElementById('vpTerminal').value,gate=document.getElementById('vpGateStatus').value;
 if(active&&(!terminal||!gate)){vendpayMessage('בצעו בדיקת חיבור ובחרו דלת מהרשימה');return;}
 if(active&&!confirm('הפעלת הלקוח תאפשר פתיחת הדלת וניהול מנויים מהשלוחות שתגדירו עבורו. להפעיל?'))return;
 try{await vendpayRequest('POST',{tenant_id,active,terminal_id:Number(terminal),gate_status:Number(gate)},'set_active');await vendpayLoad();if(active)await vendpayShowConfig();vendpayMessage(active?'הלקוח הופעל. לחצו על הצג הגדרות שלוחה והעתיקו לימות המשיח.':'הלקוח הושבת.');}
 catch(e){vendpayMessage(e.message==='Run connection check before activation'?'יש לבצע בדיקת חיבור חדשה לפני ההפעלה':e.message||'הפעולה נכשלה');}
}
async function vendpayShowConfig(){
 const tenant_id=document.getElementById('vpCredentialTenant').value;if(!tenant_id){vendpayMessage('בחר לקוח');return;}
 try{const session=vpToken;const result=await vendpayRequest('POST',{tenant_id},'ivr_config');if(session!==vpToken||document.getElementById('vpCredentialTenant').value!==tenant_id)return;
 document.getElementById('vpCheckConfig').value=result.health_config;document.getElementById('vpOpenConfig').value=result.open_config;document.getElementById('vpCreateConfig').value=result.create_config||'';document.getElementById('vpEditConfig').value=result.edit_config||'';document.getElementById('vpPriceZonesConfig').value=result.price_zones_config||'';document.getElementById('vpModeZonesConfig').value=result.mode_zones_config||'';document.getElementById('vpSummaryConfig').value=result.summary_config||'';document.getElementById('vpReportsConfig').value=result.reports_config||'';document.getElementById('vpConfigPanel').classList.remove('hidden');vendpayMessage('העתיקו כל הגדרה לשלוחה נפרדת לפי הפעולה. בדיקת החיבור אינה משנה נתונים. הוספה ועריכה נשמרות רק לאחר אישור בטלפון.');}
 catch(e){vendpayMessage(e.message==='Activate customer first'?'יש להפעיל את הלקוח תחילה':e.message||'לא ניתן לטעון הגדרות');}
}

let vpVoiceMessages=[];
async function vendpayLoadVoice(){
 const token=vpToken;document.getElementById('vpVoicePanel').classList.remove('hidden');document.getElementById('vpVoiceStatus').textContent='טוען הודעות';
 try{const data=await vendpayRequest('GET',undefined,'voice_messages');if(token!==vpToken)return;vpVoiceMessages=data.messages||[];const select=document.getElementById('vpVoiceSource'),value=select.value;select.replaceChildren(new Option('כל החיבורים',''));const sources=new Map(vpVoiceMessages.map(e=>[e.source,e.situation.split(' ← ')[0]]));for(const [id,label] of sources)select.add(new Option(label,id));select.value=value;vendpayRenderVoice();document.getElementById('vpVoicePanel').scrollIntoView({behavior:'smooth',block:'start'});}catch(e){document.getElementById('vpVoiceStatus').textContent=e.message;}
}
function vendpayRenderVoice(){
 const root=document.getElementById('vpVoiceRows');root.replaceChildren();const source=document.getElementById('vpVoiceSource').value,search=document.getElementById('vpVoiceSearch').value.trim();const groups=new Map();
 for(const e of vpVoiceMessages){if(source&&e.source!==source)continue;if(search&&![e.text,e.situation,e.override?.text||''].some(s=>s.includes(search)))continue;const key=e.text;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(e);}
 document.getElementById('vpVoiceStatus').textContent=groups.size+' נוסחים מוצגים — בחרו מצב וערכו את המלל';
 for(const entries of groups.values()){
 const card=document.createElement('details');card.className='card';const heading=document.createElement('summary');heading.style.cursor='pointer';heading.textContent=entries[0].text.slice(0,110)+(entries[0].text.length>110?'…':'')+(entries.some(e=>e.override)?' — נוסח מותאם':'');card.append(heading);
 const when=document.createElement('p');when.className='msg';card.append(when);const choice=document.createElement('select');choice.setAttribute('aria-label','מתי ההודעה מושמעת');entries.forEach((e,i)=>choice.add(new Option(e.situation,String(i))));if(entries.length>1)choice.add(new Option('כל המצבים המוצגים של הנוסח הזה','all'));card.append(choice);
 const input=document.createElement('textarea');input.rows=5;input.maxLength=2000;input.dir='rtl';input.setAttribute('aria-label','נוסח ההודעה');card.append(input);
 const variables=document.createElement('p');variables.className='msg';variables.textContent=entries[0].variables.length?'פרטים שהמערכת ממלאת בזמן השיחה: '+entries[0].variables.map(v=>'{'+v+'}').join(' ')+' — יש להשאיר כל סימון פעם אחת':'הודעה ללא משתנים';card.append(variables);
 const note=document.createElement('p');note.className='msg';note.textContent='הנוסח ייכנס לתוקף בהשמעה הבאה לאחר השמירה בכל לקוחות החיבור שבחרתם. שמרו על הוראות המקשים. בהודעה המורכבת ממקטעים, נוסח מותאם של ההודעה השלמה גובר על מקטע מותאם.';card.append(note);
 const result=document.createElement('p');result.setAttribute('role','status');const selected=()=>choice.value==='all'?entries:[entries[Number(choice.value)]];
 const change=()=>{const chosen=selected();when.textContent='מתי נשמע: '+(choice.value==='all'?'בכל '+entries.length+' המצבים המוצגים':chosen[0].situation);input.value=chosen[0].override?.text??chosen[0].text;result.textContent=chosen.some(e=>(e.override?.text??e.text)!==input.value)?'קיימים נוסחים שונים — שמירה תאחד את המצבים שנבחרו':'';};choice.onchange=change;change();
 const buttons=document.createElement('div');buttons.className='actions';const save=document.createElement('button'),reset=document.createElement('button');save.type=reset.type='button';save.className='green';reset.className='light';save.textContent='שמור נוסח';reset.textContent='החזר לברירת המחדל';
 const submit=async(resetDefault)=>{const chosen=selected(),ids=chosen.map(e=>e.id),text=input.value,token=vpToken;save.disabled=reset.disabled=choice.disabled=true;try{await vendpayRequest('POST',{ids,text,reset:resetDefault},'voice_save');if(token!==vpToken)return;for(const e of chosen)e.override=resetDefault?null:{text};change();heading.textContent=entries[0].text.slice(0,110)+(entries.some(e=>e.override)?' — נוסח מותאם':'');result.textContent=resetDefault?'נוסח ברירת המחדל הוחזר':'הנוסח נשמר ויחול בהשמעה הבאה';}catch(e){result.textContent=e.message;}finally{save.disabled=reset.disabled=choice.disabled=false;}};
 save.onclick=()=>submit(false);reset.onclick=()=>submit(true);buttons.append(save,reset);card.append(buttons,result);root.append(card);
 }
}

async function vendpayLoadLog(){
 const root=document.getElementById('vpLogRows');document.getElementById('vpLogPanel').classList.remove('hidden');root.textContent='טוען יומן...';
 try{
 const params=new URLSearchParams({action:'operation_log'});
 const tenant=document.getElementById('vpLogTenant').value,kind=document.getElementById('vpLogKind').value;
 if(tenant)params.set('tenant_id',tenant);if(kind)params.set('kind',kind);
 const since=document.getElementById('vpLogSince').value,until=document.getElementById('vpLogUntil').value;
 // Date-only filters cover complete Israeli civil days including summer/winter time.
 function boundary(day,end){const guess=new Date(day+'T12:00:00Z'),parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Jerusalem',timeZoneName:'longOffset'}).formatToParts(guess);const offset=parts.find(x=>x.type==='timeZoneName').value.replace('GMT','');return new Date(day+(end?'T23:59:59.999':'T00:00:00.000')+offset).toISOString();}
 if(since)params.set('since',boundary(since,false));if(until)params.set('until',boundary(until,true));
 if(!vpToken||Date.now()>vpExpires){vendpayLogout();return;}
 const token=vpToken;const r=await fetch(VP_BASE+'/functions/v1/vendpay-tenants-admin?'+params,{headers:{apikey:VP_KEY,authorization:'Bearer '+token}});const data=await r.json();
 if(token!==vpToken)return;if(!r.ok)throw Error('לא ניתן לטעון את היומן');root.replaceChildren();
 if(!data.events?.length){root.textContent='לא נמצאו פעולות בטווח שנבחר';return;}
 const actions={summary:'סיכום מנויים',price_zones:'אזורי מחיר',mode_zones:'אזורי מצב',open:'פתיחת דלת',create:'הוספת מנוי',edit:'עריכת מנוי',check:'בדיקת חיבור',health:'בדיקת שלוחה',request:'בקשה',activate:'הפעלת לקוח',deactivate:'השבתת לקוח',save_credentials:'עדכון פרטי חיבור',check_connection:'בדיקת חיבור',create_tenant:'יצירת לקוח'};
 const results={summary:'סיכום נתונים — קריאה בלבד',prompt:'שלב בשיחה — ממתין לקלט',confirmed:'השמירה אומתה בהצלחה',command_sent:'פקודת פתיחה נשלחה',command_http_ok:'פקודת פתיחה נשלחה',check_http_ok:'בדיקת תקשורת הסתיימה',check_ok:'חיבור תקין',health:'שלוחה תקינה',saved:'נשמר',connected:'מחובר',pending:'ממתין לבדיקה',cancelled:'בוטל',uncertain:'תוצאה לא ודאית — יש לבדוק באתר',conflict:'הפרטים השתנו — לא נשמר שינוי',duplicate:'בקשה כפולה — לא נשלחה שוב',busy:'פעולה כבר בטיפול',card_exists:'מספר הכרטיס כבר קיים',inactive:'לקוח לא פעיל',disabled:'השמירה אינה פעילה',unauthorized:'בקשה ללא הרשאה',authentication_failed:'התחברות נכשלה',error:'שגיאה',invalid_input:'קלט לא תקין',hangup:'סיום שיחה',hangup_ignored:'סיום שיחה — ללא פעולה',expired:'זמן העריכה הסתיים',rate_limited:'הגבלת ניסיונות',missing_call:'חסרים פרטי שיחה'};
 const table=document.createElement('table'),head=document.createElement('tr');['שעה','לקוח','פעולה','תוצאה','HTTP','זמן תגובה','שיחה'].forEach(label=>{const th=document.createElement('th');th.textContent=label;head.append(th);});table.append(head);
 data.events.forEach(e=>{const tr=document.createElement('tr');const customer=e.tenant_id?(vpTenants.find(t=>t.id===e.tenant_id)?.display_name||'לקוח'):e.source.startsWith('vendpay-tenant-')?'לא זוהה':'החשבון המקורי';const result=results[e.result]||(e.result.startsWith('authentication_failed')?'חידוש התחברות נכשל':e.result);[new Date(e.created_at).toLocaleString('he-IL',{timeZone:'Asia/Jerusalem'}),customer,actions[e.action]||e.action,result,e.http_status??'—',e.duration_ms==null?'—':(e.duration_ms/1000).toFixed(2)+' שניות',e.call_hash?.slice(0,10)||'—'].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});table.append(tr);});root.append(table);
 document.getElementById('vpLogPanel').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){root.textContent=e.message||'טעינת היומן נכשלה';}
}
async function vendpayCreate(){
 const display_name=document.getElementById('vendpayName').value.trim(),extension=document.getElementById('vendpayExtension').value.trim();
 if(!display_name||!/^[0-9]{1,8}$/.test(extension)){vendpayMessage('יש להזין שם ומספר שלוחה תקין');return;}
 vendpayMessage('שומר לקוח...');
 try{await vendpayRequest('POST',{display_name,extension});document.getElementById('vendpayName').value='';document.getElementById('vendpayExtension').value='';await vendpayLoad();const created=vpTenants.find(t=>String(t.extension)===extension);if(created){document.getElementById('vpCredentialTenant').value=created.id;vendpaySelectTenant();}vendpayMessage('הלקוח נוסף. הזינו פרטי התחברות פעם אחת');}catch(e){vendpayMessage(e.message||'השמירה נכשלה');}
}

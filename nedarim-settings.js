(function(){
let paySettings={mosad:'',api_valid:'',groupe:''};

async function getPublicPaymentSettings(){
  try{
    let r=await req('/rest/v1/rpc/get_payment_settings_public',{method:'POST',body:'{}'}),x=Array.isArray(r)?r[0]:r;
    if(x)paySettings=x;
  }catch(e){console.warn('payment settings',e)}
  return paySettings;
}
async function getAdminPaymentSettings(){
  let r=await req('/rest/v1/payment_settings?id=eq.1&select=mosad,api_valid,groupe'),x=Array.isArray(r)?r[0]:r;
  if(x)paySettings=x;
  return paySettings;
}
async function fetchGroups(mosad){
  mosad=String(mosad||'').trim();
  if(!/^\d{7}$/.test(mosad))throw new Error('מספר מוסד חייב להכיל 7 ספרות');
  let r=await fetch('https://www.matara.pro/nedarimplus/online/Files/Manage.aspx?Action=GetMosad&MosadId='+encodeURIComponent(mosad)),t=await r.text(),d;
  try{d=JSON.parse(t)}catch{throw new Error(t||'לא ניתן לטעון את פרטי המוסד')}
  if(d.Status)throw new Error(d.Message||'המוסד אינו זמין לתשלום');
  let groups=[];
  try{
    let n=typeof d.NewGroupe==='string'?JSON.parse(d.NewGroupe):d.NewGroupe;
    if(Array.isArray(n))groups=n.map(x=>({id:x.id,name:x.Name||'',redirect:x.GoToMosad||''})).filter(x=>x.name);
  }catch(e){}
  if(!groups.length&&d.Groupe)groups=String(d.Groupe).split(',').map(x=>({name:x.trim()})).filter(x=>x.name);
  return groups;
}
function ensureUI(){
  if(!admin)return;
  let host=document.getElementById('admin'),menu=host?.querySelector('.adminmenu');
  if(!host||!menu)return;
  if(!document.getElementById('nedarimSettingsMenuButton')){
    let button=document.createElement('button');
    button.id='nedarimSettingsMenuButton';
    button.className='green';
    button.type='button';
    button.textContent='פרטי חשבון נדרים פלוס';
    button.onclick=openProtectedSettings;
    menu.appendChild(button);
  }
  if(!document.getElementById('nedarimSettingsTab')){
    let tab=document.createElement('div');
    tab.id='nedarimSettingsTab';
    tab.className='adminTab hidden';
    tab.innerHTML='<div class="card form" style="max-width:650px;margin:auto"><div class="bar"><h3>פרטי חשבון נדרים פלוס</h3><button type="button" class="light" id="nedarimSettingsBack">חזרה</button></div><p class="msg">החשבון שאליו יועברו התשלומים במערכת.</p><label>מספר מוסד</label><input id="nedarimMosad" inputmode="numeric" maxlength="7"><label>קוד ApiValid</label><input id="nedarimApiValid" autocomplete="off" maxlength="20"><div class="row-actions" style="margin-top:8px"><button type="button" class="light" id="nedarimLoadGroups">טען קטגוריות</button></div><label>קטגוריה לקבלת התשלומים</label><select id="nedarimGroupe"><option value="">ללא קטגוריה</option></select><div id="nedarimSettingsMsg" class="msg"></div><button type="button" class="green" id="nedarimSave">שמור פרטי חשבון</button></div>';
    host.appendChild(tab);
    document.getElementById('nedarimLoadGroups').onclick=()=>loadGroupsUI();
    document.getElementById('nedarimSave').onclick=saveSettings;
    document.getElementById('nedarimSettingsBack').onclick=()=>adminTab('productsTab');
  }
  if(!document.getElementById('nedarimAuthModal')){
    let modal=document.createElement('div');
    modal.id='nedarimAuthModal';
    modal.className='modal hidden';
    modal.innerHTML='<div class="modal-card form" style="max-width:430px"><div class="bar"><h3>אימות כניסה</h3><button type="button" class="light" id="nedarimAuthClose">סגור</button></div><p class="msg">כדי לפתוח את פרטי חשבון נדרים פלוס, הזן שוב את קוד הכניסה לניהול.</p><label>קוד כניסה</label><input id="nedarimAuthPassword" type="password" autocomplete="current-password"><div id="nedarimAuthMsg" class="msg"></div><button type="button" class="green" id="nedarimAuthSubmit" style="width:100%">פתח פרטי חשבון</button></div>';
    document.body.appendChild(modal);
    document.getElementById('nedarimAuthClose').onclick=closeProtectedSettingsAuth;
    document.getElementById('nedarimAuthSubmit').onclick=verifyProtectedSettings;
    document.getElementById('nedarimAuthPassword').onkeydown=e=>{if(e.key==='Enter')verifyProtectedSettings()};
  }
}
function openProtectedSettings(){
  if(!admin)return alert('יש להיכנס לניהול תחילה');
  ensureUI();
  let input=document.getElementById('nedarimAuthPassword'),msg=document.getElementById('nedarimAuthMsg');
  input.value='';msg.textContent='';
  document.getElementById('nedarimAuthModal').classList.remove('hidden');
  setTimeout(()=>input.focus(),0);
}
function closeProtectedSettingsAuth(){
  document.getElementById('nedarimAuthModal')?.classList.add('hidden');
  let input=document.getElementById('nedarimAuthPassword');if(input)input.value='';
}
async function verifyProtectedSettings(){
  let input=document.getElementById('nedarimAuthPassword'),msg=document.getElementById('nedarimAuthMsg'),button=document.getElementById('nedarimAuthSubmit');
  let password=input.value;
  if(!password){msg.textContent='הזן קוד כניסה';return}
  button.disabled=true;msg.textContent='בודק...';
  try{
    let r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:ADMIN_EMAIL,password})});
    if(!r.ok){msg.textContent='קוד הכניסה שגוי';input.select();return}
    closeProtectedSettingsAuth();
    adminTab('nedarimSettingsTab');
    await loadSettingsUI();
  }catch(e){msg.textContent='האימות נכשל. נסה שוב.'}
  finally{button.disabled=false}
}
async function loadSettingsUI(){
  let msg=document.getElementById('nedarimSettingsMsg');
  try{
    msg.textContent='טוען פרטי חשבון...';
    let s=await getAdminPaymentSettings();
    document.getElementById('nedarimMosad').value=s.mosad||'';
    document.getElementById('nedarimApiValid').value=s.api_valid||'';
    await loadGroupsUI(s.groupe||'');
  }catch(e){msg.textContent='טעינת ההגדרות נכשלה: '+e.message}
}
async function loadGroupsUI(selected){
  let msg=document.getElementById('nedarimSettingsMsg'),sel=document.getElementById('nedarimGroupe');
  try{
    msg.textContent='טוען קטגוריות...';
    let groups=await fetchGroups(document.getElementById('nedarimMosad').value);
    sel.innerHTML='<option value="">ללא קטגוריה</option>'+groups.map(g=>'<option value="'+esc(g.name)+'">'+esc(g.name)+(g.redirect?' (מפנה למוסד אחר)':'')+'</option>').join('');
    let wanted=selected!==undefined?selected:paySettings.groupe;
    if(wanted&&![...sel.options].some(o=>o.value===wanted)){let o=document.createElement('option');o.value=wanted;o.textContent=wanted;sel.appendChild(o)}
    sel.value=wanted||'';
    msg.textContent=groups.length?'נטענו '+groups.length+' קטגוריות':'לא נמצאו קטגוריות במוסד';
  }catch(e){msg.textContent='טעינת הקטגוריות נכשלה: '+e.message}
}
async function saveSettings(){
  let mosad=document.getElementById('nedarimMosad').value.trim(),api=document.getElementById('nedarimApiValid').value.trim(),groupe=document.getElementById('nedarimGroupe').value;
  if(!/^\d{7}$/.test(mosad))return alert('מספר מוסד חייב להכיל 7 ספרות');
  if(!api)return alert('הזן ApiValid');
  try{
    await req('/rest/v1/payment_settings?id=eq.1',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({mosad,api_valid:api,groupe,updated_at:new Date().toISOString()})});
    paySettings={mosad,api_valid:api,groupe};
    alert('פרטי חשבון נדרים פלוס נשמרו בהצלחה');
  }catch(e){alert('שמירת ההגדרות נכשלה: '+e.message)}
}
window.getNedarimPaymentSettings=getPublicPaymentSettings;
window.ensureNedarimSettings=ensureUI;
let oldRender=window.renderAdmin;
if(typeof oldRender==='function')window.renderAdmin=function(){let r=oldRender.apply(this,arguments);setTimeout(ensureUI,0);return r};
setTimeout(ensureUI,300);
})();
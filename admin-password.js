(function(){
  async function changeAdminPassword(){
    if(!token||!admin)return alert('יש להיכנס לניהול תחילה');
    let current=prompt('הזן את הסיסמה הנוכחית');if(current===null)return;
    let next=prompt('הזן סיסמה חדשה (לפחות 6 תווים)');if(next===null)return;
    if(next.length<6)return alert('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
    let again=prompt('הזן שוב את הסיסמה החדשה');if(again===null)return;
    if(next!==again)return alert('הסיסמאות החדשות אינן זהות');
    try{
      let check=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({email:ADMIN_EMAIL,password:current})});
      if(!check.ok)return alert('הסיסמה הנוכחית אינה נכונה');
      let r=await fetch(BASE+'/auth/v1/user',{method:'PUT',headers:{apikey:KEY,'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({password:next})});
      let text=await r.text();if(!r.ok)throw new Error(text||'שגיאה');
      alert('הסיסמה הוחלפה בהצלחה');
    }catch(e){alert('החלפת הסיסמה נכשלה: '+(e.message||e))}
  }
  window.changeAdminPassword=changeAdminPassword;
  function addButton(){let admin=document.getElementById('admin');if(!admin||document.getElementById('changeAdminPasswordBtn'))return;let actions=admin.querySelector('.bar .actions');if(!actions)return;let b=document.createElement('button');b.id='changeAdminPasswordBtn';b.className='light';b.type='button';b.textContent='החלפת סיסמה';b.onclick=changeAdminPassword;actions.prepend(b)}
  window.addEventListener('load',()=>setTimeout(addButton,0));setTimeout(addButton,500);
})();
(function(){
  async function syncButton(){
    const charge=document.getElementById('chargeBtn');
    if(!charge)return;
    let btn=document.getElementById('savedCardPayBtn');
    let settings={};
    try{if(window.getNedarimPaymentSettings)settings=await window.getNedarimPaymentSettings()||{}}catch(e){}
    if(!settings.show_saved_card_button){if(btn)btn.remove();return}
    if(btn)return;
    btn=document.createElement('button');btn.id='savedCardPayBtn';btn.type='button';btn.className='light';btn.textContent='תשלום עם כרטיס שמור בנדרים פלוס';btn.style.width='100%';btn.style.marginTop='10px';
    btn.onclick=function(){alert('אפשרות התשלום בכרטיס שמור נמצאת כעת במצב ניסוי. לאחר פתיחת התשלום המערכת תבדוק את העסקה מול היסטוריית העסקאות.')};
    charge.insertAdjacentElement('afterend',btn);
  }
  window.ensureSavedCardPaymentButton=syncButton;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncButton);else syncButton();
  const oldStart=window.startPayment;if(oldStart)window.startPayment=async function(){const r=await oldStart.apply(this,arguments);await syncButton();return r};
})();

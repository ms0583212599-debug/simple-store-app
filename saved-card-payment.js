(function(){
  async function syncButton(){
    const charge=document.getElementById('chargeBtn');if(!charge)return;
    let btn=document.getElementById('savedCardPayBtn'),settings={};
    try{if(window.getNedarimPaymentSettings)settings=await window.getNedarimPaymentSettings()||{}}catch(e){}
    if(!settings.show_saved_card_button){if(btn)btn.remove();return}
    if(btn)return;
    btn=document.createElement('button');btn.id='savedCardPayBtn';btn.type='button';btn.className='light';btn.textContent='תשלום עם כרטיס שמור בנדרים פלוס';btn.style.width='100%';btn.style.marginTop='10px';
    btn.onclick=async function(){
      const s=window.getNedarimPaymentSettings?await window.getNedarimPaymentSettings():settings;
      const mosad=String(s?.mosad||'').trim();if(!/^\d{7}$/.test(mosad))return alert('מספר המוסד בנדרים פלוס אינו מוגדר');
      if(!window.saleToken)return alert('לא נמצאה מכירה ממתינה לתשלום');
      try{sessionStorage.setItem('nedarimSavedCardSaleToken',String(window.saleToken));sessionStorage.setItem('nedarimSavedCardStartedAt',new Date().toISOString())}catch(e){}
      const url='https://www.matara.pro/nedarimplus/online/?mosad='+encodeURIComponent(mosad);
      const w=window.open(url,'_blank','noopener');if(!w)window.location.href=url;
    };
    charge.insertAdjacentElement('afterend',btn);
  }
  window.ensureSavedCardPaymentButton=syncButton;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',syncButton);else syncButton();
  const oldStart=window.startPayment;if(oldStart)window.startPayment=async function(){const r=await oldStart.apply(this,arguments);await syncButton();return r};
})();

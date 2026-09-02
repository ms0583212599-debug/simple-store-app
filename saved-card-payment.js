(function(){
  function addButton(){
    const charge=document.getElementById('chargeBtn');
    if(!charge||document.getElementById('savedCardPayBtn'))return;
    const btn=document.createElement('button');
    btn.id='savedCardPayBtn';
    btn.type='button';
    btn.className='light';
    btn.textContent='תשלום עם כרטיס שמור בנדרים פלוס';
    btn.style.width='100%';
    btn.style.marginTop='10px';
    btn.onclick=function(){
      alert('אפשרות התשלום בכרטיס שמור תופעל לאחר השלמת החיבור המאובטח שמזהה אוטומטית את המכירה ששולמה. בינתיים יש לבצע את התשלום בכרטיס במסך זה.');
    };
    charge.insertAdjacentElement('afterend',btn);
  }
  window.ensureSavedCardPaymentButton=addButton;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addButton);else addButton();
  const oldStart=window.startPayment;
  if(oldStart)window.startPayment=async function(){const r=await oldStart.apply(this,arguments);addButton();return r};
})();

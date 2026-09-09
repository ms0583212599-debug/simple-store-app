// ZCS90/HID card-reader payment helper.
// Card data stays inside Nedarim Plus' PCI iframe; parent page never reads magnetic-track data.
(function(){
  let mode='manual';
  function el(id){return document.getElementById(id)}
  function style(){if(el('cardReaderPaymentStyle'))return;const s=document.createElement('style');s.id='cardReaderPaymentStyle';s.textContent=`
    .card-pay-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
    .card-pay-modes button{padding:14px 10px;border-radius:12px;border:2px solid #d7dde3;background:#fff;font-weight:700;font-size:16px}
    .card-pay-modes button.active{border-color:#2b778b;background:#edf8fa}
    .reader-note{padding:12px 14px;border-radius:12px;background:#eef7f9;text-align:center;margin:8px 0;font-weight:700}
    #NedarimFrame.reader-frame{display:block!important;width:100%!important;height:340px!important;opacity:1!important;pointer-events:auto!important;position:static!important}
  `;document.head.appendChild(s)}
  function setMode(m){
    mode=m;
    document.querySelectorAll('[data-card-pay-mode]').forEach(b=>b.classList.toggle('active',b.dataset.cardPayMode===m));
    const note=el('readerPaymentBox'),frame=el('NedarimFrame'),charge=el('chargeBtn'),st=el('paymentStatus');
    if(note){note.style.display=m==='reader'?'block':'none';note.innerHTML=m==='reader'?'<b>1. לחץ פעם אחת בתוך שדה מספר הכרטיס של נדרים</b><br>2. העבר את הכרטיס בקורא':'';}
    if(frame){frame.classList.toggle('reader-frame',m==='reader');frame.style.display='block';}
    if(charge)charge.style.display='block';
    if(st)st.textContent=m==='reader'?'מוכן לקריאת כרטיס — לחץ בשדה מספר הכרטיס ואז העבר':'הזן פרטי אשראי';
  }
  function install(){
    const frame=el('NedarimFrame');if(!frame||el('cardPayModes'))return;style();
    const wrap=document.createElement('div');wrap.id='cardPayModes';wrap.className='card-pay-modes';
    wrap.innerHTML='<button type="button" data-card-pay-mode="reader">העברת כרטיס</button><button type="button" data-card-pay-mode="manual">הקלדת פרטי כרטיס</button>';
    frame.parentNode.insertBefore(wrap,frame);
    const note=document.createElement('div');note.id='readerPaymentBox';note.className='reader-note';frame.parentNode.insertBefore(note,frame);
    wrap.querySelectorAll('button').forEach(b=>b.onclick=()=>setMode(b.dataset.cardPayMode));
    setMode('manual');
  }
  const mo=new MutationObserver(()=>install());mo.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

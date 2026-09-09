// ZCS90/HID card-reader payment helper.
// Reader mode keeps card data inside Nedarim's PCI iframe; this page does not read/store magnetic-track data.
(function(){
  let mode='manual';
  function el(id){return document.getElementById(id)}
  function style(){if(el('cardReaderPaymentStyle'))return;const s=document.createElement('style');s.id='cardReaderPaymentStyle';s.textContent=`
    .card-pay-modes{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
    .card-pay-modes button{padding:14px 10px;border-radius:12px;border:2px solid #d7dde3;background:#fff;font-weight:700;font-size:16px}
    .card-pay-modes button.active{border-color:#2b778b;background:#edf8fa}
    .reader-box{padding:22px 14px;border-radius:12px;background:#f5f7f9;text-align:center;margin:8px 0 12px}
    .reader-box b{display:block;font-size:20px;margin-bottom:7px}.reader-box small{color:#64727d}
    #NedarimFrame.reader-secure-hidden{position:fixed!important;left:-10000px!important;top:0!important;width:2px!important;height:2px!important;opacity:.01!important;pointer-events:none!important;display:block!important}
  `;document.head.appendChild(s)}
  function focusSecureFrame(){const f=el('NedarimFrame');if(!f)return;try{f.contentWindow.focus()}catch(e){} }
  function setMode(m){
    mode=m;
    document.querySelectorAll('[data-card-pay-mode]').forEach(b=>b.classList.toggle('active',b.dataset.cardPayMode===m));
    const r=el('readerPaymentBox'),f=el('NedarimFrame'),c=el('chargeBtn'),st=el('paymentStatus');
    if(r){r.style.display=m==='reader'?'block':'none';r.innerHTML='<b>העבר את הכרטיס בקורא</b><small>הקריאה נכנסת ישירות למסך המאובטח של נדרים פלוס.</small>'}
    if(f){f.classList.toggle('reader-secure-hidden',m==='reader');if(m==='manual'){f.style.display='block'}}
    if(c)c.style.display=m==='reader'?'none':'block';
    if(st)st.textContent=m==='reader'?'ממתין להעברת כרטיס':'הזן פרטי אשראי';
    if(m==='reader'){setTimeout(focusSecureFrame,100);setTimeout(focusSecureFrame,500)}
  }
  function install(){
    const frame=el('NedarimFrame');if(!frame||el('cardPayModes'))return;style();
    const wrap=document.createElement('div');wrap.id='cardPayModes';wrap.className='card-pay-modes';
    wrap.innerHTML='<button type="button" data-card-pay-mode="reader">העברת כרטיס</button><button type="button" data-card-pay-mode="manual">הקלדת פרטי כרטיס</button>';
    frame.parentNode.insertBefore(wrap,frame);
    const box=document.createElement('div');box.id='readerPaymentBox';box.className='reader-box';frame.parentNode.insertBefore(box,frame);
    wrap.querySelectorAll('button').forEach(b=>b.onclick=()=>setMode(b.dataset.cardPayMode));
    frame.addEventListener('load',()=>{if(mode==='reader')setTimeout(focusSecureFrame,200)});
    setMode('manual');
  }
  // If Nedarim reports a successful transaction, the existing app listener handles confirmation/polling.
  // No card number, expiry, CVV or raw track is captured by the parent page.
  const mo=new MutationObserver(()=>install());mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

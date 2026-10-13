(function(nonce){
  'use strict';
  if(window.__storeKeyboardNonce===nonce)return;
  window.__storeKeyboardNonce=nonce;
  let target=null;
  function editable(e){return e instanceof HTMLInputElement && !e.disabled && !e.readOnly &&
    ['text','tel','email','password','number','search','url'].includes(e.type) || e instanceof HTMLTextAreaElement && !e.disabled && !e.readOnly;}
  // Apply before the first focus, including provider fields inserted asynchronously.
  function suppressIme(){for(const e of document.querySelectorAll('input,textarea'))if(editable(e)&&e.getAttribute('inputmode')!=='none')e.setAttribute('inputmode','none');}
  suppressIme();
  new MutationObserver(suppressIme).observe(document.documentElement,{subtree:true,childList:true});
  function open(e){
    if(!editable(e))return;
    target=e;e.setAttribute('inputmode','none');
    const mode=['tel','number'].includes(e.type)?'NUM':e.type==='email'||e.type==='url'?'EN':'HE';
    StorePaymentKeyboard.open(nonce,mode);
  }
  document.addEventListener('focusin',e=>open(e.target),true);
  document.addEventListener('click',e=>open(e.target),true);
  // Values stay in the provider's DOM; only keyboard mode crosses the bridge.
  window.__storePaymentKey=function(proof,kind,key){
    if(proof!==window.__storeKeyboardNonce||!target||!target.isConnected||!editable(target))return;
    const e=target;
    if(kind==='done'){e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();target=null;return;}
    if(document.activeElement!==e)return;
    let value=e.value,a=e.selectionStart,z=e.selectionEnd;
    if(a===null||z===null){a=z=value.length;}
    if(kind==='delete'&&a===z&&a>0){a-=Array.from(value.slice(0,a)).pop().length;}
    const insert=kind==='delete'?'':key;
    if(e.maxLength>=0&&value.length-(z-a)+insert.length>e.maxLength)return;
    const inputType=kind==='delete'?'deleteContentBackward':'insertText';
    if(!e.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:true,inputType:inputType,data:insert})))return;
    const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;
    setter.call(e,value.slice(0,a)+insert+value.slice(z));
    try{e.setSelectionRange(a+insert.length,a+insert.length);}catch(ignore){}
    e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:inputType,data:insert}));
    // Nedarim also formats card/expiry fields from its existing keyup handlers.
    e.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:kind==='delete'?'Backspace':key}));
  };
  open(document.activeElement);
})(__NONCE__);

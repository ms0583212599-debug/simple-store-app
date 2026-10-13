(function(){
  'use strict';
  if(document.getElementById('store-tablet-fit'))return;
  const meta=document.querySelector('meta[name=viewport]')||document.head.appendChild(document.createElement('meta'));
  meta.name='viewport';meta.content='width=device-width,initial-scale=1';
  const css=document.createElement('style');css.id='store-tablet-fit';
  css.textContent=`
    #PayModeGpayBt,#PayModeCardBt{display:none!important;visibility:hidden!important;pointer-events:none!important}
    html{margin:0!important;min-height:0!important;overflow-y:auto!important}body{margin:0!important;min-height:0!important;zoom:1!important}
    #MainDiv{width:98%!important;max-width:1000px!important;margin:2px auto!important;padding:4px 0!important;box-sizing:border-box}
    #PaymentDiv>div:first-child{z-index:2}
    #WelcomLogo{max-height:48px!important}#MosadName{margin-top:2px!important}
    #PaymentDiv hr{margin:4px auto!important}
    #FormDiv .SpanDiv{margin-top:2px!important;margin-bottom:2px!important;vertical-align:top}
    #FormDiv .TextBox{margin-top:2px!important;margin-bottom:2px!important;padding-top:3px!important;padding-bottom:3px!important}
    #PaiementType{margin:4px 0!important}#PaiementData{margin-top:4px!important}
    #ClientGroupeSpan{margin-bottom:4px!important}
    .payment-card{height:70px!important;max-height:70px!important;padding:3px!important}.payment-card img{max-height:24px!important}
    @media(min-width:650px){#FormDiv .SpanDiv{width:29%!important}}
  `;
  document.head.appendChild(css);
  const logo=document.getElementById('WelcomLogo');
  if(logo&&logo.parentElement)logo.parentElement.style.minHeight='0';
  // Preserve readable text and natural document height. Extra card fields scroll
  // instead of shrinking the entire form or resetting the user's scroll position.
  document.body.style.zoom='1';
})();

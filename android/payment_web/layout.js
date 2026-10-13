(function(){
  'use strict';
  if(window.__storeFitPayment){window.__storeFitPayment();return;}
  const meta=document.querySelector('meta[name=viewport]')||document.head.appendChild(document.createElement('meta'));
  meta.name='viewport';meta.content='width=device-width,initial-scale=1';
  const css=document.createElement('style');css.id='store-tablet-fit';
  css.textContent=`
    #PayModeGpayBt{display:none!important;visibility:hidden!important;pointer-events:none!important}
    html{margin:0!important;min-height:0!important}body{margin:0!important;min-height:0!important}
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
  let scheduled=false;
  function fit(){
    scheduled=false;
    const body=document.body;
    if(!body)return;
    body.style.zoom='1';
    // Measure visible content without the viewport's artificial minimum height.
    let bottom=0,right=0;
    for(const child of body.children){
      const style=getComputedStyle(child);
      if(style.display==='none'||style.position==='fixed'||style.position==='absolute')continue;
      const r=child.getBoundingClientRect();bottom=Math.max(bottom,r.bottom+window.scrollY);right=Math.max(right,r.right);
    }
    const scale=Math.min(1,(innerWidth-4)/Math.max(right,1),(innerHeight-4)/Math.max(bottom,1));
    body.style.zoom=String(Math.max(.25,scale));
    window.scrollTo(0,0);
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(fit);}}
  window.__storeFitPayment=schedule;
  // Provider loading, validation messages and orientation can change the height.
  new MutationObserver(records=>{if(records.some(r=>r.target!==document.body))schedule();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden']});
  document.addEventListener('load',schedule,true);window.addEventListener('resize',schedule);
  schedule();setTimeout(schedule,400);setTimeout(schedule,1200);
})();

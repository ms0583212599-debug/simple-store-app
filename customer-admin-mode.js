(function(){
  let enabled=false;
  function installStyle(){if(document.getElementById('customerAdminModeStyle'))return;let s=document.createElement('style');s.id='customerAdminModeStyle';s.textContent='.customer-admin-mode #products .product,.customer-admin-mode #categories.search-results .product{position:relative;cursor:pointer;outline:2px dashed #2563eb;outline-offset:-3px}.customer-admin-badge{display:none;position:absolute;top:10px;left:10px;z-index:5;background:#2563eb;color:#fff;border-radius:10px;padding:7px 10px;font-weight:900;box-shadow:0 5px 16px #0003}.customer-admin-mode .customer-admin-badge{display:block}.customer-admin-mode .inline-cart,.customer-admin-mode .buybtn{pointer-events:none;opacity:.55}.customer-admin-mode:before{content:"מצב ניהול לקוחות פעיל";position:fixed;top:72px;left:50%;transform:translateX(-50%);z-index:90;background:#172554;color:#fff;padding:9px 18px;border-radius:999px;font-weight:900;box-shadow:0 8px 24px #0003}';document.head.appendChild(s)}
  function markCards(){
    if(!enabled)return;
    document.querySelectorAll('#products .product,#categories.search-results .product').forEach(card=>{
      if(card.dataset.adminBound==='1')return;
      let id=card.dataset.productId||card.querySelector('.inline-cart')?.dataset.product||'';
      if(!id){let name=card.querySelector('h3')?.textContent?.trim();id=(prods||[]).find(p=>p.name===name)?.id||''}
      if(!id)return;
      card.dataset.productId=id;card.dataset.adminBound='1';card.classList.add('customer-admin-product');
      let badge=document.createElement('div');badge.className='customer-admin-badge';badge.textContent='✎ עריכה';card.appendChild(badge);
      card.addEventListener('click',e=>{if(!enabled)return;e.preventDefault();e.stopPropagation();openEdit(id)},true);
    });
  }
  function apply(){installStyle();document.body.classList.toggle('customer-admin-mode',enabled);let b=document.getElementById('customerAdminModeBtn');if(b)b.textContent=enabled?'יציאה ממצב ניהול':'מצב ניהול במסך לקוחות';setTimeout(markCards,0)}
  window.toggleCustomerAdminMode=function(){if(!admin)return alert('יש להיכנס לניהול תחילה');enabled=!enabled;apply();show('home');if(enabled)setTimeout(()=>alert('מצב ניהול פעיל: לחיצה על מוצר תפתח עריכה'),50)};
  function addButton(){let adminScreen=document.getElementById('admin');if(!adminScreen||document.getElementById('customerAdminModeBtn'))return;let actions=adminScreen.querySelector('.bar .actions');if(!actions)return;let b=document.createElement('button');b.id='customerAdminModeBtn';b.className='blue';b.type='button';b.textContent='מצב ניהול במסך לקוחות';b.onclick=toggleCustomerAdminMode;actions.prepend(b)}
  function wrap(name){let old=window[name];if(typeof old!=='function'||old.__customerAdminWrapped)return;let f=function(){let r=old.apply(this,arguments);Promise.resolve(r).finally(()=>setTimeout(markCards,0));return r};f.__customerAdminWrapped=true;window[name]=f}
  function init(){installStyle();addButton();wrap('openCat');wrap('renderStoreSearch');wrap('renderCats')}
  window.addEventListener('load',()=>setTimeout(init,0));setTimeout(init,700);
})();
(function(){
  let enabled=false;
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
  function apply(){document.body.classList.toggle('customer-admin-mode',enabled);let b=document.getElementById('customerAdminModeBtn');if(b)b.textContent=enabled?'יציאה ממצב ניהול':'מצב ניהול במסך לקוחות';setTimeout(markCards,0)}
  window.toggleCustomerAdminMode=function(){if(!admin)return alert('יש להיכנס לניהול תחילה');enabled=!enabled;apply();show('home');if(enabled)setTimeout(()=>alert('מצב ניהול פעיל: לחיצה על מוצר תפתח עריכה'),50)};
  function addButton(){let adminScreen=document.getElementById('admin');if(!adminScreen||document.getElementById('customerAdminModeBtn'))return;let actions=adminScreen.querySelector('.bar .actions');if(!actions)return;let b=document.createElement('button');b.id='customerAdminModeBtn';b.className='blue';b.type='button';b.textContent='מצב ניהול במסך לקוחות';b.onclick=toggleCustomerAdminMode;actions.prepend(b)}
  function wrap(name){let old=window[name];if(typeof old!=='function'||old.__customerAdminWrapped)return;let f=function(){let r=old.apply(this,arguments);Promise.resolve(r).finally(()=>setTimeout(markCards,0));return r};f.__customerAdminWrapped=true;window[name]=f}
  function init(){addButton();wrap('openCat');wrap('renderStoreSearch');wrap('renderCats')}
  window.addEventListener('load',()=>setTimeout(init,0));setTimeout(init,700);
})();
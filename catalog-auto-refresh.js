// Keep website product prices and stock synchronized with Supabase when the page becomes active again.
(function(){
  let busy=false,last=0;
  async function refreshCatalog(force){
    if(busy||typeof load!=='function')return;
    if(!force&&Date.now()-last<3000)return;
    busy=true;
    try{
      await load();
      last=Date.now();
      const active=document.querySelector('.screen.active');
      if(active&&active.id==='category'&&typeof openCat==='function'){
        const title=document.getElementById('catTitle')?.textContent||'';
        const cat=(window.cats||cats||[]).find(x=>x.name===title);
        if(cat)openCat(cat.id);
      }
      if(active&&active.id==='cart'&&typeof renderCart==='function')renderCart();
    }catch(e){console.warn('catalog refresh failed',e)}finally{busy=false}
  }
  window.addEventListener('focus',()=>refreshCatalog(false));
  window.addEventListener('pageshow',()=>refreshCatalog(false));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCatalog(false)});
  window.refreshCatalogFromCloud=()=>refreshCatalog(true);
})();

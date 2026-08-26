(function(){
  const originalReq=window.req;
  const cache=new Map();
  const cacheable=p=>/\/rest\/v1\/(categories|products|store_announcements|storefront_design_settings)/.test(p);
  window.req=async function(path,opt={}){
    const method=(opt.method||'GET').toUpperCase();
    if(method==='GET'&&cacheable(path)){
      const hit=cache.get(path),now=Date.now();
      if(hit&&now-hit.time<30000)return hit.data;
      const data=await originalReq(path,opt);cache.set(path,{time:now,data});return data;
    }
    if(method!=='GET')cache.clear();
    return originalReq(path,opt);
  };
  window.load=async function(){
    const [c,p]=await Promise.all([
      req('/rest/v1/categories?select=*&order=sort_order.asc'),
      req('/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc')
    ]);
    cats=c;prods=p;renderCats();renderSelects();renderAdmin();renderCategoryManager();fillStockCategories();
  };
  window.loadPurchaseHistory=async function(){
    if(!admin)return;
    const [ps,items]=await Promise.all([
      req('/rest/v1/purchases?select=*&order=purchase_date.desc,created_at.desc'),
      req('/rest/v1/purchase_items?select=*&order=created_at.asc')
    ]);
    purchases=ps;purchaseItems=items;renderPurchaseHistory();
  };
  window.loadAdminData=async function(){
    if(!admin)return;
    const [ss,ps,items]=await Promise.all([
      req('/rest/v1/suppliers?select=*&order=name.asc'),
      req('/rest/v1/purchases?select=*&order=purchase_date.desc,created_at.desc'),
      req('/rest/v1/purchase_items?select=*&order=created_at.asc')
    ]);
    suppliers=ss;purchases=ps;purchaseItems=items;renderPurchaseHistory();renderSelects();renderSupplierManager();
  };
  const tuneImg=img=>{if(!img.dataset.perf){img.loading='lazy';img.decoding='async';img.dataset.perf='1'}};
  document.querySelectorAll('img').forEach(tuneImg);
  new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType!==1)return;if(n.tagName==='IMG')tuneImg(n);n.querySelectorAll?.('img').forEach(tuneImg)}))).observe(document.documentElement,{childList:true,subtree:true});
  let l=document.createElement('link');l.rel='preconnect';l.href=BASE;document.head.appendChild(l);
})();
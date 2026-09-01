// Customer visibility choice for products from new/edit purchase screens.
(function(){
  function visibilitySelect(cls,active=true){
    return '<label style="display:flex;gap:6px;align-items:center;white-space:nowrap">מפורסם ללקוחות <select class="'+cls+'"><option value="yes" '+(active?'selected':'')+'>כן</option><option value="no" '+(!active?'selected':'')+'>לא</option></select></label>';
  }
  function productActive(id){let p=(window.prods||[]).find(x=>x.id===id);return p?.is_active!==false}
  async function applyVisibility(id,active){if(!id)return;let p=(window.prods||[]).find(x=>x.id===id);if(!p||p.is_active!==active){await req('/rest/v1/products?id=eq.'+id,{method:'PATCH',body:JSON.stringify({is_active:active})});if(p)p.is_active=active}}

  const oldAddPurchaseRow=window.addPurchaseRow;
  if(oldAddPurchaseRow)window.addPurchaseRow=function(){
    oldAddPurchaseRow.apply(this,arguments);
    let rows=document.querySelectorAll('#purchaseRows tr'),tr=rows[rows.length-1];if(!tr||tr.querySelector('.pr-visible'))return;
    let td=document.createElement('td');td.innerHTML=visibilitySelect('pr-visible',true);let remove=tr.lastElementChild;tr.insertBefore(td,remove);
    tr.addEventListener('mousedown',()=>setTimeout(()=>{let id=tr.dataset.productId;if(id)tr.querySelector('.pr-visible').value=productActive(id)?'yes':'no'},0));
  };
  const oldEnsureProduct=window.ensureProduct;
  if(oldEnsureProduct)window.ensureProduct=async function(tr){let id=await oldEnsureProduct.apply(this,arguments),sel=tr.querySelector('.pr-visible');if(sel)await applyVisibility(id,sel.value==='yes');return id};

  const oldAddPurchaseEditRow=window.addPurchaseEditRow;
  if(oldAddPurchaseEditRow)window.addPurchaseEditRow=function(productId='',values={}){
    oldAddPurchaseEditRow.apply(this,arguments);let rows=document.querySelectorAll('#peRows tr'),tr=rows[rows.length-1];if(!tr||tr.querySelector('.pe-visible'))return;
    let td=document.createElement('td');td.innerHTML=visibilitySelect('pe-visible',productId?productActive(productId):true);let remove=tr.lastElementChild;tr.insertBefore(td,remove);
    let prod=tr.querySelector('.pe-product');if(prod)prod.addEventListener('change',()=>{let id=prod.value;if(id)tr.querySelector('.pe-visible').value=productActive(id)?'yes':'no'});
  };
  const oldResolve=window.resolvePurchaseEditProduct;
  if(oldResolve)window.resolvePurchaseEditProduct=async function(tr){let id=await oldResolve.apply(this,arguments),sel=tr.querySelector('.pe-visible');if(sel)await applyVisibility(id,sel.value==='yes');return id};

  function addHeaders(){let h=document.querySelector('#peRows')?.closest('table')?.querySelector('thead tr');if(h&&!h.querySelector('.visibility-head')){let th=document.createElement('th');th.className='visibility-head';th.textContent='מפורסם ללקוחות';h.insertBefore(th,h.lastElementChild)}let h2=document.querySelector('#purchaseRows')?.closest('table')?.querySelector('thead tr');if(h2&&!h2.querySelector('.visibility-head')){let th=document.createElement('th');th.className='visibility-head';th.textContent='מפורסם ללקוחות';h2.insertBefore(th,h2.lastElementChild)}}
  addHeaders();
  const oldEnhance=window.enhancePurchaseEditModal;if(oldEnhance)window.enhancePurchaseEditModal=function(){let r=oldEnhance.apply(this,arguments);addHeaders();return r};
})();

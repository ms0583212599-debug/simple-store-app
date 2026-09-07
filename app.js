// Fast application loader: core first, customer UI immediately, admin tools on demand.
(function(){
  const V='20260907-category-image-fit-v1';
  const loaded=new Set();
  function installCategoryImageFix(){
    if(document.getElementById('categoryImageFitFix'))return;
    const style=document.createElement('style');
    style.id='categoryImageFitFix';
    style.textContent=`
      .category-card{overflow:hidden!important}
      .category-visual{
        overflow:hidden!important;
        align-items:stretch!important;
        justify-items:stretch!important;
      }
      .category-visual>img{
        display:block!important;
        width:100%!important;
        height:100%!important;
        min-width:0!important;
        min-height:0!important;
        max-width:100%!important;
        max-height:100%!important;
        object-fit:contain!important;
        object-position:center!important;
        overflow:hidden!important;
        padding:2px!important;
      }
      .category-custom{
        display:block!important;
        width:100%!important;
        max-width:100%!important;
        object-fit:contain!important;
        object-position:center!important;
        overflow:hidden!important;
      }
    `;
    document.head.appendChild(style);
  }
  function script(file){if(loaded.has(file))return Promise.resolve();loaded.add(file);return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=file+'?v='+V;s.onload=resolve;s.onerror=()=>reject(new Error('Failed loading '+file));document.head.appendChild(s)})}
  async function boot(){installCategoryImageFix();await script('app-part1.js');await script('app-part2.js');await script('app-part3.js');await script('nedarim-settings.js');await script('saved-card-payment.js');await script('offline.js');await script('inventory-count.js');await script('performance.js');if(document.readyState==='complete'){try{await authState();await load();totals()}catch(e){console.error('core init failed',e)}}await Promise.all([script('announcements.js'),script('storefront-modern.js'),script('customer-feedback.js')]);if(document.readyState==='complete'){try{ensureAnnouncementAdmin?.();loadAnnouncements?.()}catch(e){}try{ensureStorefrontModernUI?.()}catch(e){}try{ensureCustomerFeedback?.()}catch(e){}}}
  let adminExtrasPromise=null;
  window.loadAdminExtras=function(){if(adminExtrasPromise)return adminExtrasPromise;adminExtrasPromise=Promise.all([script('sales-report.js'),script('purchase-import.js'),script('purchase-edit-enhancements.js'),script('contextual-excel.js'),script('finance-management.js'),script('admin-password.js'),script('inventory-edit.js'),script('product-full-edit.js'),script('task-management.js'),script('home-withdrawals.js'),script('special-sales.js'),script('store-gpt.js')]).then(async()=>{await script('home-withdrawal-save-mode.js');await script('customer-admin-mode.js');await script('purchase-visibility.js');if(document.readyState==='complete'){try{ensurePurchaseImportUI?.()}catch(e){}try{enhancePurchaseEditModal?.()}catch(e){}try{ensureContextualExcel?.()}catch(e){}try{ensureFinanceUI?.()}catch(e){}try{ensureTaskUI?.()}catch(e){}try{ensureNedarimSettings?.()}catch(e){}try{ensureHomeWithdrawals?.()}catch(e){}try{ensureSpecialSales?.()}catch(e){}try{ensureStoreGpt?.()}catch(e){}}});return adminExtrasPromise};
  boot().then(()=>{const oldOpen=window.openAdmin;if(oldOpen)window.openAdmin=async function(){await loadAdminExtras();return oldOpen.apply(this,arguments)}}).catch(console.error);
})();
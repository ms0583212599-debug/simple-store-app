// Fast application loader: core first, customer UI immediately, admin tools on demand.
(function(){
  const V='20260826-fast1';
  const loaded=new Set();
  function script(file){
    if(loaded.has(file))return Promise.resolve();
    loaded.add(file);
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=file+'?v='+V;
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Failed loading '+file));
      document.head.appendChild(s);
    });
  }
  async function boot(){
    // Core files have dependencies, so keep only these sequential.
    await script('app-part1.js');
    await script('app-part2.js');
    await script('app-part3.js');
    await script('performance.js');
    // Customer-facing extras are independent and load together.
    await Promise.all([script('announcements.js'),script('storefront-modern.js')]);
    // If load already fired while dynamic scripts were arriving, initialize explicitly.
    if(document.readyState==='complete'){
      try{ensureAnnouncementAdmin?.();loadAnnouncements?.()}catch(e){}
      try{ensureStorefrontModernUI?.()}catch(e){}
    }
  }
  let adminExtrasPromise=null;
  window.loadAdminExtras=function(){
    if(adminExtrasPromise)return adminExtrasPromise;
    adminExtrasPromise=Promise.all([
      script('sales-report.js'),
      script('purchase-import.js'),
      script('purchase-edit-enhancements.js')
    ]).then(()=>{
      if(document.readyState==='complete'){
        try{ensurePurchaseImportUI?.()}catch(e){}
        try{enhancePurchaseEditModal?.()}catch(e){}
      }
    });
    return adminExtrasPromise;
  };
  boot().then(()=>{
    const oldOpen=window.openAdmin;
    if(oldOpen)window.openAdmin=async function(){await loadAdminExtras();return oldOpen.apply(this,arguments)};
  }).catch(console.error);
})();
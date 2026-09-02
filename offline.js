// Offline-first data cache and durable sync queue for store management.
(function(){
  'use strict';
  const DB_NAME='simple-store-offline';
  const DB_VERSION=1;
  const CACHE_PRODUCTS='/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc';
  const CACHE_CATEGORIES='/rest/v1/categories?select=*&order=sort_order.asc';
  let dbPromise=null;
  let syncing=false;

  function db(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onupgradeneeded=()=>{
        const value=request.result;
        if(!value.objectStoreNames.contains('responses'))value.createObjectStore('responses');
        if(!value.objectStoreNames.contains('operations'))value.createObjectStore('operations',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
    return dbPromise;
  }
  async function get(store,key){
    const value=await db();
    return new Promise((resolve,reject)=>{
      const request=value.transaction(store).objectStore(store).get(key);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    });
  }
  async function put(store,value,key){
    const database=await db();
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction(store,'readwrite');
      const target=transaction.objectStore(store);
      key===undefined?target.put(value):target.put(value,key);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
    });
  }
  async function remove(store,key){
    const database=await db();
    return new Promise((resolve,reject)=>{
      const transaction=database.transaction(store,'readwrite');
      transaction.objectStore(store).delete(key);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error);
    });
  }
  async function all(store){
    const database=await db();
    return new Promise((resolve,reject)=>{
      const request=database.transaction(store).objectStore(store).getAll();
      request.onsuccess=()=>resolve(request.result||[]);
      request.onerror=()=>reject(request.error);
    });
  }

  const method=options=>String(options&&options.method||'GET').toUpperCase();
  function body(options){
    try{return typeof options.body==='string'?JSON.parse(options.body):options.body||null}
    catch(_error){return null}
  }
  function safeOptions(options){
    const copy={method:method(options),headers:Object.assign({},options&&options.headers||{})};
    if(options&&options.body!==undefined)copy.body=options.body;
    delete copy.headers.Authorization;
    delete copy.headers.apikey;
    return copy;
  }
  function filteredId(path){
    const match=path.match(/[?&]id=eq\.([^&]+)/);
    return match?decodeURIComponent(match[1]):null;
  }
  async function cacheResponse(path,data){await put('responses',{data:data,savedAt:Date.now()},path)}
  async function cachedResponse(path){const item=await get('responses',path);return item&&item.data}
  async function operations(){return (await all('operations')).sort((a,b)=>a.createdAt-b.createdAt)}

  function ensureStatus(){
    let bar=document.getElementById('offlineStatus');
    if(bar)return bar;
    const style=document.createElement('style');
    style.textContent='#offlineStatus{position:sticky;top:0;z-index:200;padding:8px 12px;text-align:center;font-weight:800;background:#dcfce7;color:#166534}#offlineStatus.offline{background:#fef3c7;color:#92400e}#offlineStatus.pending{background:#dbeafe;color:#1e40af}#offlineStatus button{margin-inline-start:9px;min-height:34px!important;padding:5px 10px!important}';
    document.head.appendChild(style);
    bar=document.createElement('div');
    bar.id='offlineStatus';
    document.body.prepend(bar);
    return bar;
  }
  async function renderStatus(){
    const count=(await operations()).length;
    const bar=ensureStatus();
    bar.className=!navigator.onLine?'offline':count?'pending':'';
    bar.innerHTML=!navigator.onLine
      ?'אין אינטרנט · '+count+' שינויים שמורים במכשיר'
      :count
        ?count+' שינויים ממתינים לסנכרון <button type="button" onclick="syncOfflineChanges(true)">סנכרן עכשיו</button>'
        :'מחובר · כל הנתונים מסונכרנים';
  }

  async function queue(path,options){
    const operation={id:crypto.randomUUID(),path:path,options:safeOptions(options),createdAt:Date.now()};
    await put('operations',operation);
    return operation;
  }
  async function optimistic(operation){
    const requestBody=body(operation.options)||{};
    const requestMethod=method(operation.options);
    let response=null;

    if(operation.path.startsWith('/rest/v1/products')){
      if(requestMethod==='POST'){
        const row=Object.assign({id:requestBody.id||crypto.randomUUID(),created_at:new Date().toISOString()},requestBody);
        requestBody.id=row.id;
        operation.options.body=JSON.stringify(requestBody);
        await put('operations',operation);
        prods.push(row);
        response=[row];
      }else if(requestMethod==='PATCH'){
        const id=filteredId(operation.path);
        prods=prods.map(item=>item.id===id?Object.assign({},item,requestBody):item);
      }
      await cacheResponse(CACHE_PRODUCTS,prods);
    }

    if(operation.path.startsWith('/rest/v1/categories')){
      if(requestMethod==='POST'){
        const row=Object.assign({id:requestBody.id||crypto.randomUUID()},requestBody);
        requestBody.id=row.id;
        operation.options.body=JSON.stringify(requestBody);
        await put('operations',operation);
        cats.push(row);
        response=[row];
      }else if(requestMethod==='PATCH'){
        const id=filteredId(operation.path);
        cats=cats.map(item=>item.id===id?Object.assign({},item,requestBody):item);
      }
      await cacheResponse(CACHE_CATEGORIES,cats);
    }

    if(operation.path==='/rest/v1/rpc/adjust_stock'){
      prods=prods.map(item=>item.id===requestBody.p_product_id
        ?Object.assign({},item,{stock_quantity:Number(item.stock_quantity||0)+Number(requestBody.p_change_qty||0)})
        :item);
      await cacheResponse(CACHE_PRODUCTS,prods);
    }

    if(operation.path==='/rest/v1/rpc/create_purchase'){
      for(const line of requestBody.p_items||[]){
        prods=prods.map(item=>item.id===line.product_id
          ?Object.assign({},item,{stock_quantity:Number(item.stock_quantity||0)+Number(line.quantity||0),price:Number(line.sale_price==null?item.price:line.sale_price)})
          :item);
      }
      await cacheResponse(CACHE_PRODUCTS,prods);
    }

    try{renderCats();renderSelects();renderAdmin();renderCategoryManager();fillStockCategories()}catch(_error){}
    return response;
  }

  const networkRequest=window.req;
  window.req=async function(path,options={}){
    if(method(options)==='GET'){
      try{
        const data=await networkRequest(path,options);
        await cacheResponse(path,data);
        return data;
      }catch(error){
        const cached=await cachedResponse(path);
        if(cached!==undefined)return cached;
        throw error;
      }
    }
    if(!navigator.onLine){
      const operation=await queue(path,options);
      const result=await optimistic(operation);
      await renderStatus();
      return result;
    }
    return networkRequest(path,options);
  };

  const networkUpload=window.uploadImage;
  if(networkUpload)window.uploadImage=async function(file,prefix){
    if(file&&!navigator.onLine)throw new Error('העלאת תמונה דורשת אינטרנט. שאר הפרטים נשארו בטופס.');
    return networkUpload(file,prefix);
  };

  async function syncChanges(force){
    if(syncing||!navigator.onLine)return;
    const pending=await operations();
    if(!pending.length)return renderStatus();
    if(!force&&!confirm('נמצאו '+pending.length+' שינויים שנשמרו ללא אינטרנט. להעלות אותם לענן עכשיו?'))return;
    syncing=true;
    try{
      for(const operation of pending){
        await networkRequest(operation.path,operation.options);
        await remove('operations',operation.id);
      }
      await load();
      if(typeof admin!=='undefined'&&admin)await loadAdminData();
      alert('כל העדכונים הועלו לענן בהצלחה');
    }catch(error){
      alert('הסנכרון נעצר. העדכונים שלא הועלו נשמרו במכשיר.\n'+(error.message||error));
    }finally{
      syncing=false;
      await renderStatus();
    }
  }

  window.syncOfflineChanges=syncChanges;
  window.addEventListener('offline',renderStatus);
  window.addEventListener('online',()=>syncChanges(false));
  renderStatus().catch(console.error);
})();
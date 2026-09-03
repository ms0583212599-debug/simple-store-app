// Fast physical inventory count shared by the website and the native app.
let inventoryCountDraft=JSON.parse(localStorage.getItem('inventory_count_draft')||'{}');
let editingInventoryCountId=sessionStorage.getItem('inventory_count_editing_id')||'';
let inventoryCountCloudHistory=[];
let inventoryCountHistoryLoading=false;

function inventoryCountDate(ts){try{return new Date(ts).toLocaleString('he-IL')}catch(e){return ''}}
async function loadInventoryCountHistory(){
  if(inventoryCountHistoryLoading)return;
  inventoryCountHistoryLoading=true;
  try{
    const counts=await req('/rest/v1/inventory_counts?select=id,counted_at,updated_at,zero_missing,source,note&order=counted_at.desc');
    const items=await req('/rest/v1/inventory_count_items?select=count_id,product_id,product_name,counted_quantity');
    inventoryCountCloudHistory=(counts||[]).map(c=>({
      id:c.id,saved_at:c.counted_at,updated_at:c.updated_at,zero_missing:!!c.zero_missing,source:c.source||'',note:c.note||'',
      items:Object.fromEntries((items||[]).filter(i=>i.count_id===c.id&&i.product_id).map(i=>[i.product_id,Number(i.counted_quantity)||0]))
    }));
    renderInventoryCountHistory();
  }catch(e){console.warn('Inventory history cloud load failed',e);}
  finally{inventoryCountHistoryLoading=false;}
}
async function saveInventoryCountSnapshot(zeroMissing){
  const counted=Object.keys(inventoryCountDraft).filter(id=>inventoryCountDraft[id]!==''&&Number.isFinite(Number(inventoryCountDraft[id])));
  const countable=prods.filter(p=>p.is_active!==false||counted.includes(p.id));
  const itemRows=[];
  countable.forEach(p=>{
    if(counted.includes(p.id))itemRows.push({product_id:p.id,product_name:p.name,counted_quantity:Math.max(0,Math.floor(Number(inventoryCountDraft[p.id])||0))});
    else if(zeroMissing)itemRows.push({product_id:p.id,product_name:p.name,counted_quantity:0});
  });
  let countId=editingInventoryCountId;
  if(countId){
    await req('/rest/v1/inventory_counts?id=eq.'+encodeURIComponent(countId),{method:'PATCH',body:JSON.stringify({updated_at:new Date().toISOString(),zero_missing:!!zeroMissing,source:'website'})});
    await req('/rest/v1/inventory_count_items?count_id=eq.'+encodeURIComponent(countId),{method:'DELETE'});
  }else{
    const created=await req('/rest/v1/inventory_counts',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({zero_missing:!!zeroMissing,source:'website'})});
    const row=Array.isArray(created)?created[0]:created;countId=row&&row.id;
  }
  if(!countId)throw new Error('לא התקבל מזהה לספירה');
  if(itemRows.length)await req('/rest/v1/inventory_count_items',{method:'POST',body:JSON.stringify(itemRows.map(i=>({...i,count_id:countId})))});
  await loadInventoryCountHistory();
}
function renderInventoryCountHistory(){
  const tab=$('inventoryCountTab');if(!tab)return;
  let box=$('inventoryCountHistoryBox');
  if(!box){box=document.createElement('div');box.id='inventoryCountHistoryBox';box.className='card';box.style.margin='14px 0';const rows=$('inventoryCountRows');if(rows)rows.insertAdjacentElement('beforebegin',box);else tab.appendChild(box);}
  const history=inventoryCountCloudHistory;
  const editing=editingInventoryCountId?'<div class="msg" style="margin-bottom:10px">אתה עורך עכשיו ספירה ישנה. שמירה ועדכון יעדכנו גם את הרשומה ההיסטורית בענן.</div>':'';
  if(!history.length){box.innerHTML='<div class="bar"><h3>היסטוריית ספירות מלאי</h3></div><div class="msg">'+(inventoryCountHistoryLoading?'טוען היסטוריה מהענן...':'אין עדיין ספירות שמורות')+'</div>';if(!inventoryCountHistoryLoading)loadInventoryCountHistory();return;}
  box.innerHTML='<div class="bar"><h3>היסטוריית ספירות מלאי</h3><button class="light" type="button" onclick="loadInventoryCountHistory()">רענן</button></div>'+editing+history.map(h=>{
    const amount=Object.keys(h.items||{}).length;
    const label=h.source==='manual_snapshot'?' · צילום מלאי חד־פעמי':'';
    return '<div class="supplier-row"><div><b>'+esc(inventoryCountDate(h.saved_at))+'</b><br><span class="msg">'+amount+' מוצרים בספירה'+label+(h.updated_at&&h.updated_at!==h.saved_at?' · עודכנה '+esc(inventoryCountDate(h.updated_at)):'')+'</span></div><button class="blue" type="button" onclick="openInventoryCountHistory(\''+String(h.id).replace(/'/g,'')+'\')">פתח / ערוך</button></div>';
  }).join('');
}
function openInventoryCountHistory(id){
  const h=inventoryCountCloudHistory.find(x=>String(x.id)===String(id));if(!h)return alert('הספירה לא נמצאה');
  if(!confirm('לפתוח את הספירה מתאריך '+inventoryCountDate(h.saved_at)+' לעריכה?\nהמלאי עצמו לא ישתנה עד שתלחץ על שמירה ועדכון.'))return;
  inventoryCountDraft={...h.items};editingInventoryCountId=String(h.id);sessionStorage.setItem('inventory_count_editing_id',editingInventoryCountId);localStorage.setItem('inventory_count_draft',JSON.stringify(inventoryCountDraft));renderInventoryCount();
}
function cancelInventoryCountHistoryEdit(){editingInventoryCountId='';sessionStorage.removeItem('inventory_count_editing_id');inventoryCountDraft={};localStorage.removeItem('inventory_count_draft');renderInventoryCount();}

function renderInventoryCount(){
  const host=$('inventoryCountRows');if(!host)return;
  const category=$('countNewCategory');if(category)category.innerHTML=cats.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  const rows=prods.filter(p=>p.is_active!==false||Object.prototype.hasOwnProperty.call(inventoryCountDraft,p.id));const groups=[];
  cats.forEach(cat=>{const products=rows.filter(p=>p.category_id===cat.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));if(products.length)groups.push({id:cat.id,name:cat.name,products});});
  const uncategorized=rows.filter(p=>!cats.some(c=>c.id===p.category_id)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'he'));if(uncategorized.length)groups.push({id:'uncategorized',name:'ללא קטגוריה',products:uncategorized});
  host.innerHTML=(editingInventoryCountId?'<div class="card" style="margin-bottom:12px"><b>עריכת ספירה ישנה</b> <button class="light" type="button" onclick="cancelInventoryCountHistoryEdit()">בטל עריכה</button></div>':'')+groups.map(group=>{
    const counted=group.products.filter(p=>Object.prototype.hasOwnProperty.call(inventoryCountDraft,p.id)).length;
    const productRows=group.products.map(p=>{const value=Object.prototype.hasOwnProperty.call(inventoryCountDraft,p.id)?inventoryCountDraft[p.id]:'';return '<div class="admin-product" style="grid-template-columns:1fr 150px;gap:12px"><div class="admin-info"><b>'+esc(p.name)+'</b><br><span class="msg">מלאי נוכחי: '+Number(p.stock_quantity||0)+'</span></div><input class="count-qty" data-product-id="'+p.id+'" min="0" step="1" inputmode="numeric" type="number" value="'+esc(value)+'" placeholder="כמה יש?"></div>';}).join('');
    return '<details class="history-card inventory-count-category" '+(counted?'open':'')+'><summary class="history-head" style="cursor:pointer;list-style:none"><span><b>'+esc(group.name)+'</b></span><span class="msg">'+counted+' מתוך '+group.products.length+' נספרו</span></summary><div class="history-body">'+productRows+'</div></details>';
  }).join('')||'<div class="msg">אין מוצרים לספירה</div>';
  host.querySelectorAll('.count-qty').forEach(input=>input.oninput=()=>{if(input.value==='')delete inventoryCountDraft[input.dataset.productId];else inventoryCountDraft[input.dataset.productId]=Math.max(0,Math.floor(Number(input.value)||0));localStorage.setItem('inventory_count_draft',JSON.stringify(inventoryCountDraft));updateInventoryCountSummary();const details=input.closest('.inventory-count-category'),counter=details?.querySelector('summary .msg');if(details&&counter){const total=details.querySelectorAll('.count-qty').length;const done=[...details.querySelectorAll('.count-qty')].filter(x=>x.value!=='').length;counter.textContent=done+' מתוך '+total+' נספרו';}});
  updateInventoryCountSummary();renderInventoryCountHistory();if(!inventoryCountCloudHistory.length&&!inventoryCountHistoryLoading)loadInventoryCountHistory();
}
function updateInventoryCountSummary(){const e=$('inventoryCountSummary');if(e)e.textContent=Object.keys(inventoryCountDraft).length+' מוצרים נספרו'+(editingInventoryCountId?' · עריכת ספירה ישנה':'');}
async function addInventoryCountProduct(){
  try{const name=$('countNewName').value.trim(),category_id=$('countNewCategory').value;if(!name)return alert('כתוב שם מוצר');if(!category_id)return alert('בחר קטגוריה');if(activeProducts().some(p=>p.name.toLowerCase()===name.toLowerCase()))return alert('המוצר כבר קיים. יש להזין לו רק כמות ברשימת הספירה.');const price=Math.max(0,Number($('countNewPrice').value)||0),stock=Math.max(0,Math.floor(Number($('countNewStock').value)||0)),low=Math.max(0,Math.floor(Number($('countNewLow').value)||3));let image_url='',image_path='',file=$('countNewImage').files[0];if(file){const uploaded=await uploadImage(file,'products');image_url=uploaded.url||uploaded.image_url||'';image_path=uploaded.path||uploaded.image_path||'';}const sort_order=Math.max(0,...prods.filter(p=>p.category_id===category_id).map(p=>Number(p.sort_order)||0))+1;const body={category_id,name,price,stock_quantity:0,low_stock_threshold:low,sort_order,image_url,image_path,is_active:true};const result=await req('/rest/v1/products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});const product=Array.isArray(result)?result[0]:result;if(product&&product.id){prods.push(product);inventoryCountDraft[product.id]=stock;}$('countNewName').value='';$('countNewPrice').value='';$('countNewStock').value='0';$('countNewLow').value='3';$('countNewImage').value='';localStorage.setItem('inventory_count_draft',JSON.stringify(inventoryCountDraft));renderInventoryCount();}catch(e){alert('שמירת המוצר נכשלה: '+(e.message||e));}
}
function saveInventoryCountOnly(){localStorage.setItem('inventory_count_draft',JSON.stringify(inventoryCountDraft));alert('הספירה נשמרה כטיוטה בלי לעדכן את מלאי הלקוחות.');}
async function applyInventoryCount(zeroMissing){
  const counted=Object.keys(inventoryCountDraft).filter(id=>inventoryCountDraft[id]!==''&&Number.isFinite(Number(inventoryCountDraft[id])));if(!counted.length)return alert('עדיין לא הוזנו כמויות');const message=zeroMissing?'לעדכן את המוצרים שנספרו ולאפס ל־0 את כל השאר?':'לעדכן רק את המוצרים שנספרו ולהשאיר את השאר ללא שינוי?';if(!confirm(message))return;
  try{const countable=prods.filter(p=>p.is_active!==false||counted.includes(p.id));const targets=zeroMissing?countable:countable.filter(p=>counted.includes(p.id));for(const p of targets){const quantity=counted.includes(p.id)?Math.max(0,Math.floor(Number(inventoryCountDraft[p.id])||0)):0;await req('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',body:JSON.stringify({stock_quantity:quantity})});}await saveInventoryCountSnapshot(zeroMissing);inventoryCountDraft={};localStorage.removeItem('inventory_count_draft');editingInventoryCountId='';sessionStorage.removeItem('inventory_count_editing_id');await load();renderInventoryCount();alert('הספירה נשמרה בענן, נוספה להיסטוריה ומלאי הלקוחות עודכן.');}catch(e){alert('עדכון הספירה נעצר: '+(e.message||e));}
}

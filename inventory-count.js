// Fast physical inventory count shared by the website and the native app.
let inventoryCountDraft=JSON.parse(localStorage.getItem('inventory_count_draft')||'{}');

function renderInventoryCount(){
  const host=$('inventoryCountRows');if(!host)return;
  const category=$('countNewCategory');
  if(category)category.innerHTML=cats.map(c=>'<option value="'+c.id+'">'+esc(c.name)+'</option>').join('');
  const rows=activeProducts().slice().sort((a,b)=>{
    const ac=cats.findIndex(c=>c.id===a.category_id),bc=cats.findIndex(c=>c.id===b.category_id);
    return ac-bc||(a.sort_order||0)-(b.sort_order||0);
  });
  host.innerHTML=rows.map(p=>{
    const cat=cats.find(c=>c.id===p.category_id)?.name||'ללא קטגוריה';
    const value=Object.prototype.hasOwnProperty.call(inventoryCountDraft,p.id)?inventoryCountDraft[p.id]:'';
    return '<div class="admin-product" style="grid-template-columns:1fr 150px;gap:12px">'
      +'<div class="admin-info"><b>'+esc(p.name)+'</b><br><span class="msg">'+esc(cat)+' · מלאי נוכחי: '+Number(p.stock_quantity||0)+'</span></div>'
      +'<input class="count-qty" data-product-id="'+p.id+'" min="0" step="1" inputmode="numeric" type="number" value="'+esc(value)+'" placeholder="כמה יש?"></div>';
  }).join('')||'<div class="msg">אין מוצרים לספירה</div>';
  host.querySelectorAll('.count-qty').forEach(input=>input.oninput=()=>{
    if(input.value==='')delete inventoryCountDraft[input.dataset.productId];
    else inventoryCountDraft[input.dataset.productId]=Math.max(0,Math.floor(Number(input.value)||0));
    localStorage.setItem('inventory_count_draft',JSON.stringify(inventoryCountDraft));
    updateInventoryCountSummary();
  });
  updateInventoryCountSummary();
}
function updateInventoryCountSummary(){
  const e=$('inventoryCountSummary');if(e)e.textContent=Object.keys(inventoryCountDraft).length+' מוצרים נספרו';
}
async function addInventoryCountProduct(){
  try{
    const name=$('countNewName').value.trim(),category_id=$('countNewCategory').value;
    if(!name)return alert('כתוב שם מוצר');
    if(!category_id)return alert('בחר קטגוריה');
    let existing=activeProducts().find(p=>p.name.toLowerCase()===name.toLowerCase());
    if(existing){$('countNewName').value='';inventoryCountDraft[existing.id]=inventoryCountDraft[existing.id]??'';renderInventoryCount();return;}
    const sort_order=Math.max(0,...prods.filter(p=>p.category_id===category_id).map(p=>Number(p.sort_order)||0))+1;
    const body={category_id,name,price:0,stock_quantity:0,low_stock_threshold:3,sort_order,image_url:'',image_path:'',is_active:false};
    const result=await req('/rest/v1/products',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(body)});
    const product=Array.isArray(result)?result[0]:result;
    if(product&&product.id){prods.push(product);inventoryCountDraft[product.id]='';}
    $('countNewName').value='';localStorage.setItem('inventory_count_draft',JSON.stringify(inventoryCountDraft));renderInventoryCount();
    alert('המוצר נשמר. הוא יישאר מוסתר מהלקוחות עד שיוגדר לו מחיר ויופעל.');
  }catch(e){alert('שמירת המוצר נכשלה: '+(e.message||e));}
}
async function finishInventoryCount(){
  const counted=Object.keys(inventoryCountDraft).filter(id=>inventoryCountDraft[id]!==''&&Number.isFinite(Number(inventoryCountDraft[id])));
  if(!counted.length)return alert('עדיין לא הוזנו כמויות');
  const zeroMissing=confirm('האם לאפס ל־0 את כל המוצרים שלא הוזנה עבורם כמות?\n\nאישור = כן, איפוס מלא של מלאי הלקוחות.\nביטול = לעדכן רק מוצרים שנספרו.');
  if(!confirm('לסיים את הספירה ולעדכן עכשיו את מלאי הלקוחות?'))return;
  try{
    const targets=zeroMissing?activeProducts():activeProducts().filter(p=>counted.includes(p.id));
    for(const p of targets){
      const quantity=counted.includes(p.id)?Math.max(0,Math.floor(Number(inventoryCountDraft[p.id])||0)):0;
      await req('/rest/v1/products?id=eq.'+encodeURIComponent(p.id),{method:'PATCH',body:JSON.stringify({stock_quantity:quantity})});
    }
    inventoryCountDraft={};localStorage.removeItem('inventory_count_draft');
    await load();renderInventoryCount();
    alert(navigator.onLine?'ספירת המלאי נשמרה ומלאי הלקוחות עודכן.':'הספירה נשמרה במכשיר וממתינה לסנכרון לענן.');
  }catch(e){alert('עדכון הספירה נעצר: '+(e.message||e));}
}

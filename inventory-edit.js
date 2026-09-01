(function(){
let cache=[];
async function editMovement(m){
  let qty=prompt('שינוי כמות. להפחתה רשום מספר שלילי:',String(m.change_qty??0));if(qty===null)return;
  qty=Number(qty);if(!Number.isFinite(qty)||qty===0)return alert('הזן כמות תקינה שאינה 0');
  let reason=prompt('סיבה להתאמה:',m.reason||'');if(reason===null)return;
  let note=prompt('הערה:',m.note||'');if(note===null)return;
  try{
    let old=Number(m.change_qty||0),diff=qty-old;
    if(diff){let p=prods.find(x=>String(x.id)===String(m.product_id));if(!p)throw new Error('המוצר לא נמצא');let newStock=Number(p.stock_quantity||0)+diff;if(newStock<0&&!confirm('העריכה תיצור מלאי שלילי. להמשיך?'))return;await req('/rest/v1/products?id=eq.'+encodeURIComponent(m.product_id),{method:'PATCH',body:JSON.stringify({stock_quantity:newStock})})}
    await req('/rest/v1/inventory_movements?id=eq.'+encodeURIComponent(m.id),{method:'PATCH',body:JSON.stringify({change_qty:qty,reason:reason.trim()||'תיקון',note:note.trim()||null})});
    await load();await loadInventoryHistory();
  }catch(e){alert('עריכת ההתאמה נכשלה: '+(e.message||e))}
}
function addButtons(){let host=document.getElementById('inventoryHistory');if(!host||!cache.length)return;let rows=host.querySelectorAll('tbody tr');rows.forEach((tr,i)=>{let m=cache[i];if(!m||tr.querySelector('.inventory-edit-btn'))return;let td=document.createElement('td');let b=document.createElement('button');b.className='blue inventory-edit-btn';b.textContent='עריכה';b.onclick=()=>editMovement(m);td.appendChild(b);tr.appendChild(td)});let hr=host.querySelector('thead tr');if(hr&&!hr.querySelector('.inventory-edit-head')){let th=document.createElement('th');th.className='inventory-edit-head';th.textContent='פעולות';hr.appendChild(th)}}
function wrap(){let old=window.loadInventoryHistory;if(typeof old!=='function'||old.__inventoryEdit)return;let f=async function(){let r=await old.apply(this,arguments);try{cache=await req('/rest/v1/inventory_movements?select=*&order=created_at.desc&limit=500')||[];setTimeout(addButtons,0)}catch(e){console.warn('inventory edit load',e)}return r};f.__inventoryEdit=true;window.loadInventoryHistory=f}
window.addEventListener('load',()=>setTimeout(wrap,0));setTimeout(wrap,500);
})();
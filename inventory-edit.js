(function(){
let cache=[];
async function editMovement(m){
  let p=(prods||[]).find(x=>String(x.id)===String(m.product_id));if(!p)return alert('המוצר של ההתאמה לא נמצא');
  let qty=prompt('עריכת התאמת מלאי עבור '+p.name+'\nכמות שינוי (להפחתה מספר שלילי):',String(m.change_qty??0));if(qty===null)return;qty=Number(qty);if(!Number.isFinite(qty)||qty===0)return alert('הזן כמות תקינה שאינה 0');
  let reason=prompt('סיבה להתאמה:',m.reason||'');if(reason===null)return;let note=prompt('הערה:',m.note||'');if(note===null)return;
  try{let old=Number(m.change_qty||0),diff=qty-old,newStock=Number(p.stock_quantity||0)+diff;if(newStock<0&&!confirm('העריכה תיצור מלאי שלילי. להמשיך?'))return;
    if(diff)await req('/rest/v1/products?id=eq.'+encodeURIComponent(m.product_id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({stock_quantity:newStock})});
    await req('/rest/v1/inventory_movements?id=eq.'+encodeURIComponent(m.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({change_qty:qty,reason:reason.trim()||'תיקון',note:note.trim()||null})});
    await load();await window.loadInventoryHistory();alert('התאמת המלאי עודכנה בהצלחה');
  }catch(e){alert('עריכת ההתאמה נכשלה: '+(e.message||e))}
}
async function resetInventoryHistory(){
  if(!confirm('לאפס את כל היסטוריית התאמות המלאי?\n\nהפעולה תמחק את ההיסטוריה בלבד ולא תשנה את המלאי הנוכחי של המוצרים.'))return;
  if(!confirm('אישור אחרון: למחוק לצמיתות את כל היסטוריית התאמות המלאי?'))return;
  try{
    await req('/rest/v1/inventory_movements?id=not.is.null',{method:'DELETE',headers:{Prefer:'return=minimal'}});
    cache=[];
    await window.loadInventoryHistory();
    alert('היסטוריית התאמות המלאי אופסה בהצלחה');
  }catch(e){alert('איפוס ההיסטוריה נכשל: '+(e.message||e))}
}
function ensureResetButton(){
  let host=document.getElementById('inventoryHistory');if(!host)return;
  let card=host.closest('.card'),bar=card?.querySelector('.bar');if(!bar||bar.querySelector('.inventory-reset-btn'))return;
  let b=document.createElement('button');b.type='button';b.className='red inventory-reset-btn';b.textContent='איפוס היסטוריה';b.onclick=resetInventoryHistory;
  let refresh=[...bar.querySelectorAll('button')].find(x=>x.textContent.includes('רענן'));if(refresh)refresh.insertAdjacentElement('afterend',b);else bar.appendChild(b)
}
async function renderEditor(){let host=document.getElementById('inventoryHistory');if(!host)return;ensureResetButton();try{cache=await req('/rest/v1/inventory_movements?select=*&order=created_at.desc&limit=500')||[]}catch(e){console.warn(e);return}if(!cache.length)return;
  let rows=[...host.querySelectorAll('tbody tr')];if(rows.length){let head=host.querySelector('thead tr');if(head&&!head.querySelector('.inventory-edit-head')){let th=document.createElement('th');th.className='inventory-edit-head';th.textContent='פעולות';head.appendChild(th)}rows.forEach((tr,i)=>{let m=cache[i];if(!m||tr.querySelector('.inventory-edit-btn'))return;let td=document.createElement('td'),b=document.createElement('button');b.type='button';b.className='blue inventory-edit-btn';b.textContent='עריכה';b.onclick=()=>editMovement(m);td.appendChild(b);tr.appendChild(td)});return}
  let panel=document.createElement('div');panel.className='inventory-edit-panel';panel.innerHTML='<h4>עריכת התאמות שנשמרו</h4>';cache.forEach(m=>{let p=(prods||[]).find(x=>String(x.id)===String(m.product_id)),d=document.createElement('div');d.className='supplier-row';d.innerHTML='<div><b>'+esc(p?.name||'מוצר')+'</b><br><span class="msg">'+esc(m.created_at?new Date(m.created_at).toLocaleString('he-IL'):'')+' · שינוי '+Number(m.change_qty||0)+' · '+esc(m.reason||'')+'</span></div>';let b=document.createElement('button');b.type='button';b.className='blue';b.textContent='עריכה';b.onclick=()=>editMovement(m);d.appendChild(b);panel.appendChild(d)});host.appendChild(panel)
}
function wrap(){let old=window.loadInventoryHistory;if(typeof old!=='function'||old.__savedInventoryEditor)return;let f=async function(){let r=await old.apply(this,arguments);await renderEditor();return r};f.__savedInventoryEditor=true;window.loadInventoryHistory=f}
window.resetInventoryHistory=resetInventoryHistory;
wrap();window.addEventListener('load',wrap);setTimeout(()=>{wrap();if(document.getElementById('inventoryHistory'))renderEditor()},300);
})();
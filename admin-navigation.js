(function(){
const $=id=>document.getElementById(id);
const groups=[
 {name:'ראשי',keys:['dashboard','משימות','הערות','מודעות']},
 {name:'מוצרים ומלאי',keys:['מוצר','קטגור','מלאי','ספירת','מה צריך להזמין']},
 {name:'רכש וספקים',keys:['רכישה','ספק','הזמנות ספקים']},
 {name:'מכירות וכספים',keys:['מכירות','דוח','הכנסות','כספים','משיכות','מכירה מיוחדת']},
 {name:'הגדרות',keys:['הגדר','נדרים','סיסמ','GPT','יציאה']}
];
function txt(b){return (b.textContent||'').trim()}
function build(){let admin=$('admin'),menu=admin?.querySelector('.adminmenu');if(!menu||$('adminNavGroups'))return;let buttons=[...menu.children].filter(x=>x.tagName==='BUTTON');if(!buttons.length)return;let wrap=document.createElement('div');wrap.id='adminNavGroups';wrap.style.cssText='display:flex;gap:7px;flex-wrap:wrap;width:100%;margin-bottom:8px';let panels=document.createElement('div');panels.id='adminNavPanels';panels.style.width='100%';let assigned=new Set();groups.forEach((g,gi)=>{let gb=document.createElement('button');gb.className=gi===0?'blue':'light';gb.textContent=g.name;gb.dataset.group=gi;wrap.appendChild(gb);let p=document.createElement('div');p.dataset.groupPanel=gi;p.style.cssText='display:'+(gi===0?'flex':'none')+';gap:7px;flex-wrap:wrap;width:100%;margin-bottom:8px';buttons.forEach(b=>{let t=txt(b);if(!assigned.has(b)&&g.keys.some(k=>t.includes(k))){assigned.add(b);p.appendChild(b)}});panels.appendChild(p);gb.onclick=()=>{wrap.querySelectorAll('button').forEach(x=>x.className='light');gb.className='blue';panels.querySelectorAll('[data-group-panel]').forEach(x=>x.style.display='none');p.style.display='flex'}});let rest=buttons.filter(b=>!assigned.has(b));if(rest.length){let gb=document.createElement('button');gb.className='light';gb.textContent='עוד';wrap.appendChild(gb);let p=document.createElement('div');p.style.cssText='display:none;gap:7px;flex-wrap:wrap;width:100%;margin-bottom:8px';rest.forEach(b=>p.appendChild(b));panels.appendChild(p);gb.onclick=()=>{wrap.querySelectorAll('button').forEach(x=>x.className='light');gb.className='blue';panels.querySelectorAll('[data-group-panel]').forEach(x=>x.style.display='none');[...panels.children].forEach(x=>x.style.display='none');p.style.display='flex'}}menu.prepend(panels);menu.prepend(wrap)}
window.ensureAdminNavigation=build;setTimeout(build,1800);
})();
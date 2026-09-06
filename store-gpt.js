(function(){
  const STORAGE='store_gpt_messages_v1';
  let messages=[];
  try{messages=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(messages))messages=[]}catch{messages=[]}
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function save(){localStorage.setItem(STORAGE,JSON.stringify(messages.slice(-40)))}
  function ensure(){
    if(document.getElementById('storeGptTab'))return;
    const menu=document.querySelector('#admin .adminmenu');
    const tabs=document.querySelector('#admin');
    if(!menu||!tabs)return;
    const btn=document.createElement('button');btn.className='blue';btn.textContent='GPT';btn.onclick=()=>{adminTab('storeGptTab');render()};menu.appendChild(btn);
    const section=document.createElement('div');section.className='adminTab hidden';section.id='storeGptTab';
    section.innerHTML='<div class="card" style="max-width:1000px;margin:auto"><div class="bar"><div><h3 style="margin:0">GPT</h3><div class="msg">העוזר החכם של מערכת החנות</div></div><button class="light" id="storeGptNew">שיחה חדשה</button></div><div id="storeGptMessages" style="height:min(58vh,650px);overflow:auto;padding:12px;background:#f8fafc;border-radius:14px;margin:14px 0"></div><div class="form"><textarea id="storeGptInput" rows="3" placeholder="כתוב הודעה..." style="resize:vertical"></textarea><div class="bar"><label style="display:flex;gap:7px;align-items:center;margin:0"><input id="storeGptWeb" type="checkbox" style="width:auto;margin:0"> חיפוש באינטרנט</label><button class="blue" id="storeGptSend">שלח</button></div><div class="msg" id="storeGptStatus"></div></div></div>';
    tabs.appendChild(section);
    section.querySelector('#storeGptNew').onclick=()=>{if(messages.length&&!confirm('לפתוח שיחה חדשה?'))return;messages=[];save();render()};
    section.querySelector('#storeGptSend').onclick=send;
    section.querySelector('#storeGptInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
    render();
  }
  function render(){
    const box=document.getElementById('storeGptMessages');if(!box)return;
    if(!messages.length)box.innerHTML='<div class="msg" style="text-align:center;padding:50px 10px">איך אפשר לעזור?</div>';
    else box.innerHTML=messages.map(m=>'<div style="display:flex;justify-content:'+(m.role==='user'?'flex-start':'flex-end')+';margin:10px 0"><div style="max-width:82%;white-space:pre-wrap;line-height:1.55;padding:11px 14px;border-radius:14px;background:'+(m.role==='user'?'#dbeafe':'#fff')+';box-shadow:0 1px 3px #0001">'+escHtml(m.content)+'</div></div>').join('');
    box.scrollTop=box.scrollHeight;
  }
  async function send(){
    const input=document.getElementById('storeGptInput'),status=document.getElementById('storeGptStatus'),button=document.getElementById('storeGptSend');
    const text=input?.value.trim();if(!text||button?.disabled)return;
    messages.push({role:'user',content:text});input.value='';save();render();button.disabled=true;status.textContent='GPT חושב...';
    try{
      const r=await fetch('/api/gpt',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({messages:messages.slice(-40),webSearch:!!document.getElementById('storeGptWeb')?.checked})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'שגיאה');messages.push({role:'assistant',content:d.text||'לא התקבלה תשובה'});save();render();status.textContent='';
    }catch(e){status.textContent='שגיאה: '+e.message}finally{button.disabled=false;input.focus()}
  }
  window.ensureStoreGpt=ensure;
})();
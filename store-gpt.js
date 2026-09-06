(function(){
  const STORAGE='store_gpt_messages_v1';
  let messages=[];
  let proposal=null;
  const busy={chat:false,proposal:false,apply:false};
  try{messages=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(messages))messages=[]}catch{messages=[]}
  const escHtml=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function save(){try{localStorage.setItem(STORAGE,JSON.stringify(messages.slice(-40)))}catch{}}
  function authToken(){return typeof token==='string'?token:''}
  async function apiRequest(url,body){
    const accessToken=authToken();
    if(!accessToken)throw new Error('יש להתחבר מחדש למערכת');
    let response;
    try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+accessToken},body:JSON.stringify(body)})}
    catch{throw new Error('לא ניתן להתחבר לשרת. בדוק את החיבור ונסה שוב')}
    const raw=await response.text();
    let data={};
    if(raw){try{data=JSON.parse(raw)}catch{if(response.ok)throw new Error('השרת החזיר תשובה לא תקינה')}}
    if(!response.ok)throw new Error(data?.error||('שגיאת שרת ('+response.status+')'));
    return data;
  }
  function ensure(){
    if(document.getElementById('storeGptTab'))return;
    const menu=document.querySelector('#admin .adminmenu');
    const tabs=document.querySelector('#admin');
    if(!menu||!tabs)return;
    const btn=document.createElement('button');btn.className='blue';btn.textContent='GPT';btn.onclick=()=>{adminTab('storeGptTab');render()};menu.appendChild(btn);
    const section=document.createElement('div');section.className='adminTab hidden';section.id='storeGptTab';
    section.innerHTML='<div class="card" style="max-width:1000px;margin:auto"><div class="bar"><div><h3 style="margin:0">GPT</h3><div class="msg">העוזר החכם של מערכת החנות</div></div><button class="light" id="storeGptNew">שיחה חדשה</button></div><div id="storeGptMessages" style="height:min(52vh,590px);overflow:auto;padding:12px;background:#f8fafc;border-radius:14px;margin:14px 0"></div><div id="storeGptProposal"></div><div class="form"><textarea id="storeGptInput" rows="3" placeholder="כתוב הודעה או בקש שינוי באתר..." style="resize:vertical"></textarea><div class="bar" style="flex-wrap:wrap"><label style="display:flex;gap:7px;align-items:center;margin:0"><input id="storeGptWeb" type="checkbox" checked style="width:auto;margin:0"> חיפוש באינטרנט</label><div style="display:flex;gap:8px"><button class="light" id="storeGptPlan">הכן שדרוג לאתר</button><button class="blue" id="storeGptSend">שלח</button></div></div><div class="msg" id="storeGptStatus"></div></div></div>';
    tabs.appendChild(section);
    section.querySelector('#storeGptNew').onclick=()=>{
      if(busy.chat||busy.proposal||busy.apply){alert('יש להמתין לסיום הפעולה הנוכחית');return}
      if(messages.length&&!confirm('לפתוח שיחה חדשה?'))return;
      messages=[];proposal=null;save();render();renderProposal();
      const status=document.getElementById('storeGptStatus');if(status)status.textContent='';
    };
    section.querySelector('#storeGptSend').onclick=send;
    section.querySelector('#storeGptPlan').onclick=proposeUpgrade;
    section.querySelector('#storeGptInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});
    render();renderProposal();
  }
  function render(){
    const box=document.getElementById('storeGptMessages');if(!box)return;
    if(!messages.length)box.innerHTML='<div class="msg" style="text-align:center;padding:50px 10px">איך אפשר לעזור?</div>';
    else box.innerHTML=messages.map(m=>'<div style="display:flex;justify-content:'+(m.role==='user'?'flex-start':'flex-end')+';margin:10px 0"><div style="max-width:82%;white-space:pre-wrap;line-height:1.55;padding:11px 14px;border-radius:14px;background:'+(m.role==='user'?'#dbeafe':'#fff')+';box-shadow:0 1px 3px #0001">'+escHtml(m.content)+'</div></div>').join('');
    box.scrollTop=box.scrollHeight;
  }
  function renderProposal(){
    const box=document.getElementById('storeGptProposal');if(!box)return;
    if(!proposal){box.innerHTML='';return}
    const files=(proposal.files||[]).map(x=>'<code>'+escHtml(x)+'</code>').join(' ');
    const steps=(proposal.steps||[]).map(x=>'<li>'+escHtml(x)+'</li>').join('');
    box.innerHTML='<div class="card" style="margin:10px 0;border:2px solid #dbeafe"><h3 style="margin-top:0">שדרוג מוכן לאישור: '+escHtml(proposal.title||'שינוי באתר')+'</h3><p>'+escHtml(proposal.summary||'')+'</p><div class="msg"><b>קבצים צפויים:</b> '+(files||'לא נבחרו קבצים')+'</div><ol>'+steps+'</ol><div class="bar"><span class="msg">רמת סיכון: '+escHtml(proposal.risk||'לא צוינה')+'</span><button class="blue" id="storeGptApprove"'+(proposal.files?.length?'':' disabled')+'>אשר והכן לבדיקה</button></div><div class="msg" id="storeGptApplyStatus" style="margin-top:8px">האישור ייצור ענף נפרד ו-Pull Request לבדיקה. האתר הפעיל לא ישתנה בשלב הזה.</div></div>';
    const approve=document.getElementById('storeGptApprove');if(approve)approve.onclick=applyUpgrade;
  }
  async function applyUpgrade(){
    const button=document.getElementById('storeGptApprove'),status=document.getElementById('storeGptApplyStatus');
    if(!proposal||busy.apply||button?.disabled||!status)return;
    if(!confirm('לאשר ל-GPT להכין את שינויי הקוד בענף נפרד לבדיקה?'))return;
    busy.apply=true;button.disabled=true;status.textContent='מכין קוד, יוצר ענף נפרד ו-Pull Request...';
    let completed=false;
    try{
      const data=await apiRequest('/api/gpt-apply',{proposal});
      if(!data.prUrl||!data.prNumber)throw new Error('השינוי הוכן אך לא התקבל קישור תקין לבדיקה');
      status.innerHTML='השדרוג הוכן לבדיקה. האתר הפעיל עדיין לא שונה. <a href="'+escHtml(data.prUrl)+'" target="_blank" rel="noopener">פתח את Pull Request #'+escHtml(data.prNumber)+'</a>';
      button.textContent='הוכן לבדיקה';completed=true;
    }catch(e){status.textContent='שגיאה: '+e.message}
    finally{busy.apply=false;if(!completed)button.disabled=false}
  }
  async function proposeUpgrade(){
    const input=document.getElementById('storeGptInput'),status=document.getElementById('storeGptStatus'),button=document.getElementById('storeGptPlan');
    const request=input?.value.trim();if(!request||busy.proposal||button?.disabled||!status)return;
    busy.proposal=true;button.disabled=true;status.textContent='בודק את מבנה האתר ומכין הצעת שדרוג...';
    try{
      const data=await apiRequest('/api/gpt-propose',{request});
      if(!data.proposal||typeof data.proposal!=='object')throw new Error('לא התקבלה הצעת שדרוג תקינה');
      proposal={...data.proposal,files:Array.isArray(data.proposal.files)?data.proposal.files:[],steps:Array.isArray(data.proposal.steps)?data.proposal.steps:[]};
      renderProposal();status.textContent='ההצעה מוכנה. בדוק ואשר רק אם היא מתאימה.';
    }catch(e){status.textContent='שגיאה: '+e.message}
    finally{busy.proposal=false;button.disabled=false}
  }
  async function send(){
    const input=document.getElementById('storeGptInput'),status=document.getElementById('storeGptStatus'),button=document.getElementById('storeGptSend');
    const text=input?.value.trim();if(!text||busy.chat||button?.disabled||!status)return;
    const userMessage={role:'user',content:text};
    messages.push(userMessage);input.value='';save();render();busy.chat=true;button.disabled=true;status.textContent='GPT חושב...';
    try{
      const data=await apiRequest('/api/gpt',{messages:messages.slice(-40),webSearch:!!document.getElementById('storeGptWeb')?.checked});
      const answer=typeof data.text==='string'?data.text.trim():'';
      if(!answer)throw new Error('לא התקבלה תשובה מ-GPT');
      messages.push({role:'assistant',content:answer});save();render();status.textContent='';
    }catch(e){
      if(messages[messages.length-1]===userMessage){messages.pop();save();render();if(input&&!input.value)input.value=text}
      status.textContent='שגיאה: '+e.message;
    }finally{busy.chat=false;button.disabled=false;input?.focus()}
  }
  window.ensureStoreGpt=ensure;
})();

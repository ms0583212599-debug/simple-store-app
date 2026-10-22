(()=>{
 'use strict';
 const actions=document.querySelector('#admin > .bar .actions');
 if(!actions||document.getElementById('financeOpen'))return;
 const button=document.createElement('button');button.id='financeOpen';button.className='blue';button.type='button';button.textContent='ניהול כלכלה';actions.prepend(button);
 const dialog=document.createElement('dialog');dialog.id='financeDialog';dialog.setAttribute('aria-label','ניהול כלכלה');dialog.style.cssText='width:min(1280px,97vw);max-width:97vw;height:94dvh;max-height:94dvh;padding:0;border:1px solid #d4dee6;border-radius:16px;overflow:hidden';
 const bar=document.createElement('div');bar.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 18px;background:#fff';const title=document.createElement('strong');title.textContent='ניהול כלכלה';const right=document.createElement('div');right.style.cssText='display:flex;gap:12px;align-items:center';const link=document.createElement('a');link.href='/finance.html';link.target='_blank';link.rel='noopener';link.textContent='פתיחה בנפרד ↗';const close=document.createElement('button');close.type='button';close.className='light';close.textContent='סגור וחזור לחנות';right.append(link,close);bar.append(title,right);
 const frame=document.createElement('iframe');frame.title='פירוט הכנסות והוצאות';frame.style.cssText='display:block;width:100%;height:calc(100% - 64px);border:0;background:#f3f6f9';dialog.append(bar,frame);document.body.append(dialog);
 button.onclick=()=>{frame.src='/finance.html';dialog.showModal();close.focus();};close.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{frame.src='about:blank';button.focus();});
})();

/* Presentation and navigation only. Existing account actions keep their handlers. */
(()=>{
 const panel=document.getElementById('vendpayPanel'),workspace=document.getElementById('vendpayWorkspace');
 if(!panel||!workspace||panel.dataset.layoutReady)return;
 panel.dataset.layoutReady='true';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const paths={customers:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',connection:'M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l2-2',voice:'M12 3v18M8 6v12M4 9v6M16 6v12M20 9v6',log:'M8 3h8v4H8zM8 5H5v16h14V5h-3M8 12h8M8 16h5',pay:'M3 5h18v14H3zM3 9h18M7 15h3'};
 const icon=key=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[key]);svg.append(p);return svg;};
 const heading=panel.querySelector('.vp-heading');
 if(heading){heading.querySelector('.vp-eyebrow').textContent='VENDPAY / MANAGEMENT';heading.querySelector('h2').textContent='ניהול וונד פיי';heading.querySelector('p').textContent='כל החיבורים. מקום אחד.';}
 const topbar=panel.querySelector('.modal-card > .bar');
 const mark=el('span','vp-brand-mark','V');mark.setAttribute('aria-hidden','true');heading?.prepend(mark);
 const login=document.getElementById('vendpayLogin');
 login.querySelector('h3').textContent='טוב לראות אותך';login.querySelector('.msg').textContent='כניסה לסביבת הניהול שלך';
 document.getElementById('vendpayEmail').placeholder='name@example.com';document.getElementById('vendpayEmail').dir='ltr';document.getElementById('vendpayPassword').placeholder='הסיסמה שלך';
 const password=document.getElementById('vendpayPassword'),passwordBox=el('div','vp-password-box'),reveal=el('button','vp-password-toggle','הצג');reveal.type='button';reveal.setAttribute('aria-label','הצג סיסמה');reveal.setAttribute('aria-pressed','false');password.before(passwordBox);passwordBox.append(password,reveal);reveal.onclick=()=>{const show=password.type==='password';password.type=show?'text':'password';reveal.textContent=show?'הסתר':'הצג';reveal.setAttribute('aria-pressed',String(show));reveal.setAttribute('aria-label',show?'הסתר סיסמה':'הצג סיסמה');};
 const toolbar=workspace.querySelector('.vp-workspace-toolbar'),actions=toolbar.querySelector('.actions');
 const voiceButton=actions.querySelector('[onclick="vendpayLoadVoice()"]'),logButton=actions.querySelector('[onclick="vendpayLoadLog()"]');
 const customers=workspace.querySelector('.vp-customer-section'),connection=workspace.querySelector('.vp-account-section'),voice=document.getElementById('vpVoicePanel'),log=document.getElementById('vpLogPanel');
 const payment=Array.from(workspace.children).find(n=>n.classList.contains('card')&&n.querySelector('[onclick="vendpayNedarimOpen()"]'));
 const shell=el('div','vp-shell'),rail=el('nav','vp-navigation'),main=el('div','vp-main');rail.setAttribute('aria-label','אזורי ניהול');
 const railTitle=el('p','vp-nav-caption','סביבת עבודה');rail.append(railTitle);
 const hero=el('div','vp-page-heading'),title=el('h3','','לקוחות ושלוחות'),subtitle=el('p','','מבט אחד על הלקוחות והחיבורים שלך');title.tabIndex=-1;hero.append(el('span','vp-eyebrow','ניהול שוטף'),title,subtitle);
 const overview=el('div','vp-overview');const metrics={};for(const [key,label] of [['total','לקוחות במערכת'],['active','לקוחות פעילים'],['connected','חיבורים תקינים']]){const box=el('div','vp-metric'),value=el('strong','','—');box.append(el('span','',label),value);metrics[key]=value;overview.append(box);}
 const customerView=el('section','vp-view');customerView.id='vpCustomersView';customerView.append(overview,customers);if(payment){payment.classList.add('vp-payment-card');customerView.append(payment);}
 const views={customers:customerView,connection,voice,log};const names={customers:['לקוחות ושלוחות','מבט אחד על הלקוחות והחיבורים שלך'],connection:['חיבור והגדרות','פרטי החשבון, הפעלת לקוח והגדרות השלוחות'],voice:['הודעות בקו','נוסח אחד, בכל החיבורים שבהם ההודעה מופיעה'],log:['יומן פעולות','חיפוש פעולות ותוצאות לפי לקוח ותאריך']};
 let current='customers';const buttons={};
 function show(key,focus=false){if(!views[key])return;current=key;for(const [name,node] of Object.entries(views)){node.classList.toggle('vp-view-off',name!==key);if(name===key)node.classList.remove('hidden');}for(const [name,button] of Object.entries(buttons)){if(name===key)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}title.textContent=names[key][0];subtitle.textContent=names[key][1];if(focus)title.focus({preventScroll:true});}
 for(const [key,label] of [['customers','לקוחות ושלוחות'],['connection','חיבור והגדרות'],['voice','הודעות בקו'],['log','יומן פעולות'],['pay','נדרים פלוס']]){const button=el('button','vp-nav-button');button.type='button';button.append(icon(key),el('span','',label));rail.append(button);buttons[key]=button;if(key!=='pay')button.setAttribute('aria-controls',views[key].id||(views[key].id='vpConnectionView'));button.onclick=()=>{if(key==='pay'){vendpayNedarimOpen();return;}show(key,true);if(key==='voice')voiceButton.click();if(key==='log')logButton.click();};}
 rail.append(el('div','vp-nav-footer','ניהול פשוט, בכל יום'));
 voiceButton.classList.add('vp-view-off');logButton.classList.add('vp-view-off');toolbar.querySelector('h3').remove();toolbar.classList.add('vp-utility-toolbar');
 main.append(hero,toolbar,...Object.values(views));shell.append(rail,main);workspace.append(shell);
 const newForm=customers.querySelector('.vp-new-customer'),newDetails=el('details','vp-new-details'),newSummary=el('summary','','+ הוספת לקוח חדש');newDetails.append(newSummary);newForm.before(newDetails);newDetails.append(newForm);customers.prepend(customers.querySelector('.vp-customer-list'));
 customers.addEventListener('click',e=>{if(e.target.closest('button')?.textContent==='ניהול וחיבור')show('connection');},true);
 const connectionHeading=connection.querySelector('h3');connectionHeading.textContent='החשבון של הלקוח';
 const voiceIntro=voice.querySelector('.msg');voiceIntro.textContent='שינוי נוסח נשמר בכל המופעים של אותה הודעה. בחרו שלוחה או חפשו הודעה כדי להגיע אליה במהירות. הוראות המקשים והפעולות נשארות קבועות.';
 function groupFields(parent,ids,cls){const wrap=el('div',cls);const first=document.getElementById(ids[0]);parent.insertBefore(wrap,parent.querySelector('label[for="'+ids[0]+'"]')||first);for(const id of ids){const field=document.getElementById(id),label=parent.querySelector('label[for="'+id+'"]'),box=el('div','vp-field');if(label)box.append(label);box.append(field);wrap.append(box);}}
 groupFields(voice,['vpVoiceSearch','vpVoiceSource'],'vp-filter-grid');groupFields(log,['vpLogTenant','vpLogKind','vpLogSince','vpLogUntil'],'vp-filter-grid vp-log-filters');
 const config=document.getElementById('vpConfigPanel');for(const area of Array.from(config.querySelectorAll('textarea'))){const label=config.querySelector('label[for="'+area.id+'"]'),details=el('details','vp-config-item'),summary=el('summary','',label.textContent),copy=el('button','light','העתק הגדרות');copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(area.value);copy.textContent='הועתק';}catch{area.focus();area.select();copy.textContent='הטקסט סומן — אפשר להעתיק';}setTimeout(()=>copy.textContent='העתק הגדרות',2500);};label.before(details);details.append(summary,label,area,copy);label.classList.add('vp-sr-only');}
 const status=document.getElementById('vendpayMessage');status.classList.add('vp-status-notice');
 function update(){const tenants=typeof vpTenants==='undefined'?[]:vpTenants;metrics.total.textContent=tenants.length;metrics.active.textContent=tenants.filter(t=>t.is_active).length;metrics.connected.textContent=tenants.filter(t=>t.connection_status==='connected').length;const rows=document.querySelectorAll('#vendpayCustomers tr[data-vp-search]');for(const row of rows){Array.from(row.cells).forEach((cell,i)=>cell.dataset.label=['לקוח','מספר זיהוי','פעילות','חיבור','בדיקה אחרונה','פרטי קשר','פעולות'][i]);if(row.cells[2])row.cells[2].dataset.state=row.cells[2].textContent==='פעיל'?'good':'muted';if(row.cells[3])row.cells[3].dataset.state=row.cells[3].textContent==='מחובר'?'good':'muted';}}
 new MutationObserver(update).observe(document.getElementById('vendpayCustomers'),{childList:true,subtree:true});
 new MutationObserver(()=>{if(workspace.classList.contains('hidden')){show('customers');newDetails.open=false;password.type='password';reveal.textContent='הצג';reveal.setAttribute('aria-pressed','false');}}).observe(workspace,{attributes:true,attributeFilter:['class']});
 show('customers');update();
})();


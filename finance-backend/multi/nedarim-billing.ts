import {db,rpc,profile,OWNER,normalizePhone}from './shared.ts';
import {provider}from './delivery-routes.ts';
const uuid=s=>/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(s||'');
export function providerDate(s){const m=/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/.exec(s);if(!m)throw Error('invalid_provider_date');const d=`${m[3]}-${m[2]}-${m[1]}`;if(new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw Error('invalid_provider_date');return d;}
export async function checkout(account,b){
 if(!uuid(b.service_id)||!Number.isInteger(b.revision)||b.consent!==true)throw Error('יש לאשר את סכום המנוי ותנאיו');
 const p=await profile(account);if(!p.phone)throw Error('יש לקשר מספר טלפון לחשבון לפני הרשמה');
 const check=await provider('nedarim_check');if(!check.ready)throw Error('חיבור נדרים או חתימת האימות עדיין לא הוגדרו');
 const c=await rpc('billing_nedarim_begin',{p_account:account,p_service:b.service_id,p_revision:b.revision,p_mosad:check.mosad});
 if(c.channel==='phone')throw Error('קיימת הרשמה בטלפון. בדקו את מצב המנוי או בטלו אותה לפני פתיחת הרשמה חדשה.');
 if(c.cancel_requested)throw Error('ביטול המנוי בטיפול');
 if(c.claimed){try{
  const d=await provider('nedarim_create',{checkout_id:c.id,amount:c.amount,name:p.display_name,phone:p.phone});
  if(d.mosad!==c.mosad)throw Error('הגדרות הסליקה השתנו');
  // A callback can precede this response. Never downgrade a bound checkout.
  await db('billing_nedarim_checkouts?id=eq.'+c.id,{transaction_id:d.transaction_id,transaction_key:d.key},'PATCH');
  await db('billing_nedarim_checkouts?id=eq.'+c.id+'&state=eq.creating',{state:'ready'},'PATCH');Object.assign(c,d,{state:'ready'});
 }catch(e){await db('billing_nedarim_checkouts?id=eq.'+c.id+'&state=eq.creating',{state:'unknown',last_error:'create_unconfirmed'},'PATCH');throw Error('פתיחת התשלום לא אושרה. אין לפתוח חיוב נוסף לפני בירור.');}}
 if(c.state==='bound')return {checkout_id:c.id,pending:true};
 if(c.state!=='ready')throw Error('פתיחת התשלום ממתינה לבירור');
 return {checkout_id:c.id,transaction_id:c.transaction_id,key:c.transaction_key||c.key,amount:c.amount};
}
export async function syncCheckout(c){
 if(!c.keva_id)return;
 const d=await provider('nedarim_details',{keva_id:c.keva_id});
 if(!matchesMandate(c,d))throw Error('mandate_mismatch');
 if(c.cancel_requested&&!['2','3'].includes(d.status)){
  const stopped=await provider('nedarim_cancel',{keva_id:c.keva_id});if(!stopped.cancelled)throw Error('cancel_pending');d.status='2';
 }
 const history=d.history.map(x=>({...x,date:providerDate(x.date)})).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.transaction_id)-Number(b.transaction_id));
 for(const h of history)await rpc('billing_nedarim_payment',{p_checkout:c.id,p_transaction:h.transaction_id,p_amount:h.amount,p_paid_on:h.date});
 if(['2','3'].includes(d.status)){
  await rpc('billing_manage',{p_account:c.account_id,p_action:'cancel',p_data:{service_id:c.service_id}});
  await db('billing_nedarim_checkouts?id=eq.'+c.id,{state:'cancelled',cancel_requested:true},'PATCH');
 }
 await db('billing_nedarim_checkouts?id=eq.'+c.id,{last_sync_at:new Date().toISOString(),last_error:null},'PATCH');
}
export async function cancel(account,service){
 if(!uuid(service))throw Error('שירות לא תקין');
 const rows=await db('billing_nedarim_checkouts?account_id=eq.'+account+'&service_id=eq.'+service+'&state=neq.cancelled');
 for(const c of rows){if(c.channel==='phone'&&await rpc('billing_nedarim_phone_abandon',{p_checkout:c.id,p_account:account}))continue;await db('billing_nedarim_checkouts?id=eq.'+c.id,{cancel_requested:true},'PATCH');c.cancel_requested=true;if(!c.keva_id)throw Error('בקשת הביטול נשמרה. ממתינים לאישור הקמת ההוראה כדי לוודא שגם הגבייה הופסקה.');await syncCheckout(c);}
 return rpc('billing_manage',{p_account:account,p_action:'cancel',p_data:{service_id:service}});
}
export async function checkoutStatus(account,b){
 if(!uuid(b.checkout_id))throw Error('בקשה לא תקינה');
 const c=(await db('billing_nedarim_checkouts?id=eq.'+b.checkout_id+'&account_id=eq.'+account))[0];if(!c)throw Error('לא נמצא');
 // Server-side cadence; repeated browser polling cannot trigger repeated provider calls.
 if(c.keva_id&&(!c.last_sync_at||Date.now()-Date.parse(c.last_sync_at)>60000)){
  const claim=await db('billing_nedarim_checkouts?id=eq.'+c.id+(c.last_sync_at?'&last_sync_at=eq.'+encodeURIComponent(c.last_sync_at):'&last_sync_at=is.null'),{last_sync_at:new Date().toISOString()},'PATCH');
  if(claim.length)try{await syncCheckout(c);}catch{await db('billing_nedarim_checkouts?id=eq.'+c.id,{last_error:'sync_failed'},'PATCH');}
 }
 const r=(await db('billing_subscriptions?id=eq.'+c.subscription_id+'&select=status,paid_until'))[0];return {checkout_id:c.id,status:r.status,paid_until:r.paid_until,mandate_received:!!c.keva_id,cancel_requested:c.cancel_requested};
}
export async function billingRoute(account,action,data={}){
 if(action==='admin_phone_setup'){if(account!==OWNER)throw Error('אין הרשאה');return provider('nedarim_phone_setup');}
 if(action==='admin_check'){if(account!==OWNER)throw Error('אין הרשאה');return provider('nedarim_check');}
 if(action==='checkout')return checkout(account,data);
 if(action==='checkout_status')return checkoutStatus(account,data);
 if(action==='cancel')return cancel(account,data.service_id);
 if(action==='access'){if(!/^[a-z0-9_-]{1,60}$/.test(data.service||''))throw Error('שירות לא תקין');return rpc('billing_access',{p_account:account,p_slug:data.service});}
 if(action==='service_save'&&account===OWNER&&data.payment_required){
  if(data.billing_mode!=='recurring'||data.interval_months!==1||data.trial_days!==0||data.first_amount!==data.renewal_amount)throw Error('נדרים מחובר למסלול חודשי בסכום קבוע, ללא תקופת ניסיון');
  const check=await provider('nedarim_check');if(!check.ready)throw Error('יש להשלים את הגדרות נדרים וחתימת Webhook');
  if(uuid(data.id))await db('billing_services?id=eq.'+data.id,{provider_ready:true},'PATCH');
 }
 return rpc('billing_manage',{p_account:account,p_action:action,p_data:data});
}

export function matchesMandate(c,d){return d.mosad===c.mosad&&d.currency==='1'&&(c.channel==='phone'?d.group==='finance-'+c.id&&normalizePhone(d.phone)===c.phone_context?.phone&&d.frequency==='1':d.note==='subscription '+c.id);}

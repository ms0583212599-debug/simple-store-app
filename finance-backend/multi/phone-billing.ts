import {db,rpc,billing,money,digest}from './shared.ts';
import {provider}from './delivery-routes.ts';
import {checkoutStatus}from './nedarim-billing.ts';
const clean=s=>String(s||'').replace(/[.=&<>\r\n]/g,' ');
export async function billingMenu(row,p){
 let s=row.state,seq=row.seq;const value=p.get('bill'+seq);
 const save=async next=>{const updated=await db('finance_entry_calls?id=eq.'+row.id+'&seq=eq.'+seq,{state:next,seq:seq+1},'PATCH');if(!updated.length)throw Error('הבקשה כבר טופלה יש לחזור לשלוחה');s=next;seq++;};
 const service=(await billing(row.account_id,'catalog')).services.find(x=>x.slug==='finance');
 if(!service)return 'id_list_message=t-השירות אינו פעיל';
 if(!s.stage.startsWith('billing_')){await save({stage:'billing_menu'});}
 else if(value!==null){try{
  if(value==='0')return 'hangup';
  if(s.stage==='billing_menu'){
   if(value==='1')await save({stage:'billing_consent',service_id:service.id,revision:service.revision,amount:service.first_amount});
   else if(value==='2'){
    const rows=await db('billing_nedarim_checkouts?account_id=eq.'+row.account_id+'&service_id=eq.'+service.id+'&state=neq.cancelled');
    for(const c of rows)await checkoutStatus(row.account_id,{checkout_id:c.id});
    const access=await rpc('billing_access',{p_account:row.account_id,p_slug:'finance'});
    await save({stage:'billing_menu',notice:access.allowed?'המנוי פעיל ניתן לחזור לשלוחה ולהשתמש בשירות':rows.length?'ההרשמה ממתינה לאישור או לחיוב ראשון אין להירשם שוב':'לא קיימת הרשמה בתהליך'});
   }else if(value==='3')await save({stage:'billing_cancel'});
   else throw Error('הבחירה אינה תקינה');
  }else if(s.stage==='billing_cancel'){
   if(value!=='1')await save({stage:'billing_menu'});
   else{await billing(row.account_id,'cancel',{service_id:service.id});await save({stage:'billing_menu',notice:'המנוי בוטל החיובים העתידיים הופסקו התקופה ששולמה נשמרת'});}
  }else if(s.stage==='billing_consent'){
   if(value!=='1'){await save({stage:'billing_menu'});}
   else{
    if(s.revision!==service.revision||s.service_id!==service.id)throw Error('המחיר השתנה יש לשמוע ולאשר מחדש');
    const check=await provider('nedarim_check');if(!check.ready||!check.phone_ready)throw Error('התשלום בטלפון עדיין לא הוגדר יש לפנות למנהל');
    const token=crypto.randomUUID().replace(/-/g,'')+crypto.randomUUID().replace(/-/g,'');
    const c=await rpc('billing_nedarim_phone_begin',{p_account:row.account_id,p_service:service.id,p_revision:s.revision,p_mosad:check.mosad,p_entry:row.id,p_extension:p.get('ApiExtension')||'/',p_token_hash:await digest(token)});
    // Persist the next prompt before external work. A replay cannot launch a second payment.
    await save({stage:'billing_menu',notice:'ההרשמה נפתחה לבדיקת המצב הקישו 2'});
    if(!c.claimed)throw Error('כבר קיימת הרשמה למנוי בדקו את המצב או בקשו ביטול');
    try{
     const prepared=await provider('nedarim_phone_prepare',{checkout_id:c.id,token,mosad:c.mosad});
     const ready=await db('billing_nedarim_checkouts?id=eq.'+c.id+'&state=eq.creating&cancel_requested=eq.false',{state:'ready'},'PATCH');
     if(!ready.length)throw Error('cancelled');
     return 'go_to_folder='+prepared.path;
    }catch{
     await rpc('billing_nedarim_phone_abandon',{p_checkout:c.id,p_account:row.account_id});
     throw Error('לא ניתן לפתוח את שלוחת התשלום ההרשמה בוטלה ניתן לנסות שוב');
    }
   }
  }
 }catch(e){await save({stage:'billing_menu',notice:e.message});}}
 const text=s.stage==='billing_consent'?'עלות המנוי '+money(s.amount)+' בכל חודש החל מההרשמה החיוב מתחדש אוטומטית עד לביטול ניתן לבטל בכל עת בטלפון או באתר הגישה תיפתח לאחר אישור החיוב הראשון לאישור תנאי המנוי והמשך להקשת אשראי הקישו 1 לחזרה הקישו 2':s.stage==='billing_cancel'?'לביטול המנוי והפסקת החיובים העתידיים הקישו 1 לחזרה ללא ביטול 2':'לשירות נדרש מנוי פעיל להרשמה 1 לבדיקת מצב ההרשמה 2 לביטול המנוי 3 ליציאה 0';
 return 'read=t-'+clean((s.notice||'')+' '+text)+'=bill'+seq+',,1,1,30,NO,no';
}

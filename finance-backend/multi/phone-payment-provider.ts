export const PAYMENT_URL='https://icldwmvkbeanyypkpeia.supabase.co/functions/v1/finance-payment-ivr';
export const paymentPath=id=>'/FinancePay'+id.replace(/-/g,'');
export const paymentGroup=id=>'finance-'+id;
export async function preparePhonePayment(c,b){
 if(b.mosad!==c.nedarim_mosad)throw Error('institution_changed');
 if(!c.voice_enabled||!c.yemot_token)throw Error('phone_not_configured');
 if(!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(b.checkout_id)||! /^[a-f0-9]{64}$/.test(b.token))throw Error('invalid_checkout');
 const path=paymentPath(b.checkout_id);
 const fields={token:c.yemot_token,path:'ivr2:'+path,type:'api',title:'הרשמה למנוי',api_link:PAYMENT_URL,api_url_post:'yes',api_hangup_send:'no',api_add_0:'checkout='+b.checkout_id,api_add_1:'payment_token='+b.token,credit_card_type:'nedarim_plus',credit_card_payment_type:'keva',credit_card_keva_tashloumim_amount:'none',credit_card_payment_tashloumim_keva_day:'today',credit_card_currency:'1',credit_card_terminal_number:c.nedarim_mosad,credit_card_category_nedarim_plus:paymentGroup(b.checkout_id),credit_card_enter_phone:'no',credit_card_menu_another_confirmation_number_hearing:'no'};
 const r=await fetch('https://www.call2all.co.il/ym/api/UpdateExtension',{method:'POST',body:new URLSearchParams(fields),redirect:'error',signal:AbortSignal.timeout(10000)}),d=await r.json();
 if(!r.ok||d.responseStatus!=='OK')throw Error('phone_setup_failed');
 // Inspect effective extension settings before letting the caller enter card collection.
 const check=await fetch('https://www.call2all.co.il/ym/api/GetIVR2Dir',{method:'POST',body:new URLSearchParams({token:c.yemot_token,path}),redirect:'error',signal:AbortSignal.timeout(8000)}),result=await check.json();
 if(!check.ok||result.responseStatus!=='OK'||Object.entries(fields).filter(([k])=>!['token','path'].includes(k)).some(([k,v])=>String(result.extIni?.[k])!==v))throw Error('phone_setup_unconfirmed');
 return {path};
}

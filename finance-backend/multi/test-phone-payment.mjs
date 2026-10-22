import assert from 'node:assert/strict';
import {preparePhonePayment,paymentPath,paymentGroup}from './phone-payment-provider.ts';
import {matchesMandate}from './nedarim-billing.ts';
import {digest}from './shared.ts';
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://db.test':''}};
const id='11111111-1111-4111-8111-111111111111',token='a'.repeat(64),phone='0501234567',call='phone-test-call',extension='/8',entry=await digest(call+':'+phone+':'+extension);
let fields;
globalThis.fetch=async(url,o)=>{if(url.endsWith('UpdateExtension')){fields=Object.fromEntries(o.body);return Response.json({responseStatus:'OK'});}if(url.endsWith('GetIVR2Dir'))return Response.json({responseStatus:'OK',extIni:fields});throw Error(url);};
const cfg={voice_enabled:true,yemot_token:'test-yemot',nedarim_mosad:'1234567'};
assert.equal((await preparePhonePayment(cfg,{checkout_id:id,token,mosad:'1234567'})).path,paymentPath(id));
assert.equal(fields.type,'api');assert.equal(fields.credit_card_payment_type,'keva');assert.equal(fields.credit_card_keva_tashloumim_amount,'none');assert.equal(fields.credit_card_category_nedarim_plus,paymentGroup(id));assert.equal(fields.credit_card_enter_phone,'no');
await assert.rejects(()=>preparePhonePayment(cfg,{checkout_id:id,token,mosad:'7654321'}));
const c={id,account_id:'owner-a',subscription_id:'subscription-a',state:'ready',channel:'phone',amount:300,mosad:'1234567',phone_context:{entry,extension,phone,token_hash:await digest(token)}};
const details={mosad:c.mosad,currency:'1',amount:300,group:paymentGroup(id),phone,frequency:'1'};
assert.equal(matchesMandate(c,details),true);for(const patch of [{phone:'0507654321'},{mosad:'7654321'},{currency:'2'},{group:paymentGroup(crypto.randomUUID())},{frequency:'2'}])assert.equal(matchesMandate(c,{...details,...patch}),false);
let issues=0,bindings=0,payments=0,verified=true;
globalThis.fetch=async(url,o={})=>{const u=new URL(url),b=o.body?JSON.parse(o.body):null;let d;
 if(url.includes('finance_integrations'))d=[{bridge_url:'https://bridge.test',bridge_secret:'test-secret'}];
 else if(url==='https://bridge.test'){if(b.action==='nedarim_verify')d={valid:verified,mosad:'1234567'};else if(b.action==='nedarim_details')d=details;else throw Error(b.action);}
 else if(u.pathname.includes('billing_nedarim_checkouts')){if(!b)d=[c];else{Object.assign(c,b);d=[c];}}
 else if(url.endsWith('billing_nedarim_phone_issue')){issues++;if(c.phone_issued_at)d={issued:false};else{c.phone_issued_at=new Date().toISOString();d={issued:true,amount:300,mosad:c.mosad};}}
 else if(url.endsWith('billing_nedarim_bind')){bindings++;d={};}
 else if(url.endsWith('billing_nedarim_payment')){payments++;d={};}
 else if(u.pathname.includes('billing_subscriptions'))d=[{status:'pending',paid_until:null}];
 else throw Error(url);return Response.json(d);
};
const {handler}=await import('./phone-payment.ts');
const params=new URLSearchParams({checkout:id,payment_token:token,ApiPhone:phone,ApiCallId:call,ApiExtension:paymentPath(id)});
const send=async p=>await(await handler(new Request('https://ivr.test',{method:'POST',body:p}))).text();
const wrong=new URLSearchParams(params);wrong.set('ApiPhone','0507654321');assert.equal(await send(wrong),'');assert.equal(issues,0);
const wrongCall=new URLSearchParams(params);wrongCall.set('ApiCallId','another-call');assert.equal(await send(wrongCall),'');
const duplicate=new URLSearchParams(params);duplicate.append('checkout',id);assert.equal(await send(duplicate),'');
assert.match(await send(params),/^credit_card=nedarim_plus,3.00,/);assert.equal(issues,1);
assert.match(await send(params),/go_to_folder=\/8/);assert.equal(issues,1);
params.set('CreditCard_CODE','OK');assert.match(await send(params),/go_to_folder=\/8/);assert.equal(bindings,0);assert.equal(payments,0);
const {handler:hook}=await import('./nedarim-webhook.ts');
const notify=()=>hook(new Request('https://hook.test',{method:'POST',body:JSON.stringify({Groupe:paymentGroup(id),KevaId:'123',MosadNumber:'1234567'})}));
assert.equal((await notify()).status,200);assert.equal(bindings,1);assert.equal(payments,0);
verified=false;assert.equal((await notify()).status,401);assert.equal(bindings,1);
verified=true;details.phone='0507654321';assert.equal((await notify()).status,400);assert.equal(bindings,1);
console.log('PASS: native HK config, institution guard, account/call/token binding, single issuance, replay blocking, untrusted success ignored, signed callback correlation and mismatch rejection');

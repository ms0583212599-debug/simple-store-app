import assert from 'node:assert/strict';
globalThis.Deno={env:{get:k=>k==='SUPABASE_SERVICE_ROLE_KEY'?'test-secret-key':k==='SUPABASE_URL'?'https://store.test':''}};
let owner=true,writes=0,conf={revision:0},saved;
globalThis.fetch=async()=>Response.json({id:owner?'56ae10cb-f40c-4a41-8112-ab8c9f1616c8':'other'});
const {settings,unseal}=await import('./provider-settings.ts');
const db=async(path,b)=>{writes++;saved=b;return [b];};
const data={revision:0,use_store_mail:false,nedarim_mosad:'1234567',nedarim_group:'finance',nedarim_api_valid:'private-valid',nedarim_api_password:'private-api',yemot_token:'private-yemot-test',resend_key:'re_private_test',from_email:'reports@example.org',voice_enabled:true,mail_enabled:true};
assert.equal((await settings({action:'settings_save',data},conf,db)).error,'unauthorized');assert.equal(writes,0);
owner=false;assert.equal((await settings({action:'settings_save',owner_token:'test',data},conf,db)).error,'unauthorized');assert.equal(writes,0);owner=true;
let d=await settings({action:'settings_save',owner_token:'test',data},conf,db);assert.equal(d.saved,true);assert.equal(d.nedarim_mosad,'1234567');assert.equal(d.nedarim_api_password_configured,true);assert.ok(!JSON.stringify(d).includes('private-api'));assert.ok(!saved.settings_ciphertext.includes('private-api'));assert.equal(d.revision,1);assert.equal(d.yemot_configured,true);assert.ok(!JSON.stringify(d).includes(data.yemot_token));assert.ok(!saved.settings_ciphertext.includes(data.resend_key));assert.equal((await unseal(saved.settings_ciphertext)).yemot_token,data.yemot_token);
conf={...conf,...saved};d=await settings({action:'settings_save',owner_token:'test',data},conf,db);assert.ok(d.error);assert.equal(writes,1);
d=await settings({action:'settings_save',owner_token:'test',data:{...data,revision:1,yemot_token:'',resend_key:'',voice_enabled:false}},conf,db);assert.equal(d.voice_enabled,false);assert.equal((await unseal(saved.settings_ciphertext)).yemot_token,data.yemot_token);assert.equal(writes,2);
console.log('PASS: owner-only settings, encrypted storage, redacted responses, optimistic revision, blank secrets preserved, disable switch');

const {effective}=await import('./provider-settings.ts');
const env=Deno.env.get;
Deno.env.get=k=>k==='RESEND_API_KEY'?'store-test-key':k==='FEEDBACK_FROM_EMAIL'?'Store <reports@example.org>':env(k);
const shared=effective({resend_key:'invalid-custom',from_email:'wrong@example.net'});
assert.equal(shared.resend_key,'store-test-key');assert.equal(shared.from_email,'reports@example.org');assert.equal(shared.use_store_mail,true);
assert.equal(effective({use_store_mail:false,resend_key:'custom',from_email:'custom@example.org'}).resend_key,'custom');
Deno.env.get=k=>k==='RESEND_API_KEY'?'store-test-key':env(k);
assert.equal(effective({}).from_email,'onboarding@resend.dev');
console.log('PASS: store mail reuse, stale custom credentials ignored, display-name sender normalized, explicit custom option, restricted sender identified');

Deno.env.get=env;
globalThis.fetch=async url=>String(url).includes('api.resend.com')?Response.json({name:'restricted_api_key',message:'This API key is restricted to only send emails'},{status:401}):Response.json({id:'56ae10cb-f40c-4a41-8112-ab8c9f1616c8'});
const checked=await settings({action:'settings_check',owner_token:'test'},conf,db);
assert.match(checked.mail,/מפתח לשליחה בלבד/);
console.log('PASS: sending-only API key is not misclassified as invalid');

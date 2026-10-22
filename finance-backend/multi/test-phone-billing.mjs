import assert from 'node:assert/strict';
import {billingMenu}from './phone-billing.ts';
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://db.test':''}};
const row={id:'entry',account_id:'account-a',seq:0,state:{stage:'complete'}},p=new URLSearchParams({ApiExtension:'/8'}),service={id:'11111111-1111-4111-8111-111111111111',slug:'finance',revision:1,first_amount:300};
let created=0,prepare=0,cancelled=0,claimed=true,abandoned=0,failPrepare=false;
globalThis.fetch=async(url,o={})=>{const b=o.body?JSON.parse(o.body):null;let d;
 if(url.includes('finance_entry_calls')){const expected=Number(new URL(url).searchParams.get('seq').slice(3));if(expected!==row.seq)d=[];else{Object.assign(row,b);d=[row];}}
 else if(url.endsWith('billing_manage')){if(b.p_action==='catalog')d={services:[service]};else if(b.p_action==='cancel'){cancelled++;d={};}else throw Error(b.p_action);}
 else if(url.includes('finance_integrations'))d=[{bridge_url:'https://bridge.test',bridge_secret:'test'}];
 else if(url==='https://bridge.test'){if(b.action==='nedarim_check')d={ready:true,phone_ready:true,mosad:'1234567'};else if(b.action==='nedarim_phone_prepare'){prepare++;if(failPrepare)return Response.json({error:'failure'},{status:500});d={path:'/FinancePaytest'};}else throw Error(b.action);}
 else if(url.endsWith('billing_nedarim_phone_begin')){created++;assert.equal(b.p_account,'account-a');assert.equal(b.p_revision,1);d={id:service.id,mosad:'1234567',claimed};}
 else if(url.endsWith('billing_nedarim_phone_abandon')){abandoned++;d=true;}
 else if(url.includes('billing_nedarim_checkouts'))d=b?[{state:'ready'}]:[];
 else throw Error(url);return Response.json(d);
};
const send=async v=>{if(v!==undefined)p.set('bill'+row.seq,v);return billingMenu(row,p);};
assert.match(await send(),/להרשמה 1/);assert.equal(created,0);
assert.match(await send('1'),/3 שקלים בכל חודש/);assert.equal(created,0);
assert.equal(await send('1'),'go_to_folder=/FinancePaytest');assert.equal(created,1);assert.equal(prepare,1);
assert.match(await send(),/בדיקת מצב/);assert.equal(created,1);
await send('1');service.revision=2;assert.match(await send('1'),/המחיר השתנה/);assert.equal(created,1);service.revision=1;
await send('3');assert.equal(cancelled,0);assert.match(await send('1'),/המנוי בוטל/);assert.equal(cancelled,1);
claimed=false;await send('1');assert.match(await send('1'),/כבר קיימת הרשמה/);assert.equal(prepare,1);
claimed=true;failPrepare=true;await send('1');assert.match(await send('1'),/ההרשמה בוטלה/);assert.equal(abandoned,1);
console.log('PASS: consent before enrollment, revision enforcement, duplicate navigation, explicit cancellation, existing checkout reuse and safe recovery before card collection');

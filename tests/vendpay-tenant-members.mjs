import {AsyncLocalStorage} from 'node:async_hooks';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const root='supabase/functions/vendpay-tenant-members/';
const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
const secret='x'.repeat(64),credentials=new Map(),records=new Map(),users=new Map(ids.map(id=>[id,[]]));
let active=true,writes=0,unknown=false,authCalls=0;
for(const id of ids){const key=await crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)),'AES-GCM',false,['encrypt']);const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(JSON.stringify({username:id,password:'fixture-password',code:'fixture-code'})));credentials.set(id,{iv:Buffer.from(iv).toString('base64'),ciphertext:Buffer.from(cipher).toString('base64')});}
const client={from(table){let id;return {select(){return this},eq(k,v){id=v;return this},async maybeSingle(){return {data:table==='vendpay_tenants'?{id,is_active:active}:credentials.get(id)}}}}};
const fakeFetch=async(url,options={})=>{
 const u=new URL(url),method=options.method||'GET';
 if(u.pathname.endsWith('/vendpay_voice_overrides'))return Response.json([{message_id:'v_0b572e50673ee2ff6c07',text:'בחשבון יש {ערך_1} לקוחות'}]);
 if(u.pathname.endsWith('/vendpay_operation_log'))return new Response(null,{status:201});
 if(u.pathname.includes('/rest/v1/')){
  const tenant=u.searchParams.get('tenant_id')?.slice(3);assert.ok(ids.includes(tenant),'every database access scoped to tenant');
  const table=u.pathname.split('/').at(-1);const key=table+'|'+tenant;let rows=records.get(key)||[];
  const matches=row=>[...u.searchParams].every(([k,v])=>['select','limit','tenant_id'].includes(k)||v.startsWith('eq.')&&String(row[k])===v.slice(3)||v.startsWith('gte.')&&row[k]>=v.slice(4));
  if(method==='GET')return Response.json(rows.filter(matches));
  const body=JSON.parse(options.body);
  if(method==='POST'){
   assert.equal(body.tenant_id,tenant);if(rows.some(r=>r.call_hash===body.call_hash||body.card_hash&&r.card_hash===body.card_hash))return new Response('',{status:409});
   const row={status:'editing',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+1800000).toISOString(),...body};rows.push(row);records.set(key,rows);return Response.json([row]);
  }
  assert.equal(method,'PATCH');const found=rows.filter(matches);found.forEach(r=>Object.assign(r,body));return Response.json(found);
 }
 assert.ok(!u.pathname.includes('setTerminalGateStatus'),'member flow never opens doors');
 if(u.pathname.endsWith('/authenticate')){authCalls++;const p=JSON.parse(options.body);assert.equal(p.password,'fixture-password');return Response.json({token:p.username})}
 const tenant=options.headers.Authorization.slice(7);assert.ok(ids.includes(tenant));
 if(u.pathname.endsWith('/restrict_group'))return Response.json([{id:tenant===ids[0]?12:25,title:'קבוצת בדיקה',is_active:1},{id:6,title:'לא פעיל',is_active:0}]);
 assert.ok(u.pathname.endsWith('/user'));
 if(method==='GET')return Response.json(users.get(tenant));
 writes++;if(unknown)throw Error('timeout');const p=JSON.parse(options.body);
 if(method==='POST')users.get(tenant).push({...p,id:188,created_by:68,created_on:'2026-10-20T00:00:00Z'});
 else{assert.equal(method,'PUT');assert.equal(p.cash_delta,2000);assert.equal(p.cash_do_mode,2);const row=users.get(tenant).find(x=>x.id===p.id);Object.assign(row,p,{card_value:p.cash_delta});}
 return Response.json({ok:true});
};
const context=vm.createContext({crypto,TextEncoder,TextDecoder,Uint8Array,Response,Request,Headers,URL,URLSearchParams,AbortSignal,atob,btoa,console,fetch:fakeFetch,Deno:{env:{get:k=>k==='VENDPAY_TENANT_ENCRYPTION_KEY'?secret:k==='SUPABASE_URL'?'https://fixture.invalid':'test'},serve:()=>{}}});
const cache=new Map();async function module(name){if(cache.has(name))return cache.get(name);let m;if(name==='node:async_hooks'){m=new vm.SyntheticModule(['AsyncLocalStorage'],function(){this.setExport('AsyncLocalStorage',AsyncLocalStorage)},{context});}else if(name.startsWith('npm:')){m=new vm.SyntheticModule(['createClient'],function(){this.setExport('createClient',()=>client)},{context});}else{m=new vm.SourceTextModule(stripTypeScriptTypes(fs.readFileSync(root+name,'utf8')),{context,identifier:name});}cache.set(name,m);return m;}
const main=await module('index.ts');await main.link(s=>module(s.replace('./','')));await main.evaluate();const {handler,managementKey,groupList}=main.namespace;
const keys=new Map();for(const id of ids)keys.set(id,await managementKey(id));
const req=(id,action,extra={})=>new Request('https://fixture.invalid',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({tenant_id:id,tenant_key:keys.get(id),action,ApiCallId:'same-call',ApiDID:'test',...extra})});
assert.equal((await handler(req(ids[0],'create',{tenant_key:keys.get(ids[1])}))).status,401);assert.equal(authCalls,0);
active=false;await handler(req(ids[0],'create'));assert.equal(authCalls,0);active=true;
await handler(req(ids[0],'create',{hangup:'yes'}));assert.equal(authCalls,0);
assert.throws(()=>groupList([{id:1,title:'x',is_active:0}]));
const create={admin_0_fname:'משה',admin_0_lname:'בדיקה',admin_0_names_ok:'1',pel:'0500000000',card_number:'455',amount:'20',date_end:'11112027',extras:'2'};
let r=await handler(req(ids[0],'create',create));assert.match(await r.text(),/12/);assert.equal(writes,0);
r=await handler(req(ids[0],'create',{...create,restrict_id:'25',save_confirm:'1'}));assert.equal(writes,0);
r=await handler(req(ids[0],'create',{...create,restrict_id:'12'}));assert.match(await r.text(),/save_confirm/);assert.equal(writes,0);
await Promise.all(ids.map((id,i)=>handler(req(id,'create',{...create,restrict_id:i?'25':'12',save_confirm:'1'}))));assert.equal(writes,2);assert.equal(users.get(ids[0]).length,1);assert.equal(users.get(ids[1]).length,1);
r=await handler(req(ids[0],'create',{...create,restrict_id:'12',save_confirm:'1'}));assert.match(await r.text(),/נוסף בהצלחה/);assert.equal(writes,2);
// Separate tenants, same call/card/user IDs; preserve balance and original fields.
for(const id of ids){r=await handler(req(id,'edit',{lookup_card:'455'}));assert.match(await r.text(),/edit_mode/);}
r=await handler(req(ids[0],'edit',{lookup_card:'455',edit_mode:'1'}));assert.match(await r.text(),/expiry_choice/);
r=await handler(req(ids[0],'edit',{lookup_card:'455',edit_mode:'3'}));assert.match(await r.text(),/edit_save/);assert.equal(writes,2);
r=await handler(req(ids[0],'edit',{lookup_card:'455',edit_mode:'3',edit_save:'1'}));assert.match(await r.text(),/עודכנו בהצלחה/);assert.equal(writes,3);assert.equal(users.get(ids[0])[0].card_value,2000);assert.notEqual(users.get(ids[0])[0].date_end,users.get(ids[1])[0].date_end);
await handler(req(ids[0],'edit',{lookup_card:'455',edit_mode:'3',edit_save:'1'}));assert.equal(writes,3);
// Unknown create response must never be resent, even with later requests.
unknown=true;const uncertain={...create,ApiCallId:'unknown',card_number:'999',restrict_id:'12',save_confirm:'1'};
await handler(req(ids[0],'create',uncertain));await handler(req(ids[0],'create',uncertain));assert.equal(writes,4);
console.log('PASS: real tenant auth/decryption; cross-tenant key denied; inactive/hangup; account groups; explicit confirmation; concurrent same IDs isolated; create/edit readback; balance preserved; next Hebrew month; replay/timeout protection; no door requests');
const writesBeforeSummary=writes;
r=await handler(req(ids[0],'summary'));assert.match(await r.text(),/summary_0/);
r=await handler(req(ids[0],'summary',{summary_0:'1'}));assert.match(await r.text(),/מספר הלקוחות הכולל 1/);assert.equal(writes,writesBeforeSummary);
console.log('PASS tenant summary authenticated read only, no writes');

const wrapped=cache.get('voice.ts').namespace.withVoice(handler,'vendpay-tenant-members');r=await wrapped(req(ids[0],'summary',{summary_0:'1'}));assert.match(await r.text(),/בחשבון יש 1 לקוחות/);assert.equal(writes,writesBeforeSummary);console.log('PASS authenticated summary uses saved voice override without data writes');

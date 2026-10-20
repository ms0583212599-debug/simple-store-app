import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const source=fs.readFileSync('supabase/functions/vendpay-tenants-admin/index.ts','utf8').replace(/import \{ createClient \} from [^;]+;/,'');
let handler,stored,fetches=0,payload,checkError=false,terminalTimeout=false;
const tenant='885c7813-a000-4a56-9f9c-17b5ae47927e';
const client={auth:{getUser:async()=>({data:{user:{id:'56ae10cb-f40c-4a41-8112-ab8c9f1616c8'}}})},from(table){return {select(){return this},eq(){return this},async maybeSingle(){return {data:table==='vendpay_tenants'?{id:tenant,connection_status:'connected',last_checked_at:new Date().toISOString(),discovered_terminals:[{terminal_id:7,description:'Test door'}]}:stored}},async upsert(row){stored=row;return {}},update(){return this},then(resolve){resolve({})},async insert(){return {}}}}};
const context={crypto,TextEncoder,TextDecoder,Uint8Array,Response,Request,URL,AbortSignal,atob,btoa,console,createClient:()=>client,Deno:{env:{get:k=>k==='VENDPAY_TENANT_ENCRYPTION_KEY'?'x'.repeat(64):'test'},serve:fn=>handler=fn},fetch:async(url,options)=>{fetches++;if(url.includes('authenticate')){payload=JSON.parse(options.body);return Response.json({token:'test-token-'.repeat(4)})}if(url.includes('/terminal?')&&terminalTimeout)throw Error('timeout');if(url.includes('/terminal?'))return Response.json([{terminal_id:7,description:'Test door'}]);return Response.json(checkError?{success:false}:{ok:true})}};
vm.runInNewContext(stripTypeScriptTypes(source),context);
const request=(action,body)=>new Request('https://example.test/?action='+action,{method:'POST',headers:{origin:'https://simple-store-app-ms0583212599-1490s-projects.vercel.app',authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify(body)});
let r=await handler(request('save_credentials',{tenant_id:tenant,username:'test@example.invalid',password:'test-password',code:'test-code'}));assert.equal(r.status,200);assert.ok(!stored.ciphertext.includes('test-password'));
r=await handler(request('check_connection',{tenant_id:tenant}));assert.equal((await r.json()).connected,true);assert.deepEqual(payload,{username:'test@example.invalid',password:'test-password',code:'test-code',rememberMe:false,role:''});
checkError=true;r=await handler(request('check_connection',{tenant_id:tenant}));assert.equal((await r.json()).connected,false);
r=await handler(request('save_credentials',{tenant_id:tenant,username:'x',password:'x',code:123}));assert.equal(r.status,400);
const denied=new Request('https://example.test',{method:'POST',headers:{origin:'https://untrusted.invalid'}});r=await handler(denied);assert.equal(r.status,403);
const html=fs.readFileSync('index.html','utf8');for(const block of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);assert.ok(html.includes('vpCredentialCode'));
console.log('PASS: encrypted full login payload, actual login request, application-error rejection, invalid input, origin gate, frontend syntax');

r=await handler(request('save_credentials',{tenant_id:tenant,username:'test@example.invalid',password:'test-password'}));assert.equal(r.status,200);
checkError=false;r=await handler(request('check_connection',{tenant_id:tenant}));const discovered=await r.json();assert.equal(discovered.connected,true);assert.equal(payload.code,'3464409e');assert.deepEqual(discovered.terminals,[{terminal_id:7,description:'Test door'}]);
r=await handler(request('set_active',{tenant_id:tenant,active:true,terminal_id:99,gate_status:2}));assert.equal(r.status,400);
r=await handler(request('set_active',{tenant_id:tenant,active:true,terminal_id:7,gate_status:1}));assert.equal(r.status,400);
r=await handler(request('set_active',{tenant_id:tenant,active:true,terminal_id:7,gate_status:2}));assert.equal(r.status,200);
console.log('PASS: public login default, discovered terminals, reject unlisted terminal and continuous-open command');

terminalTimeout=true;r=await handler(request("check_connection",{tenant_id:tenant}));assert.equal((await r.json()).connected,false);console.log("PASS terminal timeout cannot report connected");

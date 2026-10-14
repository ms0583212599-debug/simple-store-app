const fs=require('fs'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
(async()=>{
let src=fs.readFileSync('supabase/functions/customer-feedback-email/index.ts','utf8').replace(/^import .*;\n/gm,'').replace(/Deno\.serve\(req=>handle\(req\)\);/,'');
const {handle}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(src)).toString('base64'));
let messages=new Map(),claimed=new Set(),sent=[],dispatch=[],fail=false,email='manager@example.test';
const sb={from(table){let id,insert,update;const q={select(){return q},eq(k,v){id=v;return q},gte(){return q},order(){return q},limit(){return Promise.resolve({data:[]})},maybeSingle(){return Promise.resolve({data:messages.get(id)||null})},single(){return Promise.resolve({data:{feedback_email:email}})},insert(v){insert=v;return q},update(v){update=v;return q},then(resolve,reject){try{if(insert)messages.set(insert.id,insert);if(update){dispatch.push(update);if(update.state==='pending')claimed.delete(id)}resolve({error:null})}catch(e){reject(e)}}};return q},async rpc(name,{p_id}){if(claimed.has(p_id))return{data:false};claimed.add(p_id);return{data:true}}};
const fetcher=async(url,opts)=>{sent.push({url,...opts,body:JSON.parse(opts.body)});return {ok:!fail}};
const invoke=async b=>{let response=await handle(new Request('https://fixture.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),k=>k==='RESEND_API_KEY'?'synthetic':k==='FEEDBACK_FROM_EMAIL'?'Store <store@example.test>':'fixture',fetcher,()=>sb);return {status:response.status,body:await response.json()}};
const id='11111111-1111-4111-8111-111111111111';let r=await invoke({request_id:id,message:'מוצר חסר',to:'attacker@example.test'});assert.equal(r.body.saved,true);assert.equal(r.body.email,true);assert.deepEqual(sent[0].body.to,[email]);assert.equal(sent[0].headers['Idempotency-Key'],'store-feedback-'+id);assert.equal(messages.size,1);
await invoke({request_id:id,message:'מוצר חסר'});assert.equal(sent.length,1);assert.equal(messages.size,1);
r=await invoke({request_id:id,message:'אחר'});assert.equal(r.status,409);
r=await invoke({message:'x'});assert.equal(r.status,400);
fail=true;const second='22222222-2222-4222-8222-222222222222';r=await invoke({request_id:second,message:'בקשה שנייה'});assert.equal(r.body.saved,true);assert.equal(r.body.email,false);assert.equal(dispatch.at(-1).state,'pending');fail=false;r=await invoke({request_id:second,message:'בקשה שנייה'});assert.equal(r.body.email,true);assert.equal(messages.size,2);
email='';r=await invoke({request_id:'33333333-3333-4333-8333-333333333333',message:'בלי מייל'});assert.equal(r.body.saved,true);assert.equal(r.body.email,false);
console.log('PASS: feedback saved, server-only recipient, retry idempotency, conflicting request rejected, invalid message rejected, provider failure preserves message and retry, disabled mail. No network calls or real mail.');
})().catch(e=>{console.error(e);process.exit(1)});

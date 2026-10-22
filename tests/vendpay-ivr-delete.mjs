import assert from 'node:assert/strict';
for(const slug of ['vendpay-tenant-members','vendpay-admin-edit']){
 const {deleteSession}=await import('../supabase/functions/'+slug+'/delete.ts');const {PUT_FIELDS}=await import('../supabase/functions/'+slug+'/edit.ts');
 const base=Object.fromEntries(PUT_FIELDS.map(k=>[k,'']));Object.assign(base,{id:101,card_number:123,fname:'משה',lname:'כהן',card_value:0});
 let session,users,calls,timeout,conflict;
 const reset=()=>{session={operation:'edit',status:'editing',user_id:101,baseline:{...base},created_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()};users=[{...base}];calls=0;timeout=false;conflict=false;};reset();
 const deps={active:true,reply:(text,result)=>({text,result}),rows:async r=>r.json(),token:async()=> 'fixture',list:async()=>users,db:async(method,q,body)=>{assert.equal(method,'PATCH');if(q.includes('status=eq.editing')&&session.status!=='editing')return Response.json([]);Object.assign(session,body);return Response.json([session]);}};
 globalThis.fetch=async(url,opt)=>{assert.equal(url,'https://vendpay24.com/VendPayDeltaHeb/user/101?lang=heb&apiloc=VendPayDeltaHeb');assert.equal(opt.method,'DELETE');calls++;if(timeout)throw Error('timeout');users=[];return new Response(null,{status:204});};
 const run=p=>deleteSession(new URLSearchParams(p),session,'fixturehash',deps);
 assert.equal((await run({})).result,'prompt');assert.equal(calls,0);
 assert.equal((await run({delete_confirm:'1'})).result,'prompt');assert.equal(calls,0);
 let r=await run({delete_confirm:'1',delete_card:'999'});assert(r.text.includes('delete_card_retry_1'));assert.equal(calls,0);
 r=await run({delete_confirm:'1',delete_card:'123'});assert.equal(r.result,'deleted');assert.equal(calls,1);assert.equal(session.status,'confirmed');assert.equal((await run({})).result,'deleted');assert.equal(calls,1);
 reset();assert.equal((await run({delete_confirm:'0'})).result,'cancelled');assert.equal(calls,0);
 reset();users[0].card_value=500;assert.equal((await run({delete_confirm:'1',delete_card:'123'})).result,'conflict');assert.equal(calls,0);
 reset();timeout=true;assert.equal((await run({delete_confirm:'1',delete_card:'123'})).result,'uncertain');assert.equal(calls,1);assert.equal((await run({delete_confirm:'1',delete_card:'123'})).result,'uncertain');assert.equal(calls,1);users=[];assert.equal((await run({})).result,'deleted');assert.equal(calls,1);
 reset();deps.active=false;assert.equal((await run({delete_confirm:'1',delete_card:'123'})).result,'disabled');assert.equal(calls,0);
 console.log('PASS',slug,'double confirmation, wrong card retry, cancellation, concurrent change, one DELETE, timeout reconciliation, disabled writes');
}

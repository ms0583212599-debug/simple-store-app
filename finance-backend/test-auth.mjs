import assert from 'node:assert/strict';
globalThis.Deno={env:{get:()=>''},serve:()=>{}};
const {handler}=await import('../finance-dashboard-api.ts');let user={id:'other'},db=0;
globalThis.fetch=async(url,opts)=>{if(url.endsWith('/auth/v1/user'))return Response.json(user);db++;return Response.json({rows:[]});};
async function req(token='test',origin='https://simple-store-app-ms0583212599-1490s-projects.vercel.app',action='read',body={mode:'categories'}){return handler(new Request('https://test/?action='+action,{method:'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)}));}
assert.equal((await req('')).status,401);assert.equal((await req('test','https://invalid.example')).status,403);assert.equal((await req()).status,403);assert.equal(db,0);
user={id:'56ae10cb-f40c-4a41-8112-ab8c9f1616c8',is_anonymous:true};assert.equal((await req()).status,403);assert.equal(db,0);user.is_anonymous=false;assert.equal((await req()).status,200);assert.equal(db,1);
assert.equal((await req('test',undefined,'manage',{action:'unknown',data:{},request_id:'1234567890123456'})).status,400);assert.equal(db,1);
assert.equal((await req('test',undefined,'manage',{action:'transaction_save',data:{},request_id:'1234567890123456'})).status,200);assert.equal(db,2);
console.log('PASS: authentication, owner restriction, anonymous rejection, CORS, manage allowlist');

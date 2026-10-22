import assert from 'node:assert/strict';
const originalDigest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(algorithm,data)=>{if(new TextDecoder().decode(data)==='local-test-only')return Uint8Array.from(Buffer.from('12ccca974400e26882199733fa1ebdc6b3654e62ec08fd1f04f47d9e5558ec02','hex')).buffer;return originalDigest(algorithm,data);};
globalThis.Deno={env:{get:()=>''}};
let calls=new Map(),writes=new Map(),attempts=0,failAfterSave=false;
const cats=[{id:4,kind:'expense',active:true,name:'מזון',dial_code:'1'},{id:1,kind:'income',active:true,name:'משכורת',dial_code:'1'}];
globalThis.fetch=async(url,opts)=>{const a=JSON.parse(opts.body);let d;const method=url.split('/').at(-1);if(method==='finance_call'){let r=calls.get(a.p_id);if(a.p_state){if(a.p_seq===-1&&!r){r={id:a.p_id,seq:0,state:a.p_state,response:a.p_response};calls.set(a.p_id,r);}else if(r&&r.seq===a.p_seq){r={id:a.p_id,seq:r.seq+1,state:a.p_state,response:a.p_response};calls.set(a.p_id,r);}}d=r||null;}else if(method==='finance_read'){d=a.p_data.mode==='categories'?{rows:cats}:{rows:[],income:0,expense:0,planned_income:0,planned_expense:0,by_category:[],budgets:[]};}else if(method==='finance_manage'){attempts++;if(!writes.has(a.p_request))writes.set(a.p_request,a);if(failAfterSave){failAfterSave=false;throw Error('timeout');}d={id:12};}else throw Error(method);return new Response(JSON.stringify(d),{status:200});};
const {handler,advance}=await import('./ivr.ts');const key='local-test-only';
const p=new URLSearchParams({finance_key:key,ApiCallId:'test-call-123456',ApiExtension:'3/4/9'});let out;
async function send(v){if(v!==undefined){const q=out.match(/=(z\d+),,/)[1];p.set(q,String(v));}out=await(await handler(new Request('https://test/?'+p))).text();return out;}
await send();assert.match(out,/חודשיות 1/);
for(const v of ['1','1','3','1','123','45','1','1','1','2','1'])await send(v);
assert.match(out,/לאישור ושמירה/);assert.equal(writes.size,0);failAfterSave=true;await send('1');assert.match(out,/timeout/);assert.equal(writes.size,1);await send('1');assert.match(out,/נשמרו בהצלחה/);assert.equal(writes.size,1);assert.equal(attempts,2);await send();assert.equal(writes.size,1);
await send('9');assert.match(out,/go_to_folder/);for(const k of [...p.keys()])if(/^z\d+$/.test(k))p.delete(k);await send();assert.match(out,/חודשיות 1/);
const a=[...writes.values()][0];assert.equal(a.p_data.flow_type,'annual');assert.equal(a.p_data.amount_agorot,12345);assert.equal(a.p_data.category_id,4);
let s=await advance({stage:'main'},'2',cats,'request-123456789');assert.equal(s.stage,'fixed');s=await advance(s,'1',cats,'request-123456789');assert.equal(s.stage,'recurring');s=await advance(s,'1',cats,'request-123456789');assert.equal(s.action,'recurring_save');assert.equal(s.data.kind,'expense');
let bad=await handler(new Request('https://test/?ApiCallId=test-call-123456'));assert.match(await bad.text(),/מפתח החיבור אינו תקין/);
console.log('PASS: hierarchy, annual entry, no write before confirmation, stable retry after committed timeout, replay, fixed-expense route, authentication');

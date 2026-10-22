import assert from 'node:assert/strict';
globalThis.Deno={env:{get:()=>''}};const realDigest=crypto.subtle.digest.bind(crypto.subtle);crypto.subtle.digest=async(a,b)=>new TextDecoder().decode(b)==='test-key'?Uint8Array.from(Buffer.from('12ccca974400e26882199733fa1ebdc6b3654e62ec08fd1f04f47d9e5558ec02','hex')).buffer:realDigest(a,b);
const entries=new Map(),calls=new Map(),scopes=[];let authCalls=0;
globalThis.fetch=async(url,o)=>{const b=o.body?JSON.parse(o.body):null,u=new URL(url,'https://test');let d;
 if(u.pathname.includes('finance_entry_calls')){const id=u.searchParams.get('id')?.slice(3);if(!b)d=entries.has(id)?[entries.get(id)]:[];else if(Array.isArray(b)){entries.set(b[0].id,{...b[0],seq:0});d=b;}else{const r=entries.get(id);Object.assign(r,b);d=[r];}}
 else if(url.endsWith('finance_account_auth')){authCalls++;d=b.p_data.pin==='123456'?{account_id:b.p_data.phone==='0501111111'?'account-a':'account-b',token:'unused'}:{error:'unauthorized'};}
 else if(url.endsWith('billing_access'))d={allowed:true};
 else if(url.endsWith('finance_scoped')){scopes.push(b.p_account);if(b.p_action==='read')d={rows:[{id:b.p_account==='account-a'?1:2,kind:'expense',active:true,name:'מזון',dial_code:'1'}]};else if(b.p_action==='call'){const p=b.p_data,k=b.p_account+':'+p.id;let r=calls.get(k);if(p.state){if(p.seq===-1&&!r)r={id:k,seq:0,state:p.state,response:p.response};else if(r.seq===p.seq)r={...r,seq:r.seq+1,state:p.state,response:p.response};calls.set(k,r);}d=r||null;}}
 else throw Error(url);return Response.json(d);};
const {handler}=await import('./phone.ts');
const p=new URLSearchParams({finance_key:'test-key',ApiCallId:'test-call-number-a',ApiPhone:'0501111111',ApiExtension:'new-test-extension'});
const send=async()=>await(await handler(new Request('https://test/?'+p))).text();
let out=await send();assert.match(out,/קוד אישי/);assert.equal(scopes.length,0);
p.set('login0','999999');out=await send();assert.match(out,/פרטי הכניסה לא אושרו/);assert.equal(scopes.length,0);
p.set('login1','123456');out=await send();assert.match(out,/חודשיות 1/);assert.ok(scopes.every(s=>s==='account-a'));assert.equal(authCalls,2);
scopes.length=0;p.set('z0','1');out=await send();assert.match(out,/להוספת הוצאות/);assert.equal(authCalls,2);assert.ok(scopes.every(s=>s==='account-a'));
p.delete('login0');p.delete('login1');p.delete('z0');p.set('ApiCallId','test-call-number-b');p.set('ApiPhone','0502222222');scopes.length=0;out=await send();assert.match(out,/קוד אישי/);p.set('login0','123456');out=await send();assert.match(out,/חודשיות 1/);assert.ok(scopes.every(s=>s==='account-b'));
p.set('finance_key','wrong');out=await send();assert.match(out,/מפתח החיבור אינו תקין/);
console.log('PASS: phone variable defined, new call login, rejected PIN reveals no ledger, authenticated caller/account binding, subsequent navigation, second caller isolated, key authentication');

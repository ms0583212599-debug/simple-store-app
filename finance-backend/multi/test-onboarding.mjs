import assert from 'node:assert/strict';
globalThis.Deno={env:{get:()=>''}};let row={id:'test-call',seq:0,state:{stage:'register_choice'}},sent=0,verified=0;const saves=[];
globalThis.fetch=async(url,o)=>{const b=o.body?JSON.parse(o.body):null;
 if(url.includes('finance_integrations'))return Response.json([{bridge_secret:'mock',bridge_url:'https://bridge.test',voice_enabled:true,mail_enabled:true}]);
 if(url==='https://bridge.test'){if(b.action==='status')return Response.json({voice_ready:true,mail_ready:true});sent++;return Response.json({ok:true});}
 if(url.includes('finance_entry_calls')){row={...row,...b};saves.push(b);return Response.json([row]);}
 if(url.includes('finance_challenges'))return Response.json([{purpose:'register',account_id:null,id:'challenge-id',expires_at:new Date(Date.now()+600000).toISOString()}]);
 if(url.endsWith('finance_account_auth')){if(b.p_action==='challenge')return Response.json({challenge_id:'challenge-id',expires_at:new Date(Date.now()+600000).toISOString()});if(b.p_action==='verify'){assert.equal(b.p_data.code,'123456');assert.equal(b.p_data.pin,'654321');verified++;return Response.json({account_id:'account-a',token:'mock-session'});}return Response.json({ok:true});}throw Error(url);};
const {registration,pendingRegistration}=await import('./phone-onboarding.ts');const p=new URLSearchParams({signup0:'1'});
let r=await registration(row,p,'0501234567');assert.equal(sent,1);assert.equal(row.state.stage,'otp');assert.match(r.text,/signup1/);
const pending=await pendingRegistration('0501234567');assert.equal(pending.stage,'otp');assert.equal(pending.challenge_id,'challenge-id');
p.set('signup1','123456');r=await registration(row,p,'0501234567');assert.equal(row.state.stage,'new_pin');assert.match(r.text,/signup2/);
p.set('signup2','654321');r=await registration(row,p,'0501234567');assert.equal(r.account_id,'account-a');assert.equal(verified,1);assert.ok(!JSON.stringify(saves).includes('123456'));assert.ok(!JSON.stringify(saves).includes('654321'));
console.log('PASS: registration sends one mocked OTP, resumes challenge, verifies OTP + PIN, and never persists either credential in call state');

import assert from 'node:assert/strict';
import {classify,transactionId} from './policy.ts';
import {nextHebrewMonthStart} from './calendar.ts';
import {makeHandler} from './edit-handler.ts';
import {PUT_FIELDS} from './edit.ts';
const rule={category:'מנוי',tenant_id:'test',action:'renew',expiry_mode:'ivr_next_month',member_field:'Comments'};
const row={TransactionId:'100',Groupe:'מנוי',Comments:'1234',Amount:'50.00',Currency:'1',TransactionType:'רגיל',Confirmation:' 012345'};
assert.equal(classify(row,[rule]).status,'ready');
assert.equal(classify({...row,Comments:'1234 טקסט'},[rule]).status,'review_card');
assert.equal(classify({...row,Amount:'-50'},[rule]).status,'review_payment');
assert.equal(classify({...row,Confirmation:'0'},[rule]).status,'review_payment');
assert.equal(classify({...row,TransactionType:'תשלומים'},[rule]).status,'review_payment');
assert.equal(classify({...row,Groupe:'אחר'},[rule]),null);
assert.throws(()=>transactionId({...row,TransactionId:'bad'}));
assert.equal(nextHebrewMonthStart(new Date('2026-10-21T12:00:00Z')),'2026-11-11');
globalThis.Deno={env:{get:k=>k==='SUPABASE_URL'?'https://db.invalid':'test'}};
async function scenario(expiry,conflict=false,unknown=false){
 let user=Object.fromEntries(PUT_FIELDS.map(k=>[k,'']));
 Object.assign(user,{id:1,card_number:1234,card_value:7500,date_start:'2025-01-01',date_end:expiry});
 let session=null,puts=0,gets=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(String(url));
  if(u.hostname==='db.invalid'){
   if(options.method==='GET')return Response.json(session?[session]:[]);
   if(options.method==='POST'){session={...JSON.parse(options.body),status:'editing',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+600000).toISOString()};return Response.json([session]);}
   if(options.method==='PATCH'){const expected=u.searchParams.get('status');if(expected&&session.status!==expected.slice(3))return Response.json([]);Object.assign(session,JSON.parse(options.body));return Response.json([session]);}
  }else{
   if(options.method==='PUT'){puts++;if(unknown)throw Error('timeout');const p=JSON.parse(options.body);user={...user,...Object.fromEntries(PUT_FIELDS.map(k=>[k,p[k]])),card_value:p.cash_delta};return Response.json({success:true});}
   gets++;if(conflict&&gets===2)user={...user,card_value:7600};return Response.json([user]);
  }
  throw Error('unexpected_fetch');
 };
 const handler=makeHandler({tenant:'test',active:true,groups:{},authenticatedCheck:async()=>({token:'x',response:Response.json({})})});
 const request=()=>new Request('https://worker.invalid',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({ApiDID:'1',ApiCallId:'paid-100',lookup_card:'1234',edit_mode:'1',expiry_0:'11112026',edit_save:'1'})});
 const first=await handler(request());const second=await handler(request());
 return {puts,first:first.headers.get('X-Edit-Result'),second:second.headers.get('X-Edit-Result'),user};
}
let a=await scenario('2026-10-01');assert.equal(a.first,'confirmed');assert.equal(a.second,'confirmed');assert.equal(a.puts,1);assert.equal(a.user.date_end,'2026-11-11');assert.equal(a.user.card_value,7500);
a=await scenario('2027-01-01');assert.equal(a.first,'already_valid');assert.equal(a.puts,0);assert.equal(a.user.date_end,'2027-01-01');
a=await scenario('2026-10-01',true);assert.equal(a.first,'conflict');assert.equal(a.puts,0);
a=await scenario('2026-10-01',false,true);assert.equal(a.first,'uncertain');assert.equal(a.second,'uncertain');assert.equal(a.puts,1);
console.log('PASS: classification, Hebrew expiry, renewal, balance preservation, no shortening, conflict, duplicate and timeout safeguards');

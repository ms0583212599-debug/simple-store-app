import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {classify} from './policy.ts';
const rule={action:'open',category:'כניסה',expiry_mode:'ivr_next_month',member_field:'Comments'};
const row={Groupe:'כניסה',Comments:'',Amount:'10',Currency:'1',TransactionType:'רגיל',Confirmation:'123'};
assert.equal(classify(row,[rule]).status,'ready');
assert.equal(classify({...row,Comments:'טקסט חופשי'},[rule]).status,'ready');
assert.equal(classify({...row,Comments:'1234'},[rule]).card,null);
assert.equal(classify({...row,Confirmation:'0'},[rule]).status,'review_payment');
assert.equal(classify({...row,Amount:'0'},[rule]).status,'review_payment');
assert.equal(classify(row,[{...rule,action:'renew'}]).status,'review_card');
assert.equal(classify(row,[{...rule,action:'both'}]).status,'review_card');
const src=await fs.readFile(new URL('./index.ts',import.meta.url),'utf8');
const execute=src.slice(src.indexOf('async function execute('),src.indexOf('Deno.serve(')).replace('db:any,event:any','db,event');
let calls=0;
const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:{status:'sent'}})};
const fn=new Function('openDoor','routingKey','hash','checked','form','tenantAuth','members',execute+';return execute;')(
 async()=>{calls++;return new Response('sent')},async()=> 'fake',async()=> 'hash',x=>x.data,x=>x,
 ()=>{throw Error('open must not authenticate member')},()=>{throw Error('open must not read members')});
assert.equal(await fn({from:()=>q},{tenant_id:'test',mosad:'1',transaction_id:1,action:'open',card_number:null}),'completed');
assert.equal(calls,1);
console.log('PASS: no-card and free-text door payments; payment validation; renewal card requirement; door execution skips member lookup');

import assert from 'node:assert/strict';
globalThis.Deno={env:{get:()=>''}};let received;
globalThis.fetch=async(url,o)=>{received=JSON.parse(o.body);return Response.json({total:1,rows:[{id:1,occurred_on:'2026-10-22',kind:'expense',flow_type:'annual',category_name:'<script>unsafe</script>',signed_amount:-300,status:'actual',payment_method:'cash',note:'<img src=x onerror=alert(1)>',reversal_of:2}],income:0,expense:-300,planned_income:0,planned_expense:0});};
const {reportHTML}=await import('./report.ts');const h=await reportHTML('tenant-a',{});assert.equal(received.p_account,'tenant-a');assert.equal(received.p_data.mode,'export');assert.equal(received.p_data.from,'2000-01-01');assert.ok(h.includes('&lt;script&gt;'));assert.ok(!h.includes('<script>unsafe'));assert.ok(h.includes('החזר'));assert.ok(h.includes('מינוס 3'));
console.log('PASS: one scoped atomic export, full date range, refunds, escaped report content');

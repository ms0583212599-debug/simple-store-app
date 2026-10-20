import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import {stripTypeScriptTypes} from 'node:module';
const ctx={URLSearchParams};vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/vendpay-tenant-members/summary.ts','utf8').replaceAll('export ','')),ctx);
const groups=[{id:12,title:'מנוי רגיל'},{id:25,title:'מנוי מורחב'},{id:33,title:'אחראי'},{id:44,title:'מנוי רגיל הוראת קבע'}];
const users=[
 {id:1,is_active:1,date_start:'2026-01-01',date_end:'2026-10-21',restrict_id:12},
 {id:2,is_active:1,date_start:'2026-01-01',date_end:'2026-10-27',restrict_id:25},
 {id:3,is_active:1,date_start:'2026-01-01',date_end:'2026-11-01',restrict_id:33},
 {id:4,is_active:0,date_start:'2026-01-01',date_end:'2026-11-01',restrict_id:12},
 {id:5,is_active:1,date_start:'2026-01-01',date_end:'2026-10-20',restrict_id:12},
 {id:6,is_active:1,date_start:'2026-10-22',date_end:'2026-11-01',restrict_id:12},
 {id:7,is_active:1,date_start:null,date_end:null,restrict_id:12},
 {id:8,is_active:1,date_start:'2026-01-01',date_end:'2026-11-01',restrict_id:44}];
const now=new Date('2026-10-20T22:30:00Z'); // October 21 in Israel
const c=ctx.counts(users,groups,now);assert.equal(c.total,8);assert.equal(c.valid,4);assert.equal(c.regular,1);assert.equal(c.extended,1);assert.equal(c.responsible,1);assert.equal(c.expired,1);assert.equal(c.expiring,2);assert.equal(c.inactive,1);assert.equal(c.unknown,1);
assert.equal(ctx.counts(users,[],now).regular,null);assert.throws(()=>ctx.counts([...users,users[0]],groups,now));
let text=ctx.summaryReply(new URLSearchParams({summary_0:'1'}),users,groups,now);assert.ok(text.includes('8'));assert.ok(text.includes('summary_1'));text=ctx.summaryReply(new URLSearchParams({summary_0:'1',summary_1:'2'}),users,groups,now);assert.ok(text.includes('בתוקף היום 4'));assert.ok(text.includes('summary_2'));
console.log('PASS summary: Israel day boundary, inclusive expiry, future start/inactive exclusion, group IDs by exact title, separate standing-order group, missing dates, seven-day window, repeated menu');

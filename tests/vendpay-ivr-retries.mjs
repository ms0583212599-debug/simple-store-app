import assert from 'node:assert/strict';
const now=new Date('2026-10-22T12:00:00Z'),groups={'1':'מנוי'};
for(const slug of ['vendpay-tenant-members','vendpay-admin-users']){
 const {wizard}=await import('../supabase/functions/'+slug+'/wizard.ts');const run=p=>wizard(p,now,groups);const key=r=>r.reply?.split('=')[2]?.split(',')[0];
 const base={admin_0_fname:'משה',admin_0_lname:'כהן',admin_0_names_ok:'1',pel:'0501234567',card_number:'123',amount:'0',restrict_id:'1',date_end:'31122026',extras:'2'};
 for(const [field,bad,good,next] of [['pel','123','0501234567','card_number'],['card_number','0','123','amount'],['amount','abc','12.50','restrict_id'],['restrict_id','99','1','date_end_cal_0_year'],['extras','9','2','save_confirm'],['date_end','31022026','31122026','extras']]){
  const p=new URLSearchParams(base);p.set(field,bad);assert.equal(key(run(p)),field+'_retry_1',field);p.set(field+'_retry_1',good);const r=run(p);assert.equal(key(r),'save_confirm');p.set('save_confirm','1');assert.equal(run(p).payload.fname,'משה');assert.equal(run(p).payload.card_number,123);
 }
 let p=new URLSearchParams(base);p.set('admin_0_lname','!');assert.equal(key(run(p)),'admin_0_lname_retry_1');p.set('admin_0_lname_retry_1','לוי');assert.equal(key(run(p)),'save_confirm');
 p=new URLSearchParams(base);p.set('extras','1');for(const k of ['tel','email','passport','address','city','zip','date_start','date_birth','parent_id','is_active','note1','note2','note3'])p.set(k,'0');p.set('email','bad');assert.equal(key(run(p)),'email_retry_1');p.set('email_retry_1','good@example.test');p.set('save_confirm','1');assert.equal(run(p).payload.email,'good@example.test');assert.equal(run(p).payload.date_start,'2026-10-22');
 p=new URLSearchParams(base);p.set('date_end','01012026');assert.equal(key(run(p)),'date_end_corrected_cal_0_year');p.set('date_end_corrected_cal_0_year','0');p.set('date_end_corrected_cal_0_gregorian','31122026');p.set('date_end_corrected_cal_0_ok','1');p.set('save_confirm','1');assert.equal(run(p).payload.date_end,'2026-12-31');
 p=new URLSearchParams(base);p.set('save_confirm','1');p.set('card_correction_1','456');assert.equal(key(run(p)),'save_confirm_card_1');p.set('save_confirm_card_1','1');assert.equal(run(p).payload.card_number,456);assert.equal(run(p).payload.pel,base.pel);
 const {requestDate}=await import('../supabase/functions/'+slug+'/calendar.ts');p=new URLSearchParams({d_cal_0_year:'5787',d_cal_0_month:'1',d_cal_0_day:'99'});assert.equal(key(requestDate(p,'d','תאריך')),'d_cal_0_day_retry_1');p.set('d_cal_0_day_retry_1','1');assert.equal(key(requestDate(p,'d','תאריך')),'d_cal_0_ok');p.set('d_cal_0_ok','9');assert.equal(key(requestDate(p,'d','תאריך')),'d_cal_0_ok_retry_1');p.set('d_cal_0_ok_retry_1','1');assert(requestDate(p,'d','תאריך').iso);
 console.log('PASS',slug,'field retries preserve other values, names, optional fields, calendar day and confirmation, reversed dates');
}

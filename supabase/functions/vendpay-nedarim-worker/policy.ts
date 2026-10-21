export function transactionId(row:any):number {
 const raw=String(row.TransactionId??'');if(!/^[1-9]\d{0,14}$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw Error('invalid_transaction_id');return Number(raw);
}
export function classify(row:any,rules:any[]){
 const category=String(row.Groupe??'').normalize('NFC').trim();
 const matches=rules.filter(r=>String(r.category).normalize('NFC').trim()===category);
 if(!matches.length)return null;
 if(matches.length!==1)throw Error('ambiguous_rule');
 const rule=matches[0],card=String(row.Comments??'').trim();
 let status='ready';
 if(!['open','renew','both'].includes(rule.action)||rule.expiry_mode!=='ivr_next_month'||rule.member_field!=='Comments')status='review_rule';
 else if(!/^[1-9]\d{0,14}$/.test(card))status='review_card';
 else if(!/^\d+(\.\d{1,2})?$/.test(String(row.Amount??'').trim())||Number(row.Amount)<=0||String(row.Currency)!=='1'||String(row.TransactionType).trim()!=='רגיל'||!/^0*[1-9]\d*$/.test(String(row.Confirmation??'').trim()))status='review_payment';
 return {rule,category,card:/^[1-9]\d{0,14}$/.test(card)?card:null,status};
}

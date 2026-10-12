import assert from 'node:assert/strict';
import {matchedReceipt,marker} from './match.mjs';
const token='test-order-123456789';
const exact={Status:'OK',Currency:'ILS',TransactionId:123,Amount:12.5,Groupe:'shop',Comment:marker(token)};
assert.equal(matchedReceipt([exact],token,12.5,'shop').length,1);
for(const row of [{...exact,Comment:''},{...exact,Comment:marker('different-order-123')},{...exact,Amount:12},{...exact,Groupe:'other'},{...exact,TransactionId:''},{...exact,Status:'ERROR'},{...exact,Status:undefined},{...exact,Currency:'USD'}])assert.equal(matchedReceipt([row],token,12.5,'shop').length,0);
assert.equal(matchedReceipt([{...exact,Comment:undefined,Avour:marker(token)}],token,12.5,'shop').length,1);
assert.equal(matchedReceipt([exact,{...exact,TransactionId:124}],token,12.5,'shop').length,2);
console.log('Exact order marker, amount, category, receipt ID and ambiguity tests passed');

export function marker(token){return 'SimpleStore:'+token;}
export function matchedReceipt(rows,token,amount,groupe){
 if(!Number.isFinite(amount)||amount<=0)return [];
 const mark=marker(token);
 return rows.filter(r=>{
  if(!r||String(r.Comments||'').trim()!==mark)return false;
  // Verified provider history has Confirmation and TransactionType, not Status.
  if(!/^\d+$/.test(String(r.Confirmation||'').trim())||Number(r.Confirmation)<=0)return false;
  if(String(r.TransactionType||'').trim()!=='רגיל')return false;
  if(String(r.Currency)!=='1')return false;
  if(!/^\d+$/.test(String(r.TransactionId||''))||Number(r.TransactionId)<=0)return false;
  if(!Number.isFinite(Number(r.Amount))||Math.abs(Number(r.Amount)-amount)>0.009)return false;
  if(groupe&&String(r.Groupe||'').trim()!==groupe.trim())return false;
  return true;
 });
}


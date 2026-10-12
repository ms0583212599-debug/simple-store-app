export function marker(token){return 'SimpleStore:'+token;}
export function matchedReceipt(rows,token,amount,groupe){
 const mark=marker(token);
 return rows.filter(r=>{
  // Exact unique order marker is mandatory. Never match by amount/time alone.
  if(!Object.values(r).some(v=>typeof v==='string'&&v.trim()===mark))return false;
  if(!['OK','APPROVED','SUCCESS'].includes(String(r.Status||'').toUpperCase()))return false;
  if(!['1','ILS','SHEKEL','NIS'].includes(String(r.Currency||'').toUpperCase()))return false;
  if(!/^\d+$/.test(String(r.TransactionId||'')))return false;
  if(!Number.isFinite(Number(r.Amount))||Math.abs(Number(r.Amount)-amount)>0.009)return false;
  if(groupe&&String(r.Groupe||'').trim()!==groupe.trim())return false;
  return true;
 });
}

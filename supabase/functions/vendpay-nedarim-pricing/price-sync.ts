import {effective,agorot} from './price-policy.ts';
import {passwordFor,readCategories,writeMinimum} from './price-provider.ts';
export async function syncPrices(db:any,mosad:string,tenant:string){
 const read=await db.from('vendpay_nedarim_prices').select('*').eq('mosad',mosad).eq('tenant_id',tenant).eq('enabled',true).order('last_checked_at',{ascending:true,nullsFirst:true}).limit(50);
 if(read.error)throw Error('database_error');if(!read.data.length)return {checked:0};
 const password=await passwordFor(db,mosad,tenant);let groups:any[];
 try{groups=await readCategories(mosad,password);}catch{
  await db.from('vendpay_nedarim_prices').update({last_status:'category_permission',last_checked_at:new Date().toISOString()}).eq('mosad',mosad).eq('tenant_id',tenant).eq('enabled',true);
  return {checked:0,error:'category_permission'};
 }
 let checked=0,writes=0;
 for(const plan of read.data){
  const current=groups.find(g=>String(g.id)===plan.category_id);if(writes>=3&&current&&agorot(current.Amount||0)!==effective(plan))continue;
  const lease=new Date(Date.now()+120000).toISOString();
  const claim=await db.from('vendpay_nedarim_prices').update({lease_until:lease}).eq('mosad',mosad).eq('category_id',plan.category_id).eq('revision',plan.revision).eq('enabled',true).or('lease_until.is.null,lease_until.lt.'+new Date().toISOString()).select('category_id');
  if(claim.error||!claim.data?.length)continue;
  let status='sync_failed',observed=null,target=null,applied=false;
  try{
   // Recheck binding after claim. Detached institutions must never be updated.
   const binding=await db.from('vendpay_nedarim_connections').select('tenant_id').eq('mosad',mosad).single();if(binding.error||binding.data?.tenant_id!==tenant)throw Error('connection_changed');
   const category=groups.find(g=>String(g.id)===plan.category_id);if(!category||category.GoToMosad||category.GoToTofes)throw Error('category_missing');
   target=effective(plan);observed=category.Amount===''||category.Amount==null?0:agorot(category.Amount);
   if(observed!==target){
    writes++;await writeMinimum(mosad,password,category,target);
    groups=await readCategories(mosad,password);const after=groups.find(g=>String(g.id)===plan.category_id);
    observed=after?(after.Amount===''||after.Amount==null?0:agorot(after.Amount)):null;
    if(observed!==target)throw Error('verification_failed');applied=true;
   }
   status='synced';
  }catch(e){status=e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'sync_failed';}
  finally{
   const result=await db.from('vendpay_nedarim_prices').update({lease_until:null,last_checked_at:new Date().toISOString(),last_status:status,last_target_agorot:target,last_observed_agorot:observed,...(applied?{last_applied_at:new Date().toISOString()}: {})}).eq('mosad',mosad).eq('category_id',plan.category_id).eq('revision',plan.revision).eq('lease_until',lease);
   if(result.error)throw Error('database_error');
  }checked++;
 }return {checked};
}

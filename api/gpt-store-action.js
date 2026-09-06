const SUPABASE_URL='https://ksddrcalmszxxcuxoznd.supabase.co';
const SUPABASE_KEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';

async function isAdmin(auth){
  if(!auth)return false;
  const u=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
  if(!u.ok)return false;
  const user=await u.json();
  if(!user.id)return false;
  const a=await fetch(SUPABASE_URL+'/rest/v1/store_admins?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id',{headers:{apikey:SUPABASE_KEY,Authorization:auth}});
  if(!a.ok)return false;
  const rows=await a.json();
  return Array.isArray(rows)&&rows.length>0;
}

async function sb(auth,path,opt={}){
  const headers={apikey:SUPABASE_KEY,Authorization:auth,'Content-Type':'application/json',Prefer:'return=representation'};
  const r=await fetch(SUPABASE_URL+path,{...opt,headers:{...headers,...(opt.headers||{})}});
  const text=await r.text();
  let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error((data&&data.message)||text||('HTTP '+r.status));
  return data;
}

function cleanData(entity,data){
  data=data&&typeof data==='object'?data:{};
  const allowed={
    product:['name','category_id','price','stock_quantity','low_stock_threshold','image_url','is_active','sort_order'],
    category:['name','sort_order','image_mode','image_url'],
    supplier:['name','phone','email','payment_terms','notes']
  }[entity]||[];
  const out={};for(const k of allowed)if(Object.prototype.hasOwnProperty.call(data,k))out[k]=data[k];
  return out;
}

async function applyOne(auth,a){
  const action=String(a?.action||'');
  const entity=String(a?.entity||'');
  const id=String(a?.id||'');
  const data=cleanData(entity,a?.data);
  if(action==='adjust_stock'){
    const productId=String(a?.product_id||a?.id||'');
    const change=Number(a?.change_qty);
    if(!productId||!Number.isInteger(change)||change===0)throw new Error('adjust_stock requires product_id and non-zero integer change_qty');
    return sb(auth,'/rest/v1/rpc/adjust_stock',{method:'POST',body:JSON.stringify({p_product_id:productId,p_change_qty:change,p_reason:String(a?.reason||'עדכון GPT'),p_note:a?.note?String(a.note):null})});
  }
  const table={product:'products',category:'categories',supplier:'suppliers'}[entity];
  if(!table)throw new Error('Unsupported entity');
  if(action==='create'){
    if(!Object.keys(data).length)throw new Error('No allowed data supplied');
    return sb(auth,'/rest/v1/'+table,{method:'POST',body:JSON.stringify(data)});
  }
  if(action==='update'){
    if(!id)throw new Error('Missing id');
    if(!Object.keys(data).length)throw new Error('No allowed data supplied');
    return sb(auth,'/rest/v1/'+table+'?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify(data)});
  }
  if(action==='deactivate'&&entity==='product'){
    if(!id)throw new Error('Missing id');
    return sb(auth,'/rest/v1/products?id=eq.'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({is_active:false})});
  }
  throw new Error('Unsupported action');
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=req.headers.authorization||'';
    if(!await isAdmin(auth))return res.status(403).json({error:'Admin access required'});
    const actions=Array.isArray(req.body?.actions)?req.body.actions:[];
    if(!actions.length||actions.length>25)return res.status(400).json({error:'Invalid actions'});
    const results=[];
    for(const a of actions)results.push({action:a,result:await applyOne(auth,a)});
    res.status(200).json({ok:true,results});
  }catch(e){res.status(500).json({error:String(e?.message||e)})}
};
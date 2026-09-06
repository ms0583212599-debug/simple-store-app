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
  const rows=await a.json();return Array.isArray(rows)&&rows.length>0;
}
async function getStoreContext(auth){
  const h={apikey:SUPABASE_KEY,Authorization:auth};
  const get=async path=>{const r=await fetch(SUPABASE_URL+path,{headers:h});return r.ok?await r.json():[]};
  const [categories,products,suppliers]=await Promise.all([
    get('/rest/v1/categories?select=id,name,sort_order&order=sort_order.asc'),
    get('/rest/v1/products?select=id,name,category_id,price,stock_quantity,low_stock_threshold,is_active,sort_order&order=category_id.asc,sort_order.asc'),
    get('/rest/v1/suppliers?select=id,name,phone,email,payment_terms,notes&order=name.asc')
  ]);
  return {categories,products,suppliers};
}
function parseActionBlock(text){
  const m=String(text||'').match(/<store_actions>([\s\S]*?)<\/store_actions>/i);if(!m)return {text,actions:[]};
  let actions=[];try{const j=JSON.parse(m[1].trim());actions=Array.isArray(j)?j:[]}catch{}
  return {text:String(text||'').replace(m[0],'').trim(),actions};
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=req.headers.authorization||'';
    if(!await isAdmin(auth))return res.status(403).json({error:'Admin access required'});
    if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY is not configured'});
    const src=Array.isArray(req.body?.messages)?req.body.messages:[];
    const messages=src.slice(-40).map(m=>({role:m?.role==='assistant'?'assistant':'user',content:String(m?.content||'').slice(0,20000)})).filter(m=>m.content.trim());
    if(!messages.length)return res.status(400).json({error:'Message is required'});
    const store=await getStoreContext(auth);
    const instructions=`אתה העוזר האישי של מנהל החנות. ענה בעברית כברירת מחדל. יש לך הקשר חי של החנות המצורף למטה. אתה יכול לנתח מוצרים, מחירים, מלאי, קטגוריות וספקים. כאשר המשתמש מבקש לבצע שינוי בנתוני החנות, אל תטען שביצעת אותו. הסבר בקצרה מה יבוצע ובסוף התשובה החזר תג STORE_ACTIONS יחיד בפורמט המדויק <store_actions>[JSON]</store_actions>. הפעולות הנתמכות: create/update/deactivate עם entity product/category/supplier; וכן {"action":"adjust_stock","product_id":"...","change_qty":1,"reason":"...","note":"..."}. בעדכון השתמש ב-id הקיים. שדות מותרים למוצר: name,category_id,price,stock_quantity,low_stock_threshold,image_url,is_active,sort_order. לקטגוריה: name,sort_order,image_mode,image_url. לספק: name,phone,email,payment_terms,notes. לעולם אל תבצע מחיקה קשיחה. אם אין בקשת שינוי, אל תחזיר store_actions. נתוני החנות: ${JSON.stringify(store).slice(0,90000)}`;
    const body={model:process.env.OPENAI_MODEL||'gpt-5.6-sol',instructions,input:messages,max_output_tokens:7000};
    if(req.body?.webSearch===true)body.tools=[{type:'web_search'}];
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'OpenAI request failed'});
    let text=data.output_text||'';if(!text&&Array.isArray(data.output))text=data.output.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('\n');
    const parsed=parseActionBlock(text);
    res.status(200).json({text:parsed.text,actions:parsed.actions,model:data.model,responseId:data.id});
  }catch(e){res.status(500).json({error:String(e?.message||e)})}
};
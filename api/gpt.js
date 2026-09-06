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

async function responseJson(response){
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text)}catch{return null}
}

function responseText(data){
  if(typeof data?.output_text==='string')return data.output_text;
  if(!Array.isArray(data?.output))return '';
  return data.output.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('\n');
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
    const body={model:process.env.OPENAI_MODEL||'gpt-5.6',input:messages,max_output_tokens:6000};
    if(req.body?.webSearch===true)body.tools=[{type:'web_search'}];
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await responseJson(r);
    if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'OpenAI request failed'});
    if(!data)return res.status(502).json({error:'OpenAI returned an invalid response'});
    const text=responseText(data).trim();
    if(!text)return res.status(502).json({error:'OpenAI returned an empty response'});
    return res.status(200).json({text,model:data.model,responseId:data.id});
  }catch(e){return res.status(500).json({error:String(e?.message||e)})}
};

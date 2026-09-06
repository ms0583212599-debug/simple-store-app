const SUPABASE_URL='https://ksddrcalmszxxcuxoznd.supabase.co';
const SUPABASE_KEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
const REPO='ms0583212599-debug/simple-store-app';

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

function textFromResponse(data){
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
    const request=String(req.body?.request||'').trim().slice(0,12000);
    if(!request)return res.status(400).json({error:'Upgrade request is required'});

    const treeResp=await fetch('https://api.github.com/repos/'+REPO+'/git/trees/main?recursive=1',{headers:{Accept:'application/vnd.github+json','User-Agent':'simple-store-gpt'}});
    const tree=await responseJson(treeResp);
    if(!treeResp.ok)return res.status(502).json({error:tree?.message||'Could not read repository structure'});
    if(!tree)return res.status(502).json({error:'Repository returned an invalid response'});
    const files=(tree.tree||[]).filter(x=>x.type==='blob'&&/\.(js|html|css|json|md)$/i.test(x.path)&&!x.path.startsWith('.github/')).map(x=>x.path).slice(0,250);
    if(!files.length)return res.status(502).json({error:'No editable repository files were found'});

    const prompt=`You are helping maintain a live store web application. The administrator requested this change:\n\n${request}\n\nRepository files:\n${files.join('\n')}\n\nReturn ONLY valid JSON with this shape:\n{"title":"short Hebrew title","summary":"clear Hebrew explanation","files":["path1","path2"],"steps":["step 1","step 2"],"risk":"low|medium|high"}\nChoose at most 6 likely files. Do not claim the change has already been applied.`;

    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6',input:prompt,max_output_tokens:1800})});
    const data=await responseJson(r);
    if(!r.ok)return res.status(r.status).json({error:data?.error?.message||'OpenAI request failed'});
    if(!data)return res.status(502).json({error:'OpenAI returned an invalid response'});
    const raw=textFromResponse(data).trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim();
    let proposal;
    try{proposal=JSON.parse(raw)}catch{return res.status(502).json({error:'Could not parse upgrade proposal'})}
    if(!proposal||typeof proposal!=='object'||Array.isArray(proposal))return res.status(502).json({error:'Upgrade proposal has an invalid structure'});
    proposal.title=String(proposal.title||'שינוי באתר').slice(0,200);
    proposal.summary=String(proposal.summary||'').slice(0,5000);
    proposal.files=Array.isArray(proposal.files)?[...new Set(proposal.files.map(String).filter(x=>files.includes(x)))].slice(0,6):[];
    proposal.steps=Array.isArray(proposal.steps)?proposal.steps.map(String).filter(Boolean).slice(0,12):[];
    proposal.risk=['low','medium','high'].includes(proposal.risk)?proposal.risk:'medium';
    proposal.request=request;
    if(!proposal.files.length)return res.status(502).json({error:'The proposal did not select any valid files'});
    return res.status(200).json({proposal});
  }catch(e){return res.status(500).json({error:String(e?.message||e)})}
};

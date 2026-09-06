const SUPABASE_URL='https://ksddrcalmszxxcuxoznd.supabase.co';
const SUPABASE_KEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
const REPO='ms0583212599-debug/simple-store-app';
const API='https://api.github.com/repos/'+REPO;

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
function ghHeaders(token){return {Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'simple-store-gpt'}}
async function readJson(r){const t=await r.text();if(!t)return {};try{return JSON.parse(t)}catch{return null}}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=req.headers.authorization||'';
    if(!await isAdmin(auth))return res.status(403).json({error:'Admin access required'});
    const githubToken=process.env.GITHUB_TOKEN;
    if(!githubToken)return res.status(503).json({error:'GITHUB_TOKEN is not configured'});
    const prNumber=Number(req.body?.prNumber);
    if(!Number.isInteger(prNumber)||prNumber<1)return res.status(400).json({error:'Invalid Pull Request number'});
    const prResp=await fetch(API+'/pulls/'+prNumber,{headers:ghHeaders(githubToken)});
    const pr=await readJson(prResp);
    if(!prResp.ok)return res.status(502).json({error:pr?.message||'Could not read Pull Request'});
    if(pr.base?.ref!=='main'||!String(pr.head?.ref||'').startsWith('gpt-upgrade-'))return res.status(400).json({error:'This Pull Request is not from the store GPT workflow'});
    const fr=await fetch(API+'/pulls/'+prNumber+'/files?per_page=100',{headers:ghHeaders(githubToken)});
    const files=await readJson(fr);
    if(!fr.ok)return res.status(502).json({error:files?.message||'Could not read changed files'});
    const safeFiles=(Array.isArray(files)?files:[]).slice(0,30).map(f=>({filename:String(f.filename||''),status:String(f.status||''),additions:Number(f.additions||0),deletions:Number(f.deletions||0),changes:Number(f.changes||0),patch:String(f.patch||'').slice(0,10000)}));
    return res.status(200).json({ok:true,prNumber,title:pr.title||'',body:pr.body||'',state:pr.state,mergeable:pr.mergeable,mergeableState:pr.mergeable_state||'',branch:pr.head?.ref||'',url:pr.html_url||'',files:safeFiles,totals:{files:safeFiles.length,additions:safeFiles.reduce((s,f)=>s+f.additions,0),deletions:safeFiles.reduce((s,f)=>s+f.deletions,0)}});
  }catch(e){return res.status(500).json({error:String(e?.message||e)})}
};

const SUPABASE_URL='https://ksddrcalmszxxcuxoznd.supabase.co';
const SUPABASE_KEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
const REPO='ms0583212599-debug/simple-store-app';
const API='https://api.github.com/repos/'+REPO;
async function isAdmin(auth){if(!auth)return false;const u=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!u.ok)return false;const user=await u.json();if(!user.id)return false;const a=await fetch(SUPABASE_URL+'/rest/v1/store_admins?user_id=eq.'+encodeURIComponent(user.id)+'&select=user_id',{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!a.ok)return false;const rows=await a.json();return Array.isArray(rows)&&rows.length>0}
function gh(token){return {Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'simple-store-gpt'}}
async function readJson(r){const t=await r.text();if(!t)return {};try{return JSON.parse(t)}catch{return null}}
module.exports=async function handler(req,res){
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const auth=req.headers.authorization||'';if(!await isAdmin(auth))return res.status(403).json({error:'Admin access required'});const token=process.env.GITHUB_TOKEN;if(!token)return res.status(503).json({error:'GITHUB_TOKEN is not configured'});
  const n=Number(req.body?.prNumber);if(!Number.isInteger(n)||n<1)return res.status(400).json({error:'Invalid Pull Request number'});
  const p=await fetch(API+'/pulls/'+n,{headers:gh(token)});const pr=await readJson(p);if(!p.ok)return res.status(502).json({error:pr?.message||'Could not read Pull Request'});
  if(pr.state!=='open'||pr.base?.ref!=='main'||!String(pr.head?.ref||'').startsWith('gpt-upgrade-'))return res.status(400).json({error:'This upgrade cannot be cancelled'});
  const c=await fetch(API+'/pulls/'+n,{method:'PATCH',headers:{...gh(token),'Content-Type':'application/json'},body:JSON.stringify({state:'closed'})});const cd=await readJson(c);if(!c.ok)return res.status(502).json({error:cd?.message||'Could not cancel upgrade'});
  return res.status(200).json({ok:true,cancelled:true});
 }catch(e){return res.status(500).json({error:String(e?.message||e)})}
};

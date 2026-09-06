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
function cleanJson(text){return String(text||'').trim().replace(/^```json\s*/i,'').replace(/```$/,'').trim()}
function responseText(data){
  if(typeof data?.output_text==='string')return data.output_text;
  return Array.isArray(data?.output)?data.output.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('\n'):'';
}
async function responseJson(response){
  const text=await response.text();
  if(!text)return {};
  try{return JSON.parse(text)}catch{return null}
}
async function removeBranch(branch,token){
  if(!branch)return;
  try{await fetch(API+'/git/refs/heads/'+branch,{method:'DELETE',headers:ghHeaders(token)})}catch{}
}

module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const auth=req.headers.authorization||'';
    if(!await isAdmin(auth))return res.status(403).json({error:'Admin access required'});
    const githubToken=process.env.GITHUB_TOKEN;
    if(!githubToken)return res.status(503).json({error:'GITHUB_TOKEN is not configured'});
    if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'OPENAI_API_KEY is not configured'});

    const proposal=req.body?.proposal||{};
    const request=String(proposal.request||'').trim().slice(0,12000);
    const files=Array.isArray(proposal.files)?[...new Set(proposal.files.map(String))].slice(0,6):[];
    if(!request||!files.length)return res.status(400).json({error:'Invalid proposal'});
    if(files.some(p=>!/^[-_./a-zA-Z0-9]+$/.test(p)||p.includes('..')||p.startsWith('.github/')))return res.status(400).json({error:'Invalid file path'});

    const originals=[];
    let total=0;
    for(const path of files){
      const r=await fetch(API+'/contents/'+path+'?ref=main',{headers:ghHeaders(githubToken)});
      const d=await responseJson(r);
      if(!r.ok)return res.status(400).json({error:d?.message||'Could not read '+path});
      if(!d||typeof d.content!=='string'||!d.sha)return res.status(502).json({error:'GitHub returned invalid content for '+path});
      const content=Buffer.from(d.content.replace(/\n/g,''),'base64').toString('utf8');
      total+=content.length;
      if(total>180000)return res.status(400).json({error:'Selected files are too large for one automatic change'});
      originals.push({path,sha:d.sha,content});
    }

    const fileBlock=originals.map(f=>'\n===== FILE: '+f.path+' =====\n'+f.content).join('\n');
    const prompt=`You are editing a live store web application. Apply ONLY the approved request below. Preserve all unrelated behavior and existing functionality. Do not remove features unless explicitly requested. Return ONLY valid JSON in the exact shape {"summary":"short Hebrew summary","files":[{"path":"existing/path","content":"complete replacement file content"}]}. Every returned path must be one of the provided files. Return complete file contents, not diffs. If a provided file does not need a change, omit it.\n\nAPPROVED REQUEST:\n${request}\n\nPLANNED SUMMARY:\n${String(proposal.summary||'').slice(0,5000)}\n\nFILES:${fileBlock}`;

    const ai=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.6',input:prompt,max_output_tokens:30000})});
    const aiData=await responseJson(ai);
    if(!ai.ok)return res.status(ai.status).json({error:aiData?.error?.message||'OpenAI request failed'});
    if(!aiData)return res.status(502).json({error:'OpenAI returned an invalid response'});
    let plan;
    try{plan=JSON.parse(cleanJson(responseText(aiData)))}catch{return res.status(502).json({error:'Could not parse generated code change'})}
    const edits=Array.isArray(plan?.files)?plan.files:[];
    const allowed=new Map(originals.map(f=>[f.path,f]));
    const uniqueEdits=new Map();
    for(const edit of edits){
      const path=String(edit?.path||'');
      if(allowed.has(path)&&typeof edit?.content==='string')uniqueEdits.set(path,edit.content);
    }
    const valid=[];
    for(const [path,content] of uniqueEdits){
      const original=allowed.get(path);
      if(content!==original.content)valid.push({path,content,sha:original.sha});
    }
    if(!valid.length)return res.status(400).json({error:'GPT did not produce any code changes'});

    const mainRef=await fetch(API+'/git/ref/heads/main',{headers:ghHeaders(githubToken)});
    const main=await responseJson(mainRef);
    if(!mainRef.ok)return res.status(502).json({error:main?.message||'Could not read main branch'});
    const baseSha=main?.object?.sha;
    if(!baseSha)return res.status(502).json({error:'Main branch reference is invalid'});
    const branch='gpt-upgrade-'+Date.now();
    const createRef=await fetch(API+'/git/refs',{method:'POST',headers:{...ghHeaders(githubToken),'Content-Type':'application/json'},body:JSON.stringify({ref:'refs/heads/'+branch,sha:baseSha})});
    const createData=await responseJson(createRef);
    if(!createRef.ok)return res.status(502).json({error:createData?.message||'Could not create upgrade branch'});

    for(const edit of valid){
      const wr=await fetch(API+'/contents/'+edit.path,{method:'PUT',headers:{...ghHeaders(githubToken),'Content-Type':'application/json'},body:JSON.stringify({message:'GPT approved change: '+String(proposal.title||'store upgrade').slice(0,70),content:Buffer.from(edit.content,'utf8').toString('base64'),sha:edit.sha,branch})});
      const writeData=await responseJson(wr);
      if(!wr.ok){await removeBranch(branch,githubToken);return res.status(502).json({error:'Failed updating '+edit.path+': '+(writeData?.message||'GitHub error')})}
    }

    const pr=await fetch(API+'/pulls',{method:'POST',headers:{...ghHeaders(githubToken),'Content-Type':'application/json'},body:JSON.stringify({title:'GPT: '+String(proposal.title||'Store upgrade').slice(0,100),head:branch,base:'main',body:'Approved from the store admin GPT.\n\nRequest:\n'+request+'\n\nGenerated summary:\n'+String(plan.summary||proposal.summary||'')})});
    const prData=await responseJson(pr);
    if(!pr.ok){await removeBranch(branch,githubToken);return res.status(502).json({error:prData?.message||'Pull Request creation failed'})}
    if(!prData?.number||!prData?.html_url)return res.status(502).json({error:'GitHub returned an invalid Pull Request response',branch});
    return res.status(200).json({ok:true,branch,prNumber:prData.number,prUrl:prData.html_url,summary:plan.summary||proposal.summary||'',files:valid.map(x=>x.path)});
  }catch(e){return res.status(500).json({error:String(e?.message||e)})}
};

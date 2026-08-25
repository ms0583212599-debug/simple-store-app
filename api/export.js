const SUPABASE='https://ksddrcalmszxxcuxoznd.supabase.co/functions/v1/export-store-excel';
const APIKEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
module.exports=async function handler(req,res){
  try{
    const auth=req.headers.authorization||'';
    if(!auth)return res.status(401).send('Missing authorization');
    const qs=new URLSearchParams(req.query||{}).toString();
    const upstream=await fetch(SUPABASE+(qs?'?'+qs:''),{headers:{apikey:APIKEY,Authorization:auth,Accept:'application/vnd.ms-excel'}});
    const buf=Buffer.from(await upstream.arrayBuffer());
    if(!upstream.ok)return res.status(upstream.status).send(buf.toString('utf8'));
    res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/vnd.ms-excel');
    res.setHeader('Content-Disposition',upstream.headers.get('content-disposition')||'attachment; filename="store-export.xls"');
    res.setHeader('Cache-Control','no-store');
    res.status(200).send(buf);
  }catch(e){res.status(500).send(String(e&&e.message||e));}
};
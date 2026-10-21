import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {passwordFor,readCategories} from './price-provider.ts';
import {syncPrices} from './price-sync.ts';
const env=k=>Deno.env.get(k)||'';
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 if(req.method!=='POST'||await hash(req.headers.get('x-worker-token')||'')!=='23e1f582b365ed01306845629a479f8847b95014492482948ec2446cc40afa9a')return new Response('Unauthorized',{status:401});
 try{
  const input=await req.json(),mosad=String(input.mosad||'');if(!/^[1-9]\d{2,14}$/.test(mosad))throw Error('invalid_institution');
  const db=createClient(env('SUPABASE_URL'),env('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false}});
  const result=await db.from('vendpay_nedarim_connections').select('tenant_id').eq('mosad',mosad).single();const tenant=result.data?.tenant_id;if(result.error||!tenant)throw Error('connection_missing');
  if(input.mode==='probe'){const groups=await readCategories(mosad,await passwordFor(db,mosad,tenant));return Response.json({mode:'read_only',categories:groups.map(g=>({id:String(g.id),name:g.Name,minimum:g.Amount}))});}
  if(input.mode!=='run')throw Error('invalid_mode');
  return Response.json(await syncPrices(db,mosad,tenant));
 }catch(e){return Response.json({error:e instanceof Error&&/^[a-z_]+$/.test(e.message)?e.message:'pricing_failed'},{status:502});}
});

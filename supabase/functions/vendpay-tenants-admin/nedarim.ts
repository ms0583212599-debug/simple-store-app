import {priceAdmin} from './price-admin.ts';
const normal=(s:unknown)=>typeof s==='string'?s.normalize('NFC').trim():'';
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function categories(mosad:string){
 const r=await fetch('https://www.matara.pro/nedarimplus/online/Files/Manage.aspx?'+new URLSearchParams({Action:'GetMosad',MosadId:mosad,S:''}),{redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('category_provider');const data=await r.json();
 if(String(data.MosadNumber)!==mosad)throw Error('institution_mismatch');
 let groups:any[]=[];
 if(data.NewGroupe){const value=typeof data.NewGroupe==='string'?JSON.parse(data.NewGroupe):data.NewGroupe;if(!Array.isArray(value))throw Error('category_shape');groups=value;}
 else if(typeof data.Groupe==='string')groups=data.Groupe.split(',').filter(Boolean).map(Name=>({Name}));
 const items=groups.map(g=>({id:String(g.id??''),name:normal(g.Name),redirected:!!g.GoToMosad||!!g.GoToTofes})).filter(g=>g.name&&g.name.length<=120);
 return {institution_name:String(data.MosadName||''),categories:items};
}
export async function nedarimAdmin(req:Request,db:any,reply:(v:any,status?:number)=>Response){
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 try{
  const raw=await req.text();if(raw.length>12000)return reply({error:'בקשה ארוכה מדי'},413);
  const input=JSON.parse(raw),tenant=input.tenant_id,action=new URL(req.url).searchParams.get('action');
  if(!uuid(tenant))return reply({error:'יש לבחור לקוח'},400);
  const t=await db.from('vendpay_tenants').select('id').eq('id',tenant).maybeSingle();if(t.error||!t.data)return reply({error:'הלקוח אינו קיים'},404);
  const connection=await db.from('vendpay_nedarim_connections').select('mosad,updated_at').eq('tenant_id',tenant).maybeSingle();if(connection.error)throw Error('database');
  const current=connection.data;
  if(action==='np_load'){
   if(!current)return reply({connection:null,rules:[],state:null,events:[]});
   const [rules,state,events]=await Promise.all([
    db.from('vendpay_nedarim_rules').select('rules').eq('mosad',current.mosad).single(),
    db.from('vendpay_nedarim_worker_state').select('enabled,initialized,activated_at,last_run_at,last_error').eq('mosad',current.mosad).single(),
    db.from('vendpay_nedarim_events').select('transaction_id,category,card_number,action,status,target_date,created_at').eq('mosad',current.mosad).eq('tenant_id',tenant).order('created_at',{ascending:false}).limit(50)
   ]);
   if(rules.error||state.error||events.error)throw Error('database');
   return reply({connection:current,rules:rules.data.rules,state:state.data,events:events.data.map(e=>({...e,card_number:e.card_number?'…'+e.card_number.slice(-4):null}))});
  }
  if(action==='np_connect'){
   const mosad=normal(input.mosad);if(!/^[1-9]\d{2,14}$/.test(mosad))return reply({error:'יש להזין מספר מוסד תקין'},400);
   const password=typeof input.api_password==='string'?input.api_password.trim():'';
   if(!password||password.length>2000||/[\u0000-\u001f]/.test(password))return reply({error:'יש להזין מפתח API למוסד שנבחר'},400);
   const check=await fetch('https://matara.pro/nedarimplus/Reports/Manage3.aspx?'+new URLSearchParams({Action:'GetHistoryJson',MosadId:mosad,ApiPassword:password,MaxId:'1',LastId:'0'}),{redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!check.ok)throw Error('credentials');const data=await check.json(),rows=Array.isArray(data)?data:data?.Data||data?.data;
   if(!Array.isArray(rows))return reply({error:'פרטי החיבור לא אושרו בנדרים פלוס'},400);
   const secret=Deno.env.get('VENDPAY_TENANT_ENCRYPTION_KEY')||'';if(secret.length!==64)throw Error('configuration');
   const enc=new TextEncoder(),bytes=/^[0-9a-f]{64}$/i.test(secret)?Uint8Array.from(secret.match(/../g)!,h=>parseInt(h,16)):new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(secret)));
   const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']),iv=crypto.getRandomValues(new Uint8Array(12));
   const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('vendpay-nedarim:'+mosad)},key,enc.encode(password)));
   const b64=(v:Uint8Array)=>btoa(Array.from(v,b=>String.fromCharCode(b)).join(''));
   const result=await db.rpc('vendpay_nedarim_connect',{p_tenant:tenant,p_mosad:mosad,p_ciphertext:b64(encrypted),p_iv:b64(iv)});
   if(result.error){
    const msg=result.error.message||'';
    return reply({error:msg.includes('worker_busy')?'מתבצעת כרגע בדיקת תשלומים. נסו שוב בעוד כמה שניות.':msg.includes('institution_in_use')||msg.includes('institution_has_other_history')?'המוסד כבר משויך ללקוח אחר.':'שמירת החיבור נכשלה'},409);
   }
   return reply({saved:true,mosad});
  }
  if(!current||input.mosad!==current.mosad)return reply({error:'חיבור הלקוח השתנה. רעננו את החלון.'},409);
  if(action==='np_price_load'||action==='np_price_save')return priceAdmin(db,input,tenant,current.mosad,action,reply);
  if(action==='np_categories')return reply(await categories(current.mosad));
  if(action==='np_rule_save'||action==='np_rule_delete'){
   const remove=action==='np_rule_delete',id=input.id||null;if(id&&!uuid(id))return reply({error:'מזהה כלל לא תקין'},400);
   if(remove&&!id)return reply({error:'יש לבחור כלל למחיקה'},400);
   let rule=null;
   if(!remove){
    const category=normal(input.category);
    if(!category||category.length>120||!['open','renew','both'].includes(input.rule_action))return reply({error:'בחרו קטגוריה ופעולה'},400);
    const saved=await db.from('vendpay_nedarim_rules').select('rules').eq('mosad',current.mosad).single();if(saved.error)throw Error('database');
    const existing=saved.data.rules.find(r=>r.id===id);
    if(existing?.category!==category){
     const list=await categories(current.mosad),match=list.categories.find(g=>g.name===category);
     if(!match||match.redirected)return reply({error:'הקטגוריה אינה זמינה במוסד זה. רעננו את הרשימה.'},400);
    }
    rule={id:id||crypto.randomUUID(),category,tenant_id:tenant,action:input.rule_action,expiry_mode:'ivr_next_month',member_field:'Comments'};
   }
   const result=await db.rpc('vendpay_nedarim_rule_change',{p_tenant:tenant,p_mosad:current.mosad,p_id:id,p_rule:rule,p_delete:remove});
   if(result.error)return reply({error:result.error.message?.includes('duplicate_category')?'כבר קיים כלל לקטגוריה זו. ערכו את הכלל הקיים.':'הכלל השתנה או שהשמירה נכשלה. רעננו ונסו שוב.'},409);
   return reply({saved:true,rules:result.data});
  }
  return reply({error:'פעולה לא מוכרת'},400);
 }catch{return reply({error:'לא ניתן להשלים את הבקשה. בדקו את פרטי החיבור ונסו שוב.'},502);}
}

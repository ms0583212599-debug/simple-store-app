const STORE='https://ksddrcalmszxxcuxoznd.supabase.co';
const PUBLIC_KEY='sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR';
const OWNER='56ae10cb-f40c-4a41-8112-ab8c9f1616c8';
const origins=new Set(['https://simple-store-app-ms0583212599-1490s-projects.vercel.app','https://simple-store-app-ten.vercel.app','https://simple-store-app-git-main-ms0583212599-1490s-projects.vercel.app']);
export async function handler(req){
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(origins.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}:{})};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(!origins.has(origin))return reply({error:'כתובת האתר אינה מורשית'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(req.method))return reply({error:'פעולה אינה נתמכת'},405);
 const authorization=req.headers.get('authorization')||'';
 if(!/^Bearer \S+$/.test(authorization))return reply({error:'יש להתחבר לחשבון המנהל'},401);
 try{
  // Verify the existing store administrator account; never trust decoded JWT claims.
  const auth=await fetch(STORE+'/auth/v1/user',{headers:{apikey:PUBLIC_KEY,authorization},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply({error:'ההתחברות פגה יש להתחבר מחדש'},401);
  const user=await auth.json();
  if(user.id!==OWNER||user.is_anonymous)return reply({error:'אין הרשאה לחשבון זה'},403);
  const p=new URL(req.url).searchParams;
  if(p.get('action')==='categories') {
   const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
   const dbHeaders={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
   if(req.method==='GET'){
    const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/finance_categories?select=id,kind,name,dial_code,active,revision&order=kind,dial_code',{headers:dbHeaders,signal:AbortSignal.timeout(8000)});
    if(!r.ok)return reply({error:'טעינת הקטגוריות נכשלה'},502);
    return reply({categories:await r.json()});
   }
   const raw=await req.text();if(raw.length>2000)return reply({error:'בקשה ארוכה מדי'},400);
   let b;try{b=JSON.parse(raw);}catch{return reply({error:'בקשה לא תקינה'},400);}
   if(!b||typeof b.name!=='string'||!['income','expense'].includes(b.kind)||(b.id!==null&&(!Number.isSafeInteger(b.id)||b.id<1))||(b.id!==null&&(!Number.isSafeInteger(b.revision)||b.revision<1)))return reply({error:'פרטי הקטגוריה אינם תקינים'},400);
   const name=b.name.normalize('NFC').trim();
   if(!name||name.length>60||/[.=&<>\u0000-\u001f\u007f]/.test(name))return reply({error:'שם הקטגוריה צריך להכיל עד 60 תווים ללא נקודה או הסימנים שווה ואמפרסנד וסוגריים זוויתיים'},400);
   const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/finance_category_save',{method:'POST',headers:dbHeaders,body:JSON.stringify({p_id:b.id,p_kind:b.kind,p_name:name,p_revision:b.id===null?null:b.revision}),signal:AbortSignal.timeout(8000)});
   const d=await r.json();
   if(!r.ok){const errors={duplicate_name:'כבר קיימת קטגוריה בשם זה',no_free_key:'כל תשעת המקשים תפוסים בסוג פעולה זה',kind_locked:'לא ניתן להעביר קטגוריה בין הכנסות להוצאות',category_changed:'הקטגוריה עודכנה בחלון אחר יש לרענן ולערוך שוב',category_missing:'הקטגוריה אינה קיימת',invalid_category:'שם הקטגוריה אינו תקין'};return reply({error:errors[d.message]||'שמירת הקטגוריה נכשלה'},409);}
   return reply({category:d});
  }
  if(req.method!=='GET')return reply({error:'פעולה אינה נתמכת'},405);
  const date=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
  const from=p.get('from'),to=p.get('to'),kind=p.get('kind')||null,type=p.get('type')||null,cat=p.get('category')||null,page=p.get('page')||'0';
  if(!date(from)||!date(to)||from>to||(kind&&!['income','expense'].includes(kind))||(type&&!['current','fixed','exceptional','unclassified'].includes(type))||(cat&&!/^[1-9]\d{0,14}$/.test(cat))||!/^\d{1,6}$/.test(page)||Number(page)>100000)return reply({error:'יש לבדוק את הסינון וטווח התאריכים'},400);
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const r=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/finance_dashboard_read',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({p_from:from,p_to:to,p_kind:kind,p_type:type,p_category:cat?Number(cat):null,p_page:Number(page)}),signal:AbortSignal.timeout(12000)});
  if(!r.ok)return reply({error:'לא ניתן לטעון את הנתונים כרגע'},502);
  return reply(await r.json());
 }catch{return reply({error:'החיבור לא הצליח נסו שוב'},502);}
}
Deno.serve(handler);

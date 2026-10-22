import {auth,normalizePhone,digest,db,allowed,providerPending}from './shared.ts';
import {createFlow}from './ledger-phone.ts';
const KEY_HASH='12ccca974400e26882199733fa1ebdc6b3654e62ec08fd1f04f47d9e5558ec02';
const clean=s=>String(s||'').replace(/[.=&<>\r\n]/g,' '),response=s=>new Response(s,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
export async function handler(req){
 try{
 if(!['GET','POST'].includes(req.method))return response('');
 const p=new URL(req.url).searchParams;if(p.get('health')==='1')return response('finance multi account v1 registration pending provider approval');
 if(req.method==='POST'){const raw=await req.text();if(raw.length>64000)return response('');for(const[k,v]of new URLSearchParams(raw))p.append(k,v);}
 for(const k of new Set(p.keys()))if(p.getAll(k).length>1)throw Error('התקבל ערך כפול יש להיכנס מחדש לשלוחה');
 if(await digest(p.get('finance_key')||'')!==KEY_HASH)return response('id_list_message=t-מפתח החיבור אינו תקין');
 if(p.has('hangup'))return response('');
 const call=p.get('ApiCallId')||'',phone=normalizePhone(p.get('ApiPhone'));
 if(!/^[A-Za-z0-9_-]{8,160}$/.test(call)||!/^0[2-9]\d{7,8}$/.test(phone))throw Error('יש להתקשר ממספר גלוי');
 const id=await digest(call+':'+phone+':'+(p.get('ApiExtension')||''));let row=(await db('finance_entry_calls?id=eq.'+id))[0];
 if(!row){await db('finance_entry_calls?on_conflict=id',[{id,phone,state:{stage:'login'}}]);row=(await db('finance_entry_calls?id=eq.'+id))[0];}
 if(row.account_id&&new Date(row.authenticated_until)>new Date()){
  const access=await allowed(row.account_id).then(()=>true).catch(()=>false);
  if(!access){const q='cancel'+row.seq;if(p.get(q)==='1'){const {billing}=await import('./shared.ts');const subs=(await billing(row.account_id,'mine')).subscriptions;for(const s of subs.filter(s=>s.service_name==='ניהול כלכלה'))await billing(row.account_id,'cancel',{service_id:s.service_id});return response('id_list_message=t-המנוי בוטל');}return response('read=t-נדרש מנוי פעיל לשירות לביטול המנוי הקישו 1='+q+',,1,1,30,NO,no');}
  return createFlow(row.account_id).handler(new Request('https://finance.local/?'+p));
 }
 const key='login'+row.seq,v=p.get(key);
 if(v===null)return response('read=t-מספר הטלפון מזהה את החשבון הקישו קוד אישי וסולמית להרשמה או איפוס קוד הקישו 0 וסולמית='+key+',,12,1,30,NO,no');
 if(v==='0')return response('id_list_message=t-'+clean(providerPending));
 let data;try{data=await auth('login',{phone,pin:v,channel:'phone'});}catch(e){await db('finance_entry_calls?id=eq.'+id+'&seq=eq.'+row.seq,{seq:row.seq+1},'PATCH');return response('read=t-'+clean(e.message)+' הקישו שוב את הקוד האישי וסולמית=login'+(row.seq+1)+',,12,6,30,NO,no');}
 const updated=await db('finance_entry_calls?id=eq.'+id+'&seq=eq.'+row.seq,{account_id:data.account_id,authenticated_until:new Date(Date.now()+3600000).toISOString(),seq:row.seq+1},'PATCH');
 if(!updated.length)throw Error('הבקשה כבר טופלה יש להיכנס מחדש לשלוחה');
 return createFlow(data.account_id).handler(new Request('https://finance.local/?'+p));
 }catch(e){return response('id_list_message=t-'+clean(e.message||'אירעה תקלה זמנית'));}
}
if(import.meta.main)Deno.serve(handler);

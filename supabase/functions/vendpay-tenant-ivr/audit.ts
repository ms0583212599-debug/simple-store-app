// Only allowlisted metadata is persisted. Never store request/response bodies or credentials.
const digest=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,'0')).join('');
export function withAudit(handler:(req:Request)=>Promise<Response>,source:string){return async(req:Request)=>{
 const start=Date.now();let p=new URLSearchParams();
 try{const u=new URL(req.url);p=new URLSearchParams(u.search);if(req.method==='POST'&&(req.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded')){const raw=await req.clone().text();if(raw.length<=24000)for(const [k,v] of new URLSearchParams(raw))p.append(k,v);}}catch{}
 let response:Response;try{response=await handler(req);}catch{response=new Response('id_list_message=t-לא ניתן להשלים כעת את הפעולה',{status:500});}
 const record=async()=>{try{
 const text=await response.clone().text();
 let result=response.headers.get('X-Admin-Result')||response.headers.get('X-Edit-Result')||response.headers.get('X-Door-Result')||'';
 if(!/^[a-z_0-9]{1,100}$/.test(result))result='';
 const known:Record<string,string>={
 'פקודת הפתיחה נשלחה':'command_sent','פקודת הפתיחה כבר נשלחה':'duplicate',
 'הבקשה הקודמת בטיפול לא נשלחה שוב':'uncertain','תוצאת הבקשה לא ודאית בדקו את הדלת':'uncertain',
 'אין הרשאה':'unauthorized','שלוחת הלקוח אינה פעילה':'inactive','השיחה הסתיימה':'hangup',
 'לא הצלחנו להתחבר לחשבון הלקוח':'authentication_failed','לא התקבל אישור התחברות':'authentication_failed',
 'החיבור לחשבון הלקוח תקין':'check_ok','חיבור שלוחת הלקוח תקין':'health','חיבור שלוחת ניהול הלקוח תקין':'health',
 'בדיקת חשבון הלקוח נכשלה':'check_failed','שלוחת הלקוח טרם הוגדרה':'unconfigured',
 'יש לעדכן את פרטי התחברות הלקוח':'credentials_required','חסרים פרטי שיחה':'missing_call',
 'פעולה לא נתמכת':'invalid_action','הבקשה כבר בטיפול או שלא ניתן לשמור אותה':'busy'};
 if(!result)result=known[text.replace(/^id_list_message=t-/,'')]||(response.status===401?'unauthorized':text.startsWith('read=')?'prompt':'error');
 const action=source==='vendpay-admin-users'?'create':source==='vendpay-admin-edit'?'edit':p.get('action');
 const tenant=p.get('tenant_id');const validTenant=tenant&&/^[0-9a-f-]{36}$/i.test(tenant)&&!['unauthorized','invalid_input'].includes(result)?tenant:null;
 const call=p.get('ApiCallId'),did=p.get('ApiDID');
 const row={tenant_id:validTenant,source,action:['open','create','edit','check','health'].includes(action||'')?action:'request',result,http_status:response.status,duration_ms:Math.min(Date.now()-start,2147483647),call_hash:call&&did&&call.length<=200&&did.length<=30?await digest(source+'|'+(tenant||'legacy')+'|'+did+'|'+call):null};
 const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const r=await fetch((Deno.env.get('SUPABASE_URL')||'')+'/rest/v1/vendpay_operation_log',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(row),signal:AbortSignal.timeout(2000)});
 if(!r.ok)console.log(JSON.stringify({event:'vendpay_audit_failed',source}));await r.body?.cancel();
 }catch{console.log(JSON.stringify({event:'vendpay_audit_failed',source}));}};
 const pending=record();const runtime=(globalThis as any).EdgeRuntime;if(runtime?.waitUntil)runtime.waitUntil(pending);else await pending;
 return response;
};}


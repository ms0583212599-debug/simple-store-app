const URL='https://matara.pro/nedarimplus/Reports/Manage3.aspx';
export async function passwordFor(db:any,mosad:string,tenant:string){
 const result=await db.from('vendpay_nedarim_connections').select('ciphertext,iv').eq('mosad',mosad).eq('tenant_id',tenant).single();if(result.error||!result.data)throw Error('connection_changed');
 const c=result.data,secret=Deno.env.get('VENDPAY_TENANT_ENCRYPTION_KEY')||'',enc=new TextEncoder();
 if(secret.length!==64)throw Error('configuration');
 const raw=/^[0-9a-f]{64}$/i.test(secret)?Uint8Array.from(secret.match(/../g)!,h=>parseInt(h,16)):new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(secret)));
 const key=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']),decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(c.iv),additionalData:enc.encode('vendpay-nedarim:'+mosad)},key,decode(c.ciphertext)));
}
export async function readCategories(mosad:string,password:string){
 const p=new URLSearchParams({Action:'GetNewGroupe',MosadId:mosad,ApiPassword:password});
 const r=await fetch(URL+'?'+p,{redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('category_read_failed');const data=await r.json();
 if(!Array.isArray(data)||data.some(g=>!g||!/^[1-9]\d{0,14}$/.test(String(g.id))||typeof g.Name!=='string'))throw Error('category_permission');
 return data;
}
export async function writeMinimum(mosad:string,password:string,category:any,amount:number){
 // Only Id, unchanged Name and Amount are written. Never send fundraising totals or unrelated settings.
 const p=new URLSearchParams({Action:'SaveEditGroupe',MosadId:mosad,ApiPassword:password,Id:String(category.id),Name:category.Name,Amount:(amount/100).toFixed(2)});
 const r=await fetch(URL+'?'+p,{redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('price_write_failed');const data=await r.json();if(data.Status!=='OK'||data.Result==='Error')throw Error('price_write_not_confirmed');
}

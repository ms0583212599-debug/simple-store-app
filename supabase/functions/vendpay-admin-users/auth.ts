const AUTH_URL='https://vendpay24.com/VendPayDeltaHeb/authenticate?lang=heb&apiloc=VendPayDeltaHeb';
const CHECK_URL='https://vendpay24.com/VendPayDeltaHeb/terminal/getOnline?lang=heb&apiloc=VendPayDeltaHeb';
let cachedToken: string|undefined;
let refreshing: Promise<string>|undefined;
let retryAfter=0;
export class AuthFailure extends Error {}
async function refresh(): Promise<string> {
  if (refreshing) return refreshing;
  if (Date.now()<retryAfter) throw new AuthFailure();
  refreshing=(async()=>{
    let stage='missing_auth_secret';
    try {
      const raw=Deno.env.get('VENDPAY_AUTH_JSON');
      if (!raw) throw new Error();
      stage='invalid_auth_json';
      const payload=JSON.parse(raw);
      stage='missing_login_fields';
      if (!payload || Array.isArray(payload) || typeof payload.username!=='string' || typeof payload.password!=='string' || !payload.username || (!payload.password && !(typeof payload.code==='string' && payload.code.length>0))) throw new Error();
      stage='auth_network_error';
      const response=await fetch(AUTH_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),redirect:'manual',signal:AbortSignal.timeout(5000)});
      stage='auth_http_'+response.status;
      if (!response.ok) throw new Error();
      stage='invalid_auth_response';
      const result=await response.json();
      if (typeof result.token!=='string' || result.token.length<20 || /\s/.test(result.token)) throw new Error();
      cachedToken=result.token;
      console.log(JSON.stringify({event:'vendpay_auth',result:'renewed'}));
      return cachedToken!;
    } catch {
      retryAfter=Date.now()+60000;
      console.log(JSON.stringify({event:'vendpay_auth',result:'renewal_failed',reason:stage}));
      throw new AuthFailure(stage);
    } finally {refreshing=undefined;}
  })();
  try {return await refreshing;} finally {refreshing=undefined;}
}
export async function authenticatedCheck(): Promise<{token:string,response:Response}> {
  let token=cachedToken || Deno.env.get('VENDPAY_TOKEN');
  if (!token) token=await refresh();
  const check=(t:string)=>fetch(CHECK_URL,{headers:{Authorization:`Bearer ${t}`,Accept:'application/json, text/plain, */*'},redirect:'manual',signal:AbortSignal.timeout(4000)});
  let response=await check(token);
  if (response.status===401 || response.status===403) {
    await response.body?.cancel();
    // Only retry the read-only check; never replay a door-opening request.
    if (cachedToken && cachedToken!==token) token=cachedToken;
    else token=await refresh();
    response=await check(token);
  }
  if (response.status===401 || response.status===403) {
    await response.body?.cancel();cachedToken=undefined;retryAfter=Date.now()+60000;throw new AuthFailure();
  }
  return {token,response};
}



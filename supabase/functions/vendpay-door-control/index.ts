import {withVoice} from './voice.ts';
import {voice} from './voice.ts';
import {withAudit} from './audit.ts';
import { authenticatedCheck, AuthFailure } from './auth.ts';
import { readParameters, uniqueValue } from './parameters.ts';
const BASE = 'https://vendpay24.com/VendPayDeltaHeb/terminal/';
export async function handler(req: Request): Promise<Response> {
  const headers = {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Door-Revision':'yemot-auto-auth-1'};
  const reply = (result: string, message: string, upstream?: number) => {
    console.log(JSON.stringify({event:'door_result',revision:'yemot-auto-auth-1',result,upstream}));
    return new Response(`id_list_message=t-${message}`,{status:200,headers:{...headers,'X-Door-Result':result}});
  };
  if (!['GET','POST'].includes(req.method)) return new Response('Method Not Allowed',{status:405,headers});
  let p: URLSearchParams;
  try { p=await readParameters(req); } catch { return reply('invalid_parameters',voice('v_ca5695ad651c138ae5ab',["שגיאה בפרמטרים"])); }
  // Yemot sends a second request on hangup. It must never open the door.
  if (p.getAll('hangup').includes('yes')) return reply('hangup_ignored',voice('v_c0ba9b9459404581cc5e',["השיחה הסתיימה"]));
  const action=uniqueValue(p,'action');
  if (action==='health') return reply('health',voice('v_2af7923b426842801a7e',["שירות הדלת מוכן"]));
  if (action!=='open' && action!=='check') return reply('invalid_action',voice('v_ccd88e55dbb7365bfee6',["לא התקבלה פקודת פתיחה תקינה"]));

  const url=new URL(BASE+(action==='open'?'setTerminalGateStatus':'getOnline'));
  if (action==='open') {url.searchParams.set('terminal_id','1');url.searchParams.set('gate_status','2');}
  url.searchParams.set('lang','heb');url.searchParams.set('apiloc','VendPayDeltaHeb');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const checked=await authenticatedCheck();
    const token=checked.token;
    let response=checked.response;
    if (action==='open') {
      const checkBody=await response.text();
      let checkData: any;
      try {checkData=JSON.parse(checkBody);} catch {}
      if (!response.ok || /^\s*</.test(checkBody) || /\b(unauthorized|forbidden|invalid token|token expired)\b/i.test(checkBody) || (checkData && (checkData.success===false || checkData.ok===false || checkData.error || checkData.status==='error'))) return reply('preflight_failed',voice('v_4aef9d31ca06bdb587fd',["בדיקת החיבור למערכת הדלת נכשלה"]),response.status);
      if(controller.signal.aborted) return reply('connection_error',voice('v_a8cb6a524749ec681196',["תקלה בתקשורת עם מערכת הדלת"]));
      response=await fetch(url,{method:'GET',headers:{Authorization:`Bearer ${token}`,Accept:'application/json, text/plain, */*'},redirect:'manual',signal:controller.signal});
    }
    const body=await response.text();
    if (response.status===401 || response.status===403) return reply('authentication_failed',voice('v_805a8dc56da7f1c96693',["נדרש חידוש החיבור למערכת הדלת"]),response.status);
    if (!response.ok) return reply('upstream_http_error',voice('v_c76f79256c6544a1e993',["מערכת הדלת החזירה שגיאה"]),response.status);
    let parsed: any;
    try {parsed=JSON.parse(body);} catch { /* Unknown text is not proof of success. */ }
    const error = parsed && typeof parsed==='object' && !Array.isArray(parsed) && (parsed.success===false || parsed.ok===false || Boolean(parsed.error) || parsed.status==='error');
    if (error) return reply('upstream_application_error',voice('v_12534d5aa303b446dd19',["מערכת הדלת דיווחה על שגיאה"]),response.status);
    if (/^\s*</.test(body) || /\b(unauthorized|forbidden|invalid token|token expired)\b/i.test(body)) return reply('upstream_unexpected',voice('v_2a00f598883c0c524992',["לא התקבל אישור תקין ממערכת הדלת"]),response.status);
    // HTTP receipt is recorded separately from physical door confirmation.
    return action==='check' ? reply('check_http_ok',voice('v_48e933fe75e6de57dde2',["בדיקת התקשורת הסתיימה"]),response.status) : reply('command_http_ok',voice('v_c1aea471315f4011f2f8',["פקודת הפתיחה נשלחה"]),response.status);
  } catch (error) {if(error instanceof AuthFailure) return reply('authentication_failed_'+(error.message || 'rejected'),voice('v_abfd2a106d770d7ce785',["לא הצלחנו לחדש את החיבור למערכת הדלת"])); return reply('connection_error',voice('v_a8cb6a524749ec681196',["תקלה בתקשורת עם מערכת הדלת"]));}
  finally {clearTimeout(timeout);}
}
Deno.serve(withVoice(withAudit(handler,'vendpay-door-control'),'vendpay-door-control'));


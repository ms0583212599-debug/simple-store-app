"""Approved deployed API checks: read-only readiness and nonexistent-token rejection."""
from pathlib import Path
import urllib.request,json,re,time
s=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java').read_text()
base=re.search(r'BASE\s*=\s*"([^"]+)"',s).group(1)
key=re.search(r'KEY\s*=\s*"([^"]+)"',s).group(1)
def post(path,body,authenticated=True):
 headers={'Content-Type':'application/json'}
 if authenticated:headers.update({'apikey':key,'Authorization':'Bearer '+key})
 req=urllib.request.Request(base+path,data=json.dumps(body).encode(),headers=headers)
 started=time.monotonic()
 try:
  response=urllib.request.urlopen(req,timeout=35);return response.status,json.load(response),round(time.monotonic()-started,2)
 except urllib.error.HTTPError as e:return e.code,json.loads(e.read()),round(time.monotonic()-started,2)
status,ready,elapsed=post('/functions/v1/nedarim-online-capability',{'action':'ready'})
assert status==200,(status,ready)
if ready.get('enabled'):
 assert ready.get('ready') and isinstance(ready.get('baseline'),int) and re.fullmatch('[0-9]{7}',ready.get('mosad',''))
assert 'api_password' not in ready and 'api_valid' not in ready
missing,body,_=post('/functions/v1/verify-nedarim-online-sale',{'saleToken':'audit-nonexistent-token-123456789'})
assert missing==404 and body.get('error')=='sale',(missing,body)
unauth,_,_=post('/functions/v1/nedarim-online-capability',{'action':'ready'},False)
assert unauth==401,unauth
rpc,denied,_=post('/rest/v1/rpc/finalize_nedarim_online_sale',{'p_sale_id':'00000000-0000-0000-0000-000000000000','p_payment_reference':'audit-fixture-only'})
assert rpc in (401,403) and denied.get('code')=='42501',(rpc,denied)
result={'ready_http':status,'enabled':ready.get('enabled'),'ready':ready.get('ready'),'baseline_present':'baseline' in ready,'ready_seconds':elapsed,'missing_sale_http':missing,'unauthenticated_http':unauth,'direct_finalization_denied':True,'secrets_absent':True}
print(json.dumps(result))
Path('nedarim-readonly-result.json').write_text(json.dumps(result))

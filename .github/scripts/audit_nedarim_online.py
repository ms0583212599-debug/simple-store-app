"""Read-only deployed API checks. Never supplies a real sale token."""
from pathlib import Path
import urllib.request,json,re
s=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java').read_text()
base=re.search(r'BASE\s*=\s*"([^"]+)"',s).group(1)
key=re.search(r'KEY\s*=\s*"([^"]+)"',s).group(1)
def post(body):
 r=urllib.request.Request(base+'/functions/v1/nedarim-online-capability',data=json.dumps(body).encode(),headers={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'})
 try:return {'http':200,'body':json.load(urllib.request.urlopen(r,timeout=35))}
 except urllib.error.HTTPError as e:return {'http':e.code,'body':json.loads(e.read())}
result={'ready':post({'action':'ready'}),'schema':post({'action':'schema'})}
print(json.dumps(result,ensure_ascii=False))
Path('nedarim-readonly-result.json').write_text(json.dumps(result,ensure_ascii=False))
assert result['schema']['http']==200

# Verify approved receipt types from provider metadata only.

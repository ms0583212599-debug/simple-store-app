from pathlib import Path
import urllib.request,json,hashlib,concurrent.futures
expected=10075
sha='21842bbebe085ddb7302d8273dfdad8afbd2b391d69e5e5e22bdea4da70114c4'
urls={'GitHub':'https://raw.githubusercontent.com/ms0583212599-debug/simple-store-app/main/updates/version.json','Supabase':'https://ksddrcalmszxxcuxoznd.supabase.co/functions/v1/android-update-proxy?file=version','Vercel':'https://simple-store-app-ms0583212599-1490s-projects.vercel.app/updates/version.json'}
def check(item):
 name,url=item
 data=json.load(urllib.request.urlopen(url,timeout=25))
 assert data['versionCode']==expected and data['apkSha256']==sha,(name,data.get('versionCode'))
 return name,{'version':expected,'sha_matches':True}
with concurrent.futures.ThreadPoolExecutor() as pool:result=dict(pool.map(check,urls.items()))
url='https://ksddrcalmszxxcuxoznd.supabase.co/functions/v1/android-update-proxy?file=apk&v=10075'
b=urllib.request.urlopen(url,timeout=25).read()
assert hashlib.sha256(b).hexdigest()==sha
result['public_apk']={'size':len(b),'sha_matches':True}
print(json.dumps(result))
Path('nedarim-readonly-result.json').write_text(json.dumps(result))

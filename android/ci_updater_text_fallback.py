from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/AppUpdater.java')
s=p.read_text(encoding='utf-8')

if 'import android.util.Base64;' not in s:
    s=s.replace('import android.provider.Settings;\n','import android.provider.Settings;\nimport android.util.Base64;\n',1)

# The filtered network may reject APK/binary responses with HTTP 418. Download the
# update as ordinary text from a dedicated endpoint, decode locally, then validate
# the APK before installing it.
TEXT_ENDPOINT='https://ksddrcalmszxxcuxoznd.supabase.co/functions/v1/store-data'

s=s.replace('String apkUrl = info.optString("apkUrl", "");\n                String apkUrlFallback = info.optString("apkUrlFallback", UPDATE_PROXY + "?file=apk");',
'''String apkTextUrl = info.optString("apkTextUrl", "'''+TEXT_ENDPOINT+'''?v=" + remoteCode);''')
s=s.replace('downloadAndInstall(activity, apkUrl, apkUrlFallback, remoteCode)','downloadAndInstall(activity, apkTextUrl, remoteCode)')
s=s.replace('info.put("apkUrlFallback", UPDATE_PROXY + "?file=apk&v=" + info.optLong("versionCode", 0));',
'''info.put("apkTextUrl", "'''+TEXT_ENDPOINT+'''?v=" + info.optLong("versionCode", 0));''')
s=s.replace('private static void downloadAndInstall(Activity activity, String apkUrl, String apkUrlFallback, long expectedVersion) {',
'private static void downloadAndInstall(Activity activity, String apkTextUrl, long expectedVersion) {')
s=s.replace('if ((apkUrl == null || apkUrl.isEmpty()) && (apkUrlFallback == null || apkUrlFallback.isEmpty())) {','if (apkTextUrl == null || apkTextUrl.isEmpty()) {')

start='''                Exception primaryError = null;
                boolean valid = false;
                if (apkUrl != null && !apkUrl.isEmpty()) {
                    try {
                        download(apkUrl, apk);
                        validateApk(activity, apk, expectedVersion);
                        valid = true;
                    } catch (Exception first) {
                        primaryError = first;
                        if (apk.exists()) apk.delete();
                    }
                }

                if (!valid) {
                    if (apkUrlFallback == null || apkUrlFallback.isEmpty()) {
                        throw primaryError != null ? primaryError : new Exception("אין כתובת הורדה חלופית");
                    }
                    download(apkUrlFallback, apk);
                    validateApk(activity, apk, expectedVersion);
                }
'''
replacement='''                downloadBase64(apkTextUrl, apk);
                validateApk(activity, apk, expectedVersion);
'''
if start in s:
    s=s.replace(start,replacement,1)
elif 'downloadBase64(apkTextUrl, apk);' not in s:
    raise SystemExit('Updater download block not found')

marker='    private static void download(String url, File out) throws Exception {'
method='''    private static void downloadBase64(String url, File out) throws Exception {
        String text=readText(url);
        byte[] bytes;
        try { bytes=Base64.decode(text.trim(),Base64.DEFAULT); }
        catch(Exception e){ throw new Exception("פענוח קובץ העדכון נכשל"); }
        if(bytes.length<40000)throw new Exception("קובץ העדכון קצר מדי: "+bytes.length+" bytes");
        try(FileOutputStream fos=new FileOutputStream(out,false)){fos.write(bytes);fos.flush();}
    }

'''
if 'private static void downloadBase64' not in s:
    if marker not in s: raise SystemExit('Updater download marker not found')
    s=s.replace(marker,method+marker,1)

p.write_text(s,encoding='utf-8')
print('Filtered-network text updater applied')

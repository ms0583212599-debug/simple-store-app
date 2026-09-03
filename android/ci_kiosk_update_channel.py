from pathlib import Path

p = Path('app/src/main/java/com/simplestore/tablet/AppUpdater.java')
s = p.read_text(encoding='utf-8')

old_urls = '''    private static final String[] VERSION_URLS = new String[] {
            UPDATE_PROXY + "?file=version",
            "https://raw.githubusercontent.com/ms0583212599-debug/simple-store-app/main/updates/version.json",
            "https://simple-store-app-ms0583212599-1490s-projects.vercel.app/updates/version.json"
    };'''
new_urls = '''    private static final String[] VERSION_URLS = new String[] {
            "https://raw.githubusercontent.com/ms0583212599-debug/simple-store-app/feature/kiosk-current/updates/kiosk-version.json"
    };'''

if old_urls in s:
    s = s.replace(old_urls, new_urls, 1)
elif new_urls not in s:
    raise SystemExit('VERSION_URLS marker not found')

old_fallback = 'String apkUrlFallback = info.optString("apkUrlFallback", UPDATE_PROXY + "?file=apk");'
new_fallback = 'String apkUrlFallback = info.optString("apkUrlFallback", "");'
if old_fallback in s:
    s = s.replace(old_fallback, new_fallback, 1)
elif new_fallback not in s:
    raise SystemExit('apkUrlFallback marker not found')

old_auto_fallback = '''                if (baseUrl.contains("raw.githubusercontent.com") || baseUrl.contains("vercel.app")) {
                    info.put("apkUrlFallback", UPDATE_PROXY + "?file=apk&v=" + info.optLong("versionCode", 0));
                }
'''
if old_auto_fallback in s:
    s = s.replace(old_auto_fallback, '', 1)

p.write_text(s, encoding='utf-8')
print('kiosk-specific update channel configured')

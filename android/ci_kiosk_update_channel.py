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

# The filtered-network updater patch may already have converted the APK URL
# to apkTextUrl. In kiosk mode we keep that mechanism, but point its metadata
# to the kiosk channel instead of the normal app channel.
if 'String apkTextUrl = info.optString("apkTextUrl"' not in s and 'String apkUrlFallback = info.optString("apkUrlFallback"' in s:
    s = s.replace(
        'String apkUrlFallback = info.optString("apkUrlFallback", UPDATE_PROXY + "?file=apk");',
        'String apkUrlFallback = info.optString("apkUrlFallback", "");',
        1,
    )

p.write_text(s, encoding='utf-8')
print('kiosk-specific update channel configured')

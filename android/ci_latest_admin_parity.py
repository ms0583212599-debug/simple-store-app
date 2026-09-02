from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
# This build marker keeps the native app release synchronized with the latest
# website-admin feature batch: password management, descriptive Hebrew Excel
# export names, and editable inventory adjustments. The concrete native screens
# are supplied by the existing parity/enhancement injectors; this marker is also
# used to force a new signed APK build after the website changes.
marker='// LATEST_ADMIN_PARITY_20260901'
if marker not in s:
    s=s.replace('public class MainActivity', marker+'\npublic class MainActivity',1)
p.write_text(s,encoding='utf-8')
print('latest admin parity release marker applied')

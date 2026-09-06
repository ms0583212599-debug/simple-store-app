from pathlib import Path

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

field_marker = '    private boolean inventoryCountProductMode = false;\n'
field_code = '''    private boolean inventoryCountProductMode = false;\n    private int kioskAdminTapCount = 0;\n    private long kioskAdminLastTap = 0L;\n'''
if 'private int kioskAdminTapCount = 0;' not in s:
    if field_marker not in s:
        raise SystemExit('kiosk tap field insertion point not found')
    s = s.replace(field_marker, field_code, 1)

hook_marker = '        top.setPadding(dp(22),dp(14),dp(22),dp(10));\n'
hook_code = '''        top.setPadding(dp(22),dp(14),dp(22),dp(10));\n        if("ניהול".equals(title)){\n            top.setOnTouchListener((v,event)->{\n                if(event.getAction()!=android.view.MotionEvent.ACTION_DOWN)return false;\n                int width=v.getWidth();\n                if(width<=0)return false;\n                boolean inSecretCorner=event.getX()>=width-dp(130)&&event.getY()<=dp(90);\n                if(!inSecretCorner){kioskAdminTapCount=0;return false;}\n                long now=android.os.SystemClock.elapsedRealtime();\n                if(now-kioskAdminLastTap>1200)kioskAdminTapCount=0;\n                kioskAdminLastTap=now;\n                kioskAdminTapCount++;\n                if(kioskAdminTapCount>=15){\n                    kioskAdminTapCount=0;\n                    kioskAdminLastTap=0L;\n                    if(KioskManager.isDeviceOwner(this))KioskManager.exit(this);\n                }\n                return false;\n            });\n        }\n'''
if 'kioskAdminTapCount>=15' not in s:
    if hook_marker not in s:
        raise SystemExit('top bar insertion point not found')
    s = s.replace(hook_marker, hook_code, 1)

# Remove any previously injected visible kiosk-release button, if present.
start = s.find('        if(KioskManager.isDeviceOwner(this)){\n            Button releaseKiosk=button("שחרור הטאבלט ממצב נעול"')
if start != -1:
    end_marker = '            LinearLayout.LayoutParams releaseParams=new LinearLayout.LayoutParams(-1,dp(64));releaseParams.setMargins(0,0,0,dp(12));content.addView(releaseKiosk,releaseParams);\n        }\n'
    end = s.find(end_marker, start)
    if end != -1:
        s = s[:start] + s[end + len(end_marker):]

p.write_text(s, encoding='utf-8')
print('hidden 15-tap admin kiosk release applied')

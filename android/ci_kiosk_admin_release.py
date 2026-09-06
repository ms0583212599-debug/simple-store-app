from pathlib import Path

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

field_marker = '    private boolean inventoryCountProductMode = false;\n'
field_code = '''    private boolean inventoryCountProductMode = false;\n    private int kioskAdminTapCount = 0;\n    private long kioskAdminLastTap = 0L;\n'''
if 'private int kioskAdminTapCount = 0;' not in s:
    if field_marker not in s:
        raise SystemExit('kiosk tap field insertion point not found')
    s = s.replace(field_marker, field_code, 1)

brand_marker = '''        TextView brand=text(title,22,true);brand.setGravity(Gravity.CENTER);\n        top.addView(brand,new LinearLayout.LayoutParams(0,dp(52),1));'''
brand_code = '''        TextView brand=text(title,22,true);brand.setGravity(Gravity.CENTER);\n        if("ניהול".equals(title)){\n            brand.setOnClickListener(v->{\n                long now=android.os.SystemClock.elapsedRealtime();\n                if(now-kioskAdminLastTap>1200)kioskAdminTapCount=0;\n                kioskAdminLastTap=now;\n                kioskAdminTapCount++;\n                if(kioskAdminTapCount>=15){\n                    kioskAdminTapCount=0;\n                    kioskAdminLastTap=0L;\n                    if(KioskManager.isDeviceOwner(this))KioskManager.exit(this);\n                }\n            });\n        }\n        top.addView(brand,new LinearLayout.LayoutParams(0,dp(52),1));'''
if 'brand.setOnClickListener' not in s:
    if brand_marker not in s:
        raise SystemExit('admin title insertion point not found')
    s = s.replace(brand_marker, brand_code, 1)

p.write_text(s, encoding='utf-8')
print('hidden 15-tap kiosk release attached to admin title')

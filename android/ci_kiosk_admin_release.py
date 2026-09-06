from pathlib import Path

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

old = '        Button homeUse=button("שימוש עצמי",Color.WHITE,blue);homeUse.setOnClickListener(v->showHomeUseNative());LinearLayout.LayoutParams hup=new LinearLayout.LayoutParams(-1,dp(64));hup.setMargins(0,0,0,dp(12));content.addView(homeUse,hup);\n'
new = '''        Button homeUse=button("שימוש עצמי",Color.WHITE,blue);\n        final Handler kioskReleaseHandler=new Handler(Looper.getMainLooper());\n        final boolean[] kioskReleaseTriggered={false};\n        final Runnable kioskReleaseAction=()->{\n            kioskReleaseTriggered[0]=true;\n            if(KioskManager.isDeviceOwner(this))KioskManager.exit(this);\n        };\n        homeUse.setOnTouchListener((v,event)->{\n            if(event.getAction()==android.view.MotionEvent.ACTION_DOWN){\n                kioskReleaseTriggered[0]=false;\n                kioskReleaseHandler.postDelayed(kioskReleaseAction,10000);\n                return true;\n            }\n            if(event.getAction()==android.view.MotionEvent.ACTION_UP||event.getAction()==android.view.MotionEvent.ACTION_CANCEL){\n                kioskReleaseHandler.removeCallbacks(kioskReleaseAction);\n                if(event.getAction()==android.view.MotionEvent.ACTION_UP&&!kioskReleaseTriggered[0])showHomeUseNative();\n                return true;\n            }\n            return true;\n        });\n        LinearLayout.LayoutParams hup=new LinearLayout.LayoutParams(-1,dp(64));hup.setMargins(0,0,0,dp(12));content.addView(homeUse,hup);\n'''

if 'kioskReleaseHandler.postDelayed(kioskReleaseAction,10000)' not in s:
    if old not in s:
        raise SystemExit('self-use button insertion point not found')
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('10-second hold on self-use button releases kiosk')

from pathlib import Path

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

needle = '''        Button countInventory=button("ספירת מלאי",Color.WHITE,blue);countInventory.setOnClickListener(v->showInventoryCount());LinearLayout.LayoutParams countParams=new LinearLayout.LayoutParams(-1,dp(64));countParams.setMargins(0,0,0,dp(12));content.addView(countInventory,countParams);\n        Button logout=button("יציאה מניהול",red,Color.WHITE);logout.setOnClickListener(v->{adminToken="";adminUserId="";getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().clear().apply();showHome();});content.addView(logout,new LinearLayout.LayoutParams(-1,dp(60)));'''
replacement = '''        Button countInventory=button("ספירת מלאי",Color.WHITE,blue);countInventory.setOnClickListener(v->showInventoryCount());LinearLayout.LayoutParams countParams=new LinearLayout.LayoutParams(-1,dp(64));countParams.setMargins(0,0,0,dp(12));content.addView(countInventory,countParams);\n        if(KioskManager.isDeviceOwner(this)){\n            Button releaseKiosk=button("שחרור הטאבלט ממצב נעול",Color.WHITE,red);\n            releaseKiosk.setOnClickListener(v->new AlertDialog.Builder(this)\n                    .setTitle("שחרור מצב נעול")\n                    .setMessage("לשחרר את הטאבלט ולעבור למסך הבית הרגיל? ניתן לנעול שוב על ידי פתיחת האפליקציה ובחירה בנעילה מחדש.")\n                    .setNegativeButton("ביטול",null)\n                    .setPositiveButton("שחרר",(d,w)->KioskManager.exit(this)).show());\n            LinearLayout.LayoutParams releaseParams=new LinearLayout.LayoutParams(-1,dp(64));releaseParams.setMargins(0,0,0,dp(12));content.addView(releaseKiosk,releaseParams);\n        }\n        Button logout=button("יציאה מניהול",red,Color.WHITE);logout.setOnClickListener(v->{adminToken="";adminUserId="";getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().clear().apply();showHome();});content.addView(logout,new LinearLayout.LayoutParams(-1,dp(60)));'''

if replacement in s:
    print('kiosk admin release already present')
elif needle in s:
    s = s.replace(needle, replacement, 1)
else:
    raise SystemExit('showAdminHome insertion point not found')

p.write_text(s, encoding='utf-8')

from pathlib import Path

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

old = '        Button homeUse=button("שימוש עצמי",Color.WHITE,blue);homeUse.setOnClickListener(v->showHomeUseNative());LinearLayout.LayoutParams hup=new LinearLayout.LayoutParams(-1,dp(64));hup.setMargins(0,0,0,dp(12));content.addView(homeUse,hup);\n'
new = '''        Button homeUse=button("שימוש עצמי",Color.WHITE,blue);\n        final Handler kioskReleaseHandler=new Handler(Looper.getMainLooper());\n        final boolean[] kioskReleaseTriggered={false};\n        final Runnable kioskReleaseAction=()->{\n            kioskReleaseTriggered[0]=true;\n            confirmKioskRelease();\n        };\n        homeUse.setOnTouchListener((v,event)->{\n            if(event.getAction()==android.view.MotionEvent.ACTION_DOWN){\n                kioskReleaseTriggered[0]=false;\n                kioskReleaseHandler.postDelayed(kioskReleaseAction,10000);\n                return true;\n            }\n            if(event.getAction()==android.view.MotionEvent.ACTION_UP||event.getAction()==android.view.MotionEvent.ACTION_CANCEL){\n                kioskReleaseHandler.removeCallbacks(kioskReleaseAction);\n                if(event.getAction()==android.view.MotionEvent.ACTION_UP&&!kioskReleaseTriggered[0])showHomeUseNative();\n                return true;\n            }\n            return true;\n        });\n        LinearLayout.LayoutParams hup=new LinearLayout.LayoutParams(-1,dp(64));hup.setMargins(0,0,0,dp(12));content.addView(homeUse,hup);\n'''

if 'confirmKioskRelease();' not in s:
    if old not in s:
        raise SystemExit('self-use button insertion point not found')
    s = s.replace(old, new, 1)

helper = '''\n    private void confirmKioskRelease(){\n        final EditText pass=input("סיסמת מנהל");\n        pass.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);\n        new AlertDialog.Builder(this)\n                .setTitle("יציאה ממצב חנות")\n                .setMessage("יש להזין שוב את קוד הניהול")\n                .setView(pass)\n                .setNegativeButton("ביטול",null)\n                .setPositiveButton("אישור",(d,w)->{\n                    final String password=pass.getText().toString();\n                    if(offline!=null&&!offline.isOnline()){\n                        if(verifyOfflineAdminCredential(password)){\n                            if(KioskManager.isDeviceOwner(this))KioskManager.exit(this);\n                        }else Toast.makeText(this,"קוד ניהול שגוי",Toast.LENGTH_LONG).show();\n                        return;\n                    }\n                    io.execute(()->{\n                        try{\n                            JSONObject body=new JSONObject();\n                            body.put("email",ADMIN_EMAIL);\n                            body.put("password",password);\n                            JSONObject r=new JSONObject(requestRaw("POST","/auth/v1/token?grant_type=password",body,false));\n                            String token=r.optString("access_token");\n                            JSONObject user=r.optJSONObject("user");\n                            String uid=user==null?"":user.optString("id");\n                            if(token.isEmpty()||uid.isEmpty())throw new Exception("login failed");\n                            saveOfflineAdminCredential(password);\n                            main.post(()->{if(KioskManager.isDeviceOwner(this))KioskManager.exit(this);});\n                        }catch(Exception e){\n                            main.post(()->Toast.makeText(this,"קוד ניהול שגוי",Toast.LENGTH_LONG).show());\n                        }\n                    });\n                }).show();\n    }\n\n'''

if 'private void confirmKioskRelease()' in s:
    start=s.find('    private void confirmKioskRelease()')
    brace=s.find('{',start);depth=0;i=brace
    while i<len(s):
        if s[i]=='{': depth+=1
        elif s[i]=='}':
            depth-=1
            if depth==0:
                s=s[:start]+helper.strip('\n')+'\n\n'+s[i+1:]
                break
        i+=1
else:
    marker = '    private void showProductsAdmin(){\n'
    if marker not in s:
        raise SystemExit('helper insertion point not found')
    s = s.replace(marker, helper + marker, 1)

p.write_text(s, encoding='utf-8')
print('Kiosk release supports secure offline password verification')

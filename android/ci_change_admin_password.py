from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

method=r'''    private void showChangeAdminPassword(){
        if(adminToken==null||adminToken.isEmpty()){Toast.makeText(this,"יש להיכנס לניהול תחילה",Toast.LENGTH_LONG).show();return;}
        LinearLayout box=baseRoot();box.setPadding(dp(14),dp(8),dp(14),dp(8));
        EditText current=input("סיסמה נוכחית");current.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        EditText next=input("סיסמה חדשה (לפחות 6 תווים)");next.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        EditText again=input("הזן שוב את הסיסמה החדשה");again.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        box.addView(current);box.addView(next);box.addView(again);
        AlertDialog dlg=new AlertDialog.Builder(this).setTitle("החלפת סיסמה").setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",null).create();
        dlg.setOnShowListener(x->dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String cur=current.getText().toString();String np=next.getText().toString();String ap=again.getText().toString();
            if(cur.isEmpty()){Toast.makeText(this,"הזן את הסיסמה הנוכחית",Toast.LENGTH_LONG).show();return;}
            if(np.length()<6){Toast.makeText(this,"הסיסמה החדשה חייבת להכיל לפחות 6 תווים",Toast.LENGTH_LONG).show();return;}
            if(!np.equals(ap)){Toast.makeText(this,"הסיסמאות החדשות אינן זהות",Toast.LENGTH_LONG).show();return;}
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            io.execute(()->{try{
                JSONObject checkBody=new JSONObject();checkBody.put("email",ADMIN_EMAIL);checkBody.put("password",cur);
                JSONObject check=new JSONObject(requestRaw("POST","/auth/v1/token?grant_type=password",checkBody,false));
                if(check.optString("access_token").isEmpty())throw new Exception("CURRENT_PASSWORD");
                JSONObject body=new JSONObject();body.put("password",np);
                requestRaw("PUT","/auth/v1/user",body,true);
                adminToken="";adminUserId="";getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().clear().apply();
                main.post(()->{dlg.dismiss();Toast.makeText(this,"הסיסמה הוחלפה בהצלחה. היכנס שוב עם הסיסמה החדשה.",Toast.LENGTH_LONG).show();showHome();});
            }catch(Exception e){main.post(()->{dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);String m=e.getMessage();Toast.makeText(this,m!=null&&m.contains("400")?"הסיסמה הנוכחית אינה נכונה":"החלפת הסיסמה נכשלה",Toast.LENGTH_LONG).show();});}});
        }));dlg.show();
    }

'''
marker='    private void showAdminHome(){'
if 'private void showChangeAdminPassword()' not in s:
    if marker not in s: raise SystemExit('showAdminHome marker missing')
    s=s.replace(marker,method+marker,1)
start=s.find(marker);end=s.find('    private ',start+len(marker));block=s[start:end]
if 'החלפת סיסמה' not in block:
    needle='Button logout=button("יציאה מניהול",red,Color.WHITE);'
    if needle not in block: raise SystemExit('logout marker missing')
    add='Button changePassword=button("החלפת סיסמה",Color.WHITE,blue);changePassword.setOnClickListener(v->showChangeAdminPassword());LinearLayout.LayoutParams changePasswordParams=new LinearLayout.LayoutParams(-1,dp(60));changePasswordParams.setMargins(0,0,0,dp(12));content.addView(changePassword,changePasswordParams);\n        '
    block=block.replace(needle,add+needle,1)
    s=s[:start]+block+s[end:]
p.write_text(s,encoding='utf-8')
print('Native admin password change option added')

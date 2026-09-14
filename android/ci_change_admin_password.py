from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(src, signature, replacement):
    start=src.find(signature)
    if start<0: raise SystemExit('missing method: '+signature)
    brace=src.find('{',start);depth=0;i=brace;string=False;char=False;esc=False
    while i<len(src):
        ch=src[i]
        if string:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=='"': string=False
        elif char:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=="'": char=False
        else:
            if ch=='"': string=True
            elif ch=="'": char=True
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return src[:start]+replacement+src[i+1:]
        i+=1
    raise SystemExit('unclosed method '+signature)

helpers=r'''    private static final String OFFLINE_ADMIN_PREFS="offline_admin_auth";
    private void saveOfflineAdminCredential(String password){
        try{
            byte[] salt=new byte[16];new java.security.SecureRandom().nextBytes(salt);
            javax.crypto.SecretKeyFactory f=javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            javax.crypto.spec.PBEKeySpec spec=new javax.crypto.spec.PBEKeySpec(password.toCharArray(),salt,120000,256);
            byte[] hash=f.generateSecret(spec).getEncoded();spec.clearPassword();
            getSharedPreferences(OFFLINE_ADMIN_PREFS,MODE_PRIVATE).edit().putString("salt",android.util.Base64.encodeToString(salt,android.util.Base64.NO_WRAP)).putString("hash",android.util.Base64.encodeToString(hash,android.util.Base64.NO_WRAP)).apply();
        }catch(Exception ignored){}
    }
    private boolean verifyOfflineAdminCredential(String password){
        try{
            android.content.SharedPreferences p=getSharedPreferences(OFFLINE_ADMIN_PREFS,MODE_PRIVATE);String ss=p.getString("salt","");String hs=p.getString("hash","");if(ss.isEmpty()||hs.isEmpty())return false;
            byte[] salt=android.util.Base64.decode(ss,android.util.Base64.NO_WRAP),expected=android.util.Base64.decode(hs,android.util.Base64.NO_WRAP);
            javax.crypto.SecretKeyFactory f=javax.crypto.SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");javax.crypto.spec.PBEKeySpec spec=new javax.crypto.spec.PBEKeySpec(password.toCharArray(),salt,120000,256);byte[] actual=f.generateSecret(spec).getEncoded();spec.clearPassword();return java.security.MessageDigest.isEqual(expected,actual);
        }catch(Exception e){return false;}
    }

'''
marker='    private void openAdmin()'
if 'OFFLINE_ADMIN_PREFS' not in s:
    if marker not in s: raise SystemExit('openAdmin marker missing')
    s=s.replace(marker,helpers+marker,1)

login=r'''    private void login(String password){
        if(offline!=null&&!offline.isOnline()){
            if(verifyOfflineAdminCredential(password)){main.post(()->{Toast.makeText(this,"כניסת מנהל ללא אינטרנט",Toast.LENGTH_SHORT).show();showAdminHome();});}
            else main.post(()->Toast.makeText(this,"סיסמה שגויה",Toast.LENGTH_LONG).show());
            return;
        }
        io.execute(()->{try{
            JSONObject body=new JSONObject();body.put("email",ADMIN_EMAIL);body.put("password",password);
            JSONObject r=new JSONObject(requestRaw("POST","/auth/v1/token?grant_type=password",body,false));
            String token=r.optString("access_token");JSONObject user=r.optJSONObject("user");String uid=user==null?"":user.optString("id");
            if(token.isEmpty()||uid.isEmpty())throw new Exception("login failed");
            adminToken=token;adminUserId=uid;getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().putString("token",token).putString("user_id",uid).apply();saveOfflineAdminCredential(password);
            verifyAdmin(this::showAdminHome);
        }catch(Exception e){adminToken="";adminUserId="";main.post(()->Toast.makeText(this,"סיסמה שגויה",Toast.LENGTH_LONG).show());}});
    }
'''
s=replace_method(s,'    private void login(String password)',login)

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
                JSONObject body=new JSONObject();body.put("password",np);requestRaw("PUT","/auth/v1/user",body,true);saveOfflineAdminCredential(np);
                adminToken="";adminUserId="";getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().clear().apply();
                main.post(()->{dlg.dismiss();Toast.makeText(this,"הסיסמה הוחלפה בהצלחה. היכנס שוב עם הסיסמה החדשה.",Toast.LENGTH_LONG).show();showHome();});
            }catch(Exception e){main.post(()->{dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);String m=e.getMessage();Toast.makeText(this,m!=null&&m.contains("400")?"הסיסמה הנוכחית אינה נכונה":"החלפת הסיסמה נכשלה",Toast.LENGTH_LONG).show();});}});
        }));dlg.show();
    }
'''
if 'private void showChangeAdminPassword()' in s:s=replace_method(s,'    private void showChangeAdminPassword()',method)
else:
    marker='    private void showAdminHome(){'
    if marker not in s: raise SystemExit('showAdminHome marker missing')
    s=s.replace(marker,method+'\n'+marker,1)

marker='    private void showAdminHome(){'
start=s.find(marker);end=s.find('    private ',start+len(marker));block=s[start:end]
if 'החלפת סיסמה' not in block:
    needle='Button logout=button("יציאה מניהול",red,Color.WHITE);'
    if needle not in block: raise SystemExit('logout marker missing')
    add='Button changePassword=button("החלפת סיסמה",Color.WHITE,blue);changePassword.setOnClickListener(v->showChangeAdminPassword());LinearLayout.LayoutParams changePasswordParams=new LinearLayout.LayoutParams(-1,dp(60));changePasswordParams.setMargins(0,0,0,dp(12));content.addView(changePassword,changePasswordParams);\n        '
    block=block.replace(needle,add+needle,1);s=s[:start]+block+s[end:]

p.write_text(s,encoding='utf-8')
print('Secure offline admin password login enabled')

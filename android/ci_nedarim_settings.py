from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Shared payment settings loaded from Supabase, same row used by the website.
state='    private String adminUserId = "";'
if 'private String paymentMosad' not in s:
    s=s.replace(state,state+'\n    private String paymentMosad = "";\n    private String paymentApiValid = "";\n    private String paymentGroupe = "";
    private boolean showCustomerPaymentPage = false;',1)

# Load settings together with store data.
needle='JSONArray ps=requestArray("GET","/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc",null,false);'
if 'get_payment_settings_public' not in s:
    repl=needle+'\n            try{JSONArray pay=requestArray("POST","/rest/v1/rpc/get_payment_settings_public",new JSONObject(),false);if(pay.length()>0){JSONObject x=pay.getJSONObject(0);paymentMosad=x.optString("mosad",paymentMosad);paymentApiValid=x.optString("api_valid",paymentApiValid);paymentGroupe=x.optString("groupe","");showCustomerPaymentPage=x.optBoolean("show_customer_payment_page",false);}}catch(Exception ignored){}'
    if needle not in s: raise SystemExit('load marker not found')
    s=s.replace(needle,repl,1)

# Charge with current shared settings and selected Nedarim category.
old='        String js="p({Name:\'FinishTransaction2\',Value:{Mosad:\'"+MOSAD+"\',ApiValid:\'"+APIVALID+"\',PaymentType:\'Ragil\',Currency:\'1\',Amount:\'"+String.format(Locale.US,"%.2f",saleTotal)+"\',Tashlumim:\'1\',Param1:\'"+saleToken+"\',CallBack:\'"+CALLBACK+"\'}})";'
new='        String js="p({Name:\'FinishTransaction2\',Value:{Mosad:\'"+js(paymentMosad)+"\',ApiValid:\'"+js(paymentApiValid)+"\',PaymentType:\'Ragil\',Currency:\'1\',Amount:\'"+String.format(Locale.US,"%.2f",saleTotal)+"\',Tashlumim:\'1\',Groupe:\'"+js(paymentGroupe)+"\',Param1:\'"+saleToken+"\',CallBack:\'"+CALLBACK+"\'}})";'
if old in s: s=s.replace(old,new,1)
elif 'Groupe:\'"+js(paymentGroupe)' not in s: raise SystemExit('charge marker not found')

# Admin entry: dedicated Nedarim Plus screen, always protected by a second password check.
loop='        for(int i=0;i<labels.length;i++){final int idx=i;Button b=button(labels[idx],Color.WHITE,blue);b.setOnClickListener(v->actions[idx].run());LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(64));p.setMargins(0,0,0,dp(12));content.addView(b,p);}'
if 'פרטי חשבון נדרים פלוס' not in s:
    if loop not in s: raise SystemExit('admin menu marker not found')
    s=s.replace(loop,loop+'\n        Button nedarim=button("פרטי חשבון נדרים פלוס",Color.WHITE,blue);nedarim.setOnClickListener(v->showNedarimSettingsProtected());LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-1,dp(64));np.setMargins(0,0,0,dp(12));content.addView(nedarim,np);',1)
else:
    s=s.replace('nedarim.setOnClickListener(v->showNedarimSettings());','nedarim.setOnClickListener(v->showNedarimSettingsProtected());')
    s=s.replace('button("הגדרות נדרים פלוס",','button("פרטי חשבון נדרים פלוס",')

helper='    private void showProductsAdmin(){'
if 'private void showNedarimSettingsProtected()' not in s:
    methods=r'''    private void showNedarimSettingsProtected(){
        final EditText password=input("קוד כניסה לניהול");
        password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        final AlertDialog dialog=new AlertDialog.Builder(this)
                .setTitle("אימות כניסה")
                .setMessage("כדי לפתוח את פרטי חשבון נדרים פלוס, יש להזין שוב את קוד הכניסה לניהול.")
                .setView(password)
                .setNegativeButton("ביטול",null)
                .setPositiveButton("פתח",null)
                .create();
        dialog.setOnShowListener(d->{
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                String pass=password.getText().toString();
                if(pass.isEmpty()){password.setError("הזן קוד כניסה");return;}
                dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
                io.execute(()->{
                    try{
                        JSONObject body=new JSONObject();body.put("email",ADMIN_EMAIL);body.put("password",pass);
                        HttpURLConnection c=(HttpURLConnection)new URL(BASE+"/auth/v1/token?grant_type=password").openConnection();
                        c.setRequestMethod("POST");c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setDoOutput(true);
                        c.setRequestProperty("apikey",KEY);c.setRequestProperty("Content-Type","application/json");
                        try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes(StandardCharsets.UTF_8));}
                        int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
                        BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);r.close();c.disconnect();
                        if(code<200||code>=300)throw new Exception("wrong password");
                        JSONObject auth=new JSONObject(b.toString());String fresh=auth.optString("access_token","");
                        if(fresh.isEmpty())throw new Exception("missing token");
                        adminToken=fresh;
                        getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().putString("token",fresh).apply();
                        main.post(()->{dialog.dismiss();showNedarimSettings();});
                    }catch(Exception e){main.post(()->{dialog.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);password.setError("קוד הכניסה שגוי");password.selectAll();});}
                });
            });
        });
        dialog.show();
    }

    private void showNedarimSettings(){
        buildShell("פרטי חשבון נדרים פלוס",this::showAdminHome,false);
        EditText mosad=input("מספר מוסד");mosad.setText(paymentMosad);mosad.setInputType(InputType.TYPE_CLASS_NUMBER);content.addView(mosad);
        EditText api=input("ApiValid / סיסמת אימות");api.setText(paymentApiValid);content.addView(api);
        TextView current=text("קטגוריה נוכחית: "+(paymentGroupe.isEmpty()?"ללא קטגוריה":paymentGroupe),18,true);current.setPadding(0,dp(12),0,dp(8));content.addView(current);
        Spinner groups=new Spinner(this);List<String> groupNames=new ArrayList<>();groupNames.add("ללא קטגוריה");if(!paymentGroupe.isEmpty())groupNames.add(paymentGroupe);groups.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,groupNames));content.addView(groups,new LinearLayout.LayoutParams(-1,dp(60)));
        Button load=button("טען קטגוריות מהמוסד",Color.WHITE,blue);content.addView(load,new LinearLayout.LayoutParams(-1,dp(58)));
        Button openPay=button("פתח דף תשלום נדרים פלוס",Color.WHITE,blue);LinearLayout.LayoutParams opp=new LinearLayout.LayoutParams(-1,dp(62));opp.setMargins(0,dp(12),0,0);content.addView(openPay,opp);openPay.setOnClickListener(v->{String m=mosad.getText().toString().trim();if(m.length()!=7){Toast.makeText(this,"יש להזין מספר מוסד תקין",Toast.LENGTH_LONG).show();return;}paymentMosad=m;showNedarimDirectPayment();});
        Button openManagement=button("ממשק נדרים פלוס",Color.WHITE,blue);LinearLayout.LayoutParams omp=new LinearLayout.LayoutParams(-1,dp(62));omp.setMargins(0,dp(8),0,0);content.addView(openManagement,omp);openManagement.setOnClickListener(v->showNedarimManagement());
        Button save=button("שמור פרטי חשבון",green,Color.WHITE);LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,dp(62));sp.setMargins(0,dp(12),0,0);content.addView(save,sp);
        load.setOnClickListener(v->{String m=mosad.getText().toString().trim();if(m.isEmpty())return;Toast.makeText(this,"טוען קטגוריות...",Toast.LENGTH_SHORT).show();io.execute(()->{try{String raw=requestPublic("https://www.matara.pro/nedarimplus/online/Files/Manage.aspx?Action=GetMosad&MosadId="+url(m));JSONObject x=new JSONObject(raw);List<String> names=new ArrayList<>();names.add("ללא קטגוריה");String g=x.optString("Groupe","");if(!g.isEmpty())for(String n:g.split(",")){n=n.trim();if(!n.isEmpty()&&!names.contains(n))names.add(n);}main.post(()->{groups.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));int pos=names.indexOf(paymentGroupe);if(pos>=0)groups.setSelection(pos);});}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת הקטגוריות נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});});
        save.setOnClickListener(v->{String m=mosad.getText().toString().trim(),a=api.getText().toString().trim();String g=groups.getSelectedItem()==null?"":groups.getSelectedItem().toString();if("ללא קטגוריה".equals(g))g="";if(m.isEmpty()||a.isEmpty()){Toast.makeText(this,"יש להזין מספר מוסד ו-ApiValid",Toast.LENGTH_LONG).show();return;}final String fg=g;io.execute(()->{try{JSONObject b=new JSONObject();b.put("mosad",m);b.put("api_valid",a);b.put("groupe",fg);b.put("show_customer_payment_page",showCustomerPaymentPage);b.put("updated_at",new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.US).format(new Date()));requestRaw("PATCH","/rest/v1/payment_settings?id=eq.1",b,true);paymentMosad=m;paymentApiValid=a;paymentGroupe=fg;main.post(()->{Toast.makeText(this,"פרטי חשבון נדרים פלוס נשמרו",Toast.LENGTH_LONG).show();showAdminHome();});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת ההגדרות נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});});
    }

    private void showNedarimManagement(){
        buildShell("ממשק נדרים פלוס",this::showNedarimSettings,false);
        Button back=button("חזרה לניהול");back.setOnClickListener(v->showNedarimSettings());content.addView(back,new LinearLayout.LayoutParams(-1,-2));
        WebView management=new WebView(this);management.getSettings().setJavaScriptEnabled(true);management.getSettings().setDomStorageEnabled(true);management.setWebViewClient(new android.webkit.WebViewClient());management.loadUrl("https://reports.matara.pro/");content.addView(management,new LinearLayout.LayoutParams(-1,0,1));
    }
    private void showNedarimDirectPayment(){
        final EditText amount=input("סכום לתשלום");
        amount.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);
        new AlertDialog.Builder(this).setTitle("תשלום נדרים פלוס").setMessage("הזן סכום. דף התשלום המלא של נדרים פלוס ייפתח לאחר האישור.").setView(amount).setNegativeButton("ביטול",null).setPositiveButton("פתח דף תשלום",(d,w)->{
            try{
                double value=Double.parseDouble(amount.getText().toString().trim().replace(',','.'));
                if(value<=0)throw new Exception();
                String target="https://www.matara.pro/nedarimplus/online/?mosad="+url(paymentMosad)+"&OnlyNormal=1&Amount="+url(String.format(Locale.US,"%.2f",value))+"&AmountLock=1&Payment=1&PaymentLock=1"+(paymentGroupe.isEmpty()?"":"&groupe="+url(paymentGroupe)+"&groupelock=1");
                buildShell("תשלום נדרים פלוס",this::showNedarimSettings,false);
                Button exitPay=button("חזרה ללא תשלום");exitPay.setOnClickListener(v->showNedarimSettings());content.addView(exitPay,new LinearLayout.LayoutParams(-1,-2));\n                WebView pay=new WebView(this);pay.getSettings().setJavaScriptEnabled(true);pay.getSettings().setDomStorageEnabled(true);pay.setWebViewClient(new android.webkit.WebViewClient(){private boolean allowed(android.net.Uri u){String scheme=u.getScheme(),h=u.getHost();if(!"https".equalsIgnoreCase(scheme)||h==null)return false;h=h.toLowerCase(Locale.US);return h.equals("matara.pro")||h.endsWith(".matara.pro");} @Override public boolean shouldOverrideUrlLoading(WebView v,android.webkit.WebResourceRequest r){android.net.Uri u=r.getUrl();if(allowed(u))return false;Toast.makeText(MainActivity.this,"קישור חיצוני חסום במסך התשלום",Toast.LENGTH_SHORT).show();return true;} @Override public boolean shouldOverrideUrlLoading(WebView v,String u){try{if(allowed(android.net.Uri.parse(u)))return false;}catch(Exception ignored){}Toast.makeText(MainActivity.this,"קישור חיצוני חסום במסך התשלום",Toast.LENGTH_SHORT).show();return true;}});pay.loadUrl(target);content.addView(pay,new LinearLayout.LayoutParams(-1,0,1));
            }catch(Exception e){Toast.makeText(this,"הזן סכום תקין",Toast.LENGTH_LONG).show();}
        }).show();
    }

    private String requestPublic(String address)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestMethod("GET");c.setConnectTimeout(15000);c.setReadTimeout(15000);int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);r.close();c.disconnect();if(code<200||code>=300)throw new Exception("HTTP "+code);return b.toString();}
    private String js(String x){return x==null?"":x.replace("\\","\\\\").replace("'","\\'").replace("\r","").replace("\n","\\n");}

'''
    if helper not in s: raise SystemExit('method marker not found')
    s=s.replace(helper,methods+helper,1)
else:
    s=s.replace('buildShell("הגדרות נדרים פלוס",this::showAdminHome,false);','buildShell("פרטי חשבון נדרים פלוס",this::showAdminHome,false);')

p.write_text(s,encoding='utf-8')
print('Nedarim shared settings with protected admin access and direct payment screen applied')

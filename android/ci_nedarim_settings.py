from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Shared payment settings loaded from Supabase, same row used by the website.
state='    private String adminUserId = "";'
if 'private String paymentMosad' not in s:
    s=s.replace(state,state+'\n    private String paymentMosad = "7014693";\n    private String paymentApiValid = "vbnioH8OQd";\n    private String paymentGroupe = "";',1)

# Load settings together with store data.
needle='            JSONArray ps=requestArray("GET","/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc",null,false);'
if 'get_payment_settings_public' not in s:
    repl=needle+'\n            try{JSONArray pay=requestArray("POST","/rest/v1/rpc/get_payment_settings_public",new JSONObject(),false);if(pay.length()>0){JSONObject x=pay.getJSONObject(0);paymentMosad=x.optString("mosad",paymentMosad);paymentApiValid=x.optString("api_valid",paymentApiValid);paymentGroupe=x.optString("groupe","");}}catch(Exception ignored){}'
    if needle not in s: raise SystemExit('load marker not found')
    s=s.replace(needle,repl,1)

# Charge with current shared settings and selected Nedarim category.
old='        String js="p({Name:\'FinishTransaction2\',Value:{Mosad:\'"+MOSAD+"\',ApiValid:\'"+APIVALID+"\',PaymentType:\'Ragil\',Currency:\'1\',Amount:\'"+String.format(Locale.US,"%.2f",saleTotal)+"\',Tashlumim:\'1\',Param1:\'"+saleToken+"\',CallBack:\'"+CALLBACK+"\'}})";'
new='        String js="p({Name:\'FinishTransaction2\',Value:{Mosad:\'"+js(paymentMosad)+"\',ApiValid:\'"+js(paymentApiValid)+"\',PaymentType:\'Ragil\',Currency:\'1\',Amount:\'"+String.format(Locale.US,"%.2f",saleTotal)+"\',Tashlumim:\'1\',Groupe:\'"+js(paymentGroupe)+"\',Param1:\'"+saleToken+"\',CallBack:\'"+CALLBACK+"\'}})";'
if old in s: s=s.replace(old,new,1)
elif 'Groupe:\'"+js(paymentGroupe)' not in s: raise SystemExit('charge marker not found')

# Admin entry.
loop='        for(int i=0;i<labels.length;i++){final int idx=i;Button b=button(labels[idx],Color.WHITE,blue);b.setOnClickListener(v->actions[idx].run());LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(64));p.setMargins(0,0,0,dp(12));content.addView(b,p);}'
if 'הגדרות נדרים פלוס' not in s:
    if loop not in s: raise SystemExit('admin menu marker not found')
    s=s.replace(loop,loop+'\n        Button nedarim=button("הגדרות נדרים פלוס",Color.WHITE,blue);nedarim.setOnClickListener(v->showNedarimSettings());LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-1,dp(64));np.setMargins(0,0,0,dp(12));content.addView(nedarim,np);',1)

# Methods: load categories directly from Nedarim GetMosad, select and save shared settings.
helper='    private void showProductsAdmin(){'
if 'private void showNedarimSettings()' not in s:
    methods=r'''    private void showNedarimSettings(){
        buildShell("הגדרות נדרים פלוס",this::showAdminHome,false);
        EditText mosad=input("מספר מוסד");mosad.setText(paymentMosad);mosad.setInputType(InputType.TYPE_CLASS_NUMBER);content.addView(mosad);
        EditText api=input("ApiValid / סיסמת אימות");api.setText(paymentApiValid);content.addView(api);
        TextView current=text("קטגוריה נוכחית: "+(paymentGroupe.isEmpty()?"ללא קטגוריה":paymentGroupe),18,true);current.setPadding(0,dp(12),0,dp(8));content.addView(current);
        Spinner groups=new Spinner(this);List<String> groupNames=new ArrayList<>();groupNames.add("ללא קטגוריה");groupNames.add(paymentGroupe);groups.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,groupNames));content.addView(groups,new LinearLayout.LayoutParams(-1,dp(60)));
        Button load=button("טען קטגוריות מהמוסד",Color.WHITE,blue);content.addView(load,new LinearLayout.LayoutParams(-1,dp(58)));
        Button save=button("שמור הגדרות",green,Color.WHITE);LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,dp(62));sp.setMargins(0,dp(12),0,0);content.addView(save,sp);
        load.setOnClickListener(v->{String m=mosad.getText().toString().trim();if(m.isEmpty())return;Toast.makeText(this,"טוען קטגוריות...",Toast.LENGTH_SHORT).show();io.execute(()->{try{String raw=requestPublic("https://www.matara.pro/nedarimplus/online/Files/Manage.aspx?Action=GetMosad&MosadId="+url(m));JSONObject x=new JSONObject(raw);List<String> names=new ArrayList<>();names.add("ללא קטגוריה");String g=x.optString("Groupe","");if(!g.isEmpty())for(String n:g.split(",")){n=n.trim();if(!n.isEmpty()&&!names.contains(n))names.add(n);}main.post(()->{groups.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));int pos=names.indexOf(paymentGroupe);if(pos>=0)groups.setSelection(pos);});}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת הקטגוריות נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});});
        save.setOnClickListener(v->{String m=mosad.getText().toString().trim(),a=api.getText().toString().trim();String g=groups.getSelectedItem()==null?"":groups.getSelectedItem().toString();if("ללא קטגוריה".equals(g))g="";if(m.isEmpty()||a.isEmpty()){Toast.makeText(this,"יש להזין מספר מוסד ו-ApiValid",Toast.LENGTH_LONG).show();return;}final String fg=g;io.execute(()->{try{JSONObject b=new JSONObject();b.put("mosad",m);b.put("api_valid",a);b.put("groupe",fg);b.put("updated_at",new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.US).format(new Date()));requestRaw("PATCH","/rest/v1/payment_settings?id=eq.1",b,true);paymentMosad=m;paymentApiValid=a;paymentGroupe=fg;main.post(()->{Toast.makeText(this,"הגדרות נדרים פלוס נשמרו",Toast.LENGTH_LONG).show();showAdminHome();});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת ההגדרות נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});});
    }
    private String requestPublic(String address)throws Exception{HttpURLConnection c=(HttpURLConnection)new URL(address).openConnection();c.setRequestMethod("GET");c.setConnectTimeout(15000);c.setReadTimeout(15000);int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();BufferedReader r=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);r.close();c.disconnect();if(code<200||code>=300)throw new Exception("HTTP "+code);return b.toString();}
    private String js(String x){return x==null?"":x.replace("\\","\\\\").replace("'","\\'").replace("\r","").replace("\n","\\n");}

'''
    if helper not in s: raise SystemExit('method marker not found')
    s=s.replace(helper,methods+helper,1)

p.write_text(s,encoding='utf-8')
print('Nedarim shared settings applied')

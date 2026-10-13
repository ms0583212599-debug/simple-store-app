from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java');s=p.read_text()
if 'private void openCustomerNedarimPage()' in s: raise SystemExit(0)
# A separate visibility-only save avoids changing account credentials.
anchor='        TextView current=text("קטגוריה נוכחית: '
i=s.index(anchor,s.index('private void renderNedarimSettings()'))
s=s[:i]+'''        android.widget.CheckBox customerPage=new android.widget.CheckBox(this);
        customerPage.setText("הצג ללקוחות אפשרות תשלום דרך נדרים פלוס");customerPage.setChecked(showCustomerPaymentPage);
        content.addView(customerPage,new LinearLayout.LayoutParams(-1,-2));
        Button saveVisibility=button("שמור אפשרות ללקוחות",green,Color.WHITE);
        content.addView(saveVisibility,new LinearLayout.LayoutParams(-1,dp(56)));
        saveVisibility.setOnClickListener(v->{boolean enabled=customerPage.isChecked();saveVisibility.setEnabled(false);io.execute(()->{try{
            JSONObject body=new JSONObject();body.put("show_customer_payment_page",enabled);
            requestRaw("PATCH","/rest/v1/payment_settings?id=eq.1",body,true);
            main.post(()->{showCustomerPaymentPage=enabled;saveVisibility.setEnabled(true);Toast.makeText(this,"אפשרות התשלום ללקוחות נשמרה",Toast.LENGTH_LONG).show();});
        }catch(Exception e){main.post(()->{saveVisibility.setEnabled(true);Toast.makeText(this,"שמירת האפשרות נכשלה",Toast.LENGTH_LONG).show();});}});});
'''+s[i:]
# Append after all checkout layout generators.
start=s.index('    private void showPayment(){');end=s.index('    private void chargeCard()',start)
pay=s[start:end];anchor='        paymentWebView.loadDataWithBaseURL('
i=pay.index(anchor)
pay=pay[:i]+'''        customerOnlineActive=false;customerOnlineOpening=false;customerOnlineEpoch++;
        if(showCustomerPaymentPage){
            Button online=button("תשלום דרך נדרים פלוס",Color.WHITE,blue);online.setTextSize(13);online.setPadding(dp(4),dp(2),dp(4),dp(2));online.setOnClickListener(v->openCustomerNedarimPage());
            int position=body.indexOfChild(chargeButton);body.removeView(chargeButton);
            LinearLayout choices=new LinearLayout(this);choices.addView(chargeButton,new LinearLayout.LayoutParams(0,dp(48),1));
            LinearLayout.LayoutParams option=new LinearLayout.LayoutParams(0,dp(48),1);option.setMargins(dp(6),0,0,0);choices.addView(online,option);
            body.addView(choices,position,new LinearLayout.LayoutParams(-1,dp(48)));
        }
'''+pay[i:];s=s[:start]+pay+s[end:]
s=s.replace('    private void chargeCard(){','    private void chargeCard(){\n        if(customerOnlineOpening||customerOnlineActive)return;',1)
# Extract the URL builder so the real request can be verified without network.
a=s.index('        String target="https://www.matara.pro/nedarimplus/online/')
b=s.index('\n',a)
line=s[a:b]
s=s[:a]+'        String target=buildNedarimDirectUrl(value);'+s[b:]
s=s.replace('    private void openNedarimDirectPaymentPage(double value){','    private String buildNedarimDirectUrl(double value){\n'+line+'\n        if(customerOnlineActive)target+="&comment="+url("SimpleStore:"+saleToken)+"&Redirect="+url("https://www.matara.pro/simplestore/return?order="+url(saleToken));\n        return target;\n    }\n\n    private void openNedarimDirectPaymentPage(double value){',1)
# Leaving the page invalidates asynchronous opens/confirmations.
s=s.replace('    private void showCart(){','    private void showCart(){\n        customerOnlineActive=false;customerOnlineOpening=false;customerOnlineEpoch++;',1)
# Direct page has its own confirmation path, not the amount-only legacy matcher.
s=s.replace('        buildShell("תשלום נדרים פלוס",this::showNedarimSettings,false);','''        Runnable directBack=customerOnlineActive?this::showCart:this::showNedarimSettings;
        buildShell("תשלום נדרים פלוס",directBack,false);''',1)
s=s.replace('exitPay.setOnClickListener(v->showNedarimSettings());','exitPay.setOnClickListener(v->directBack.run());',1)
# Give the payment page the maximum usable height below the native top navigation.
# The WebView's viewport is independent of the Android shell's scroll container.
s=s.replace('content.setPadding(dp(12),dp(8),dp(12),dp(12));',
            'content.setPadding(dp(4),dp(2),dp(4),dp(2));',1)
s=s.replace('content.addView(loadStatus,new LinearLayout.LayoutParams(-1,-2));',
            'content.addView(loadStatus,new LinearLayout.LayoutParams(-1,-2));',1)
s=s.replace('content.addView(exitPay,new LinearLayout.LayoutParams(-1,-2));',
            'content.addView(exitPay,new LinearLayout.LayoutParams(-1,dp(36)));',1)
# Scale only the embedded payment page, never the native navigation or controls.
# A viewport meta tag helps responsive pages; CSS does not alter payment values.
s=s.replace('            @Override public void onPageFinished(WebView v,String u){if(!failed)loadStatus.setVisibility(View.GONE);}',
'''            @Override public void onPageFinished(WebView v,String u){if(!failed&&u!=null&&"https".equalsIgnoreCase(android.net.Uri.parse(u).getScheme())&&"www.matara.pro".equalsIgnoreCase(android.net.Uri.parse(u).getHost())){loadStatus.setVisibility(View.GONE);v.evaluateJavascript("(function(){var m=document.querySelector('meta[name=viewport]');if(!m){m=document.createElement('meta');m.name='viewport';document.head.appendChild(m);}m.content='width=device-width,initial-scale=1';document.documentElement.style.maxWidth='100%';document.body.style.maxWidth='100%';})()",null);}}''',1)
# Keep WebView's layout viewport matched to the available tablet width.
# Do not alter native top controls, transaction parameters or payment verification.
s=s.replace('        pay.getSettings().setDomStorageEnabled(true);',
'''        pay.getSettings().setDomStorageEnabled(true);
        pay.getSettings().setUseWideViewPort(true);
        pay.getSettings().setLoadWithOverviewMode(true);
        pay.getSettings().setBuiltInZoomControls(false);
        pay.getSettings().setDisplayZoomControls(false);''',1)
anchor='        WebView pay=new WebView(this);'
s=s.replace(anchor,'''        if(customerOnlineActive){Button verify=button("בדוק תשלום שבוצע",green,Color.WHITE);verify.setOnClickListener(v->verifyCustomerOnlinePayment());content.addView(verify,new LinearLayout.LayoutParams(-1,dp(48)));}
'''+anchor,1)
s=s.replace('android.net.Uri u=r.getUrl();if(allowed(u))return false;','android.net.Uri u=r.getUrl();if(isCustomerNedarimReturn(u)){verifyCustomerOnlinePayment();return true;}if(allowed(u))return false;',1)
s=s.replace('try{if(allowed(android.net.Uri.parse(u)))return false;}','try{if(isCustomerNedarimReturn(android.net.Uri.parse(u))){verifyCustomerOnlinePayment();return true;}if(allowed(android.net.Uri.parse(u)))return false;}',1)
helper=r'''    private boolean customerOnlineActive=false,customerOnlineOpening=false,customerOnlineVerifying=false;
    private long customerOnlineBaseline=0;
    private String customerOnlineInstitution="";
    private int customerOnlineEpoch=0;
    private static final String ONLINE_VERIFY=BASE+"/functions/v1/verify-nedarim-online-sale";
    private boolean isCustomerNedarimReturn(android.net.Uri uri){
        return customerOnlineActive&&"https".equals(uri.getScheme())&&"www.matara.pro".equals(uri.getHost())&&"/simplestore/return".equals(uri.getPath())&&saleToken.equals(uri.getQueryParameter("order"));
    }
    private void openCustomerNedarimPage(){
        if(customerOnlineOpening||customerOnlineActive)return;
        if(!paymentCheckoutReady||saleToken.isEmpty()){Toast.makeText(this,"התשלום עדיין בהכנה. המתן רגע.",Toast.LENGTH_SHORT).show();return;}
        if(chargeButton!=null&&paymentFrameReady&&!chargeButton.isEnabled()){Toast.makeText(this,"התשלום בבדיקה. אין להתחיל תשלום נוסף.",Toast.LENGTH_LONG).show();return;}
        customerOnlineOpening=true;final String expectedToken=saleToken;final int epoch=customerOnlineEpoch;
        io.execute(()->{try{
            JSONObject b=new JSONObject();b.put("action","ready");
            JSONObject result=new JSONObject(requestRaw("POST",BASE+"/functions/v1/nedarim-online-capability",b,false));
            if(!result.optBoolean("enabled")||!result.optBoolean("ready"))throw new Exception();
            main.post(()->{if(epoch!=customerOnlineEpoch||!expectedToken.equals(saleToken))return;customerOnlineOpening=false;customerOnlineActive=true;
                customerOnlineBaseline=result.optLong("baseline",0);customerOnlineInstitution=result.optString("mosad",paymentMosad);paymentMosad=customerOnlineInstitution;paymentGroupe=result.optString("groupe","");
                if(paymentWebView!=null){paymentWebView.stopLoading();paymentWebView.destroy();paymentWebView=null;}
                paymentFrameReady=false;chargeButton=null;openNedarimDirectPaymentPage(saleTotal);
            });
        }catch(Exception e){main.post(()->{customerOnlineOpening=false;Toast.makeText(this,"לא ניתן לפתוח כעת את התשלום בנדרים פלוס. יש לבדוק את החיבור וההגדרות בניהול.",Toast.LENGTH_LONG).show();});}});
    }
    private void verifyCustomerOnlinePayment(){
        if(!customerOnlineActive||customerOnlineVerifying||saleToken.isEmpty())return;
        customerOnlineVerifying=true;final String expectedToken=saleToken;
        Toast.makeText(this,"בודק אישור תשלום בנדרים פלוס...",Toast.LENGTH_SHORT).show();
        io.execute(()->{try{
            JSONObject body=new JSONObject();body.put("saleToken",expectedToken);body.put("baseline",customerOnlineBaseline);body.put("mosad",customerOnlineInstitution);
            JSONObject result=new JSONObject(requestRaw("POST",ONLINE_VERIFY,body,false));
            main.post(()->{customerOnlineVerifying=false;if(!customerOnlineActive||!expectedToken.equals(saleToken))return;
                if("paid".equals(result.optString("status"))){customerOnlineActive=false;finishSuccessfulPayment();}
                else Toast.makeText(this,"טרם התקבל אישור תשלום. אין לשלם שוב אם נדרים אישר את החיוב; יש לפנות לניהול.",Toast.LENGTH_LONG).show();
            });
        }catch(Exception e){main.post(()->{customerOnlineVerifying=false;Toast.makeText(this,"אימות התשלום לא הושלם. אם בוצע חיוב, אין לשלם שוב ויש לפנות לניהול.",Toast.LENGTH_LONG).show();});}});
    }

'''
s=s.replace('    private void loadData(Runnable done){',helper+'    private void loadData(Runnable done){',1)
# Fail the build if payment layout changes upstream and the safety patches no longer apply.
required_fragments=[
    'pay.getSettings().setUseWideViewPort(true);',
    'pay.getSettings().setLoadWithOverviewMode(true);',
    'm.content=\'width=device-width,initial-scale=1\'',
    'content.setPadding(dp(4),dp(2),dp(4),dp(2));',
    'content.addView(exitPay,new LinearLayout.LayoutParams(-1,dp(36)));',
    'private void verifyCustomerOnlinePayment()',
    'if(isCustomerNedarimReturn(u)){verifyCustomerOnlinePayment();return true;}',
]
missing=[item for item in required_fragments if item not in s]
if missing: raise SystemExit('Nedarim payment generator patch missing: '+repr(missing))
p.write_text(s)
print('Customer Nedarim page and protected shared visibility control applied')

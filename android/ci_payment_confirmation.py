from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

if 'CONFIRM_CLIENT_PAYMENT' not in s:
    marker='    private static final String CALLBACK = BASE + "/functions/v1/nedarim-callback";'
    if marker not in s: raise SystemExit('callback constant marker not found')
    s=s.replace(marker, marker+'\n    private static final String CONFIRM_CLIENT_PAYMENT = BASE + "/functions/v1/confirm-client-payment";',1)

# Make Android wait for the embedded Nedarim iframe exactly like the website does.
if 'private volatile boolean paymentFrameReady' not in s:
    marker='    private volatile boolean polling = false;'
    if marker not in s: raise SystemExit('polling state marker not found')
    s=s.replace(marker, marker+'\n    private volatile boolean paymentFrameReady = false;',1)

old_web='paymentWebView=new WebView(this);WebSettings s=paymentWebView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");root.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));'
new_web='paymentWebView=new WebView(this);WebSettings s=paymentWebView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setDatabaseEnabled(true);android.webkit.CookieManager cm=android.webkit.CookieManager.getInstance();cm.setAcceptCookie(true);cm.setAcceptThirdPartyCookies(paymentWebView,true);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");root.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));'
if old_web in s:
    s=s.replace(old_web,new_web,1)
elif 'setAcceptThirdPartyCookies(paymentWebView,true)' not in s:
    raise SystemExit('WebView settings marker not found')

old_btn='chargeButton=button("בצע תשלום",green,Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());root.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(64)));setContentView(root);'
new_btn='paymentFrameReady=false;chargeButton=button("טוען תשלום...",green,Color.WHITE);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());root.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(64)));setContentView(root);'
if old_btn in s:
    s=s.replace(old_btn,new_btn,1)
elif 'button("טוען תשלום..."' not in s:
    raise SystemExit('charge button marker not found')

old_html='String html="<!doctype html><html dir=\'rtl\'><body style=\'margin:0\'><iframe id=\'frame\' src=\'https://www.matara.pro/nedarimplus/iframe/?Picture=Hide\' style=\'width:100%;height:100vh;border:0\'></iframe><script>function p(d){frame.contentWindow.postMessage(d,\'*\')}window.addEventListener(\'message\',e=>{let d=e.data;if(d&&d.Name===\'TransactionResponse\')Android.onTransaction(JSON.stringify(d.Value||{}));});</script></body></html>";'
new_html='String html="<!doctype html><html dir=\'rtl\'><body style=\'margin:0\'><iframe id=\'frame\' src=\'https://www.matara.pro/nedarimplus/iframe/?Picture=Hide\' style=\'width:100%;height:100vh;border:0\'></iframe><script>const frame=document.getElementById(\'frame\');function p(d){frame.contentWindow.postMessage(d,\'*\')}frame.addEventListener(\'load\',()=>{Android.onFrameReady();p({Name:\'GetHeight\'});});window.addEventListener(\'message\',e=>{let d=e.data;if(d&&d.Name===\'TransactionResponse\')Android.onTransaction(JSON.stringify(d.Value||{}));});</script></body></html>";'
if old_html in s:
    s=s.replace(old_html,new_html,1)
elif 'Android.onFrameReady()' not in s:
    raise SystemExit('payment html marker not found')

old_guard='        if(paymentWebView==null)return;chargeButton.setEnabled(false);'
new_guard='        if(paymentWebView==null)return;if(!paymentFrameReady){if(paymentStatus!=null)paymentStatus.setText("ממשק התשלום עדיין נטען...");return;}chargeButton.setEnabled(false);'
if old_guard in s:
    s=s.replace(old_guard,new_guard,1)
elif 'if(!paymentFrameReady)' not in s:
    raise SystemExit('charge guard marker not found')

old='    public class PaymentBridge{@JavascriptInterface public void onTransaction(String value){main.post(()->{paymentStatus.setText("בודק תשלום...");startPolling();});}}'
new='''    public class PaymentBridge{
        @JavascriptInterface public void onFrameReady(){
            main.post(()->{
                paymentFrameReady=true;
                if(chargeButton!=null){chargeButton.setText("בצע תשלום");chargeButton.setEnabled(true);}
                if(paymentStatus!=null)paymentStatus.setText(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal));
            });
        }
        @JavascriptInterface public void onTransaction(String value){
        main.post(()->paymentStatus.setText("בודק תשלום..."));
        io.execute(()->{
            try{
                String rawValue=value==null?"":value.trim();
                JSONObject response;
                try{response=new JSONObject(rawValue.isEmpty()?"{}":rawValue);}catch(Exception first){
                    String unwrapped=rawValue;
                    if(rawValue.startsWith("\\\"")&&rawValue.endsWith("\\\"")){
                        unwrapped=new org.json.JSONTokener(rawValue).nextValue().toString();
                    }
                    response=new JSONObject(unwrapped);
                }
                String providerStatus=response.optString("Status",response.optString("status","")).trim();
                if("ERROR".equalsIgnoreCase(providerStatus)){
                    String msg=response.optString("Message","").trim();
                    String code=response.optString("ErrorCode","").trim();
                    String shown="שגיאה בתשלום"+(msg.isEmpty()?"":": "+msg)+(code.isEmpty()?"":" ("+code+")");
                    polling=false;
                    main.post(()->{if(paymentStatus!=null)paymentStatus.setText(shown);if(chargeButton!=null)chargeButton.setEnabled(paymentFrameReady);});
                    return;
                }
                JSONObject body=new JSONObject();body.put("saleToken",saleToken);body.put("response",response);
                String raw=requestRaw("POST",CONFIRM_CLIENT_PAYMENT,body,false);
                JSONObject confirm=new JSONObject(raw);
                if("paid".equals(confirm.optString("status"))){
                    polling=false;cart.clear();loadData(()->{Toast.makeText(MainActivity.this,"התשלום בוצע",Toast.LENGTH_LONG).show();showHome();});return;
                }
                if(!confirm.optBoolean("accepted",true)){
                    String reason=confirm.optString("reason","");
                    main.post(()->{if(paymentStatus!=null)paymentStatus.setText("התשלום לא אושר: "+reason);if(chargeButton!=null)chargeButton.setEnabled(paymentFrameReady);});
                    return;
                }
            }catch(Exception e){
                main.post(()->{if(paymentStatus!=null)paymentStatus.setText("שגיאה בבדיקת התשלום: "+safeMsg(e));if(chargeButton!=null)chargeButton.setEnabled(paymentFrameReady);});
                return;
            }
            main.post(()->startPolling());
        });
    }}'''
if old in s:
    s=s.replace(old,new,1)
elif 'CONFIRM_CLIENT_PAYMENT,body,false' in s:
    start=s.index('    public class PaymentBridge')
    end=s.index('    private void startPolling()',start)
    s=s[:start]+new+'\n\n'+s[end:]
else:
    raise SystemExit('PaymentBridge marker not found')

old_poll='''    private void startPolling(){
        polling=true;
        io.execute(()->{for(int i=0;i<45&&polling;i++){try{
            JSONObject body=new JSONObject();body.put("p_token",saleToken);
            JSONArray a=requestArray("POST","/rest/v1/rpc/get_sale_status",body,false);
            if(a.length()>0&&"paid".equals(a.getJSONObject(0).optString("status"))){polling=false;cart.clear();loadData(()->{Toast.makeText(this,"התשלום בוצע",Toast.LENGTH_LONG).show();showHome();});return;}
            Thread.sleep(2000);
        }catch(Exception ignored){}}});
    }'''
new_poll='''    private void startPolling(){
        if(polling)return;
        polling=true;
        io.execute(()->{
            boolean confirmed=false;
            for(int i=0;i<15&&polling;i++){
                try{
                    JSONObject body=new JSONObject();body.put("p_token",saleToken);
                    JSONArray a=requestArray("POST","/rest/v1/rpc/get_sale_status",body,false);
                    if(a.length()>0&&"paid".equals(a.getJSONObject(0).optString("status"))){
                        confirmed=true;polling=false;cart.clear();loadData(()->{Toast.makeText(this,"התשלום בוצע",Toast.LENGTH_LONG).show();showHome();});return;
                    }
                }catch(Exception ignored){}
                try{Thread.sleep(2000);}catch(InterruptedException ignored){Thread.currentThread().interrupt();break;}
            }
            if(!confirmed&&polling){
                polling=false;
                main.post(()->{
                    if(paymentStatus!=null)paymentStatus.setText("לא התקבל אישור תשלום. אפשר לנסות שוב לאחר בדיקה.");
                    if(chargeButton!=null)chargeButton.setEnabled(paymentFrameReady);
                });
            }
        });
    }'''
if old_poll in s:
    s=s.replace(old_poll,new_poll,1)
elif 'private void startPolling()' in s:
    start=s.index('    private void startPolling()')
    next_method=s.find('\n    private ',start+10)
    if next_method==-1: raise SystemExit('polling end marker not found')
    s=s[:start]+new_poll+'\n'+s[next_method:]
else:
    raise SystemExit('polling marker not found')

p.write_text(s,encoding='utf-8')
print('Payment confirmation bridge and Nedarim iframe readiness applied')

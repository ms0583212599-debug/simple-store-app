from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

if 'CONFIRM_CLIENT_PAYMENT' not in s:
    marker='    private static final String CALLBACK = BASE + "/functions/v1/nedarim-callback";'
    if marker not in s: raise SystemExit('callback constant marker not found')
    s=s.replace(marker, marker+'\n    private static final String CONFIRM_CLIENT_PAYMENT = BASE + "/functions/v1/confirm-client-payment";',1)

old='    public class PaymentBridge{@JavascriptInterface public void onTransaction(String value){main.post(()->{paymentStatus.setText("בודק תשלום...");startPolling();});}}'
new='''    public class PaymentBridge{@JavascriptInterface public void onTransaction(String value){
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
                    main.post(()->{if(paymentStatus!=null)paymentStatus.setText(shown);if(chargeButton!=null)chargeButton.setEnabled(true);});
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
                    main.post(()->{if(paymentStatus!=null)paymentStatus.setText("התשלום לא אושר: "+reason);if(chargeButton!=null)chargeButton.setEnabled(true);});
                    return;
                }
            }catch(Exception e){
                main.post(()->{if(paymentStatus!=null)paymentStatus.setText("שגיאה בבדיקת התשלום: "+safeMsg(e));if(chargeButton!=null)chargeButton.setEnabled(true);});
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
                    if(chargeButton!=null)chargeButton.setEnabled(true);
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
print('Payment confirmation bridge applied')

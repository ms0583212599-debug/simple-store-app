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
                JSONObject response=new JSONObject(value==null||value.trim().isEmpty()?"{}":value);
                JSONObject body=new JSONObject();body.put("saleToken",saleToken);body.put("response",response);
                String raw=requestRaw("POST",CONFIRM_CLIENT_PAYMENT,body,false);
                JSONObject confirm=new JSONObject(raw);
                if("paid".equals(confirm.optString("status"))){
                    polling=false;cart.clear();loadData(()->{Toast.makeText(this,"התשלום בוצע",Toast.LENGTH_LONG).show();showHome();});return;
                }
            }catch(Exception ignored){}
            main.post(()->startPolling());
        });
    }}'''
if old in s:
    s=s.replace(old,new,1)
elif 'CONFIRM_CLIENT_PAYMENT,body,false' not in s:
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
            for(int i=0;i<45&&polling;i++){
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
                    if(paymentStatus!=null)paymentStatus.setText("לא התקבל עדיין אישור תשלום. אל תבצע תשלום נוסף לפני בדיקה.");
                    if(chargeButton!=null)chargeButton.setEnabled(true);
                });
            }
        });
    }'''
if old_poll in s:
    s=s.replace(old_poll,new_poll,1)
elif 'לא התקבל עדיין אישור תשלום' not in s:
    raise SystemExit('polling marker not found')

p.write_text(s,encoding='utf-8')
print('Payment confirmation bridge applied')

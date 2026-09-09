from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Keep the existing fast network timeouts.
s=s.replace('c.setConnectTimeout(15000);c.setReadTimeout(15000);','c.setConnectTimeout(6000);c.setReadTimeout(10000);',1)

# Payment readiness flag: the Nedarim WebView may load while the server creates the sale,
# but card input/payment stays locked until the sale token is ready.
field='    private boolean paymentCheckoutReady=false;'
if field not in s:
    marker='    private boolean paymentCardReaderMode=false;'
    if marker not in s: raise SystemExit('payment reader state marker missing')
    s=s.replace(marker,field+'\n'+marker,1)

# While checkout is being created, keep all input controls hidden but let the WebView load.
needle='''    private void setPaymentInputMode(boolean reader){
        paymentCardReaderMode=reader;paymentCardReaderBuffer.setLength(0);'''
replacement='''    private void setPaymentInputMode(boolean reader){
        if(reader&&!paymentCheckoutReady){paymentCardReaderMode=false;paymentCardReaderBuffer.setLength(0);if(paymentReaderStatus!=null){paymentReaderStatus.setVisibility(View.VISIBLE);paymentReaderStatus.setText("מכין את התשלום...");}if(paymentFrameWrap!=null)paymentFrameWrap.setVisibility(View.GONE);if(paymentKeyboardPanel!=null)paymentKeyboardPanel.setVisibility(View.GONE);if(chargeButton!=null)chargeButton.setVisibility(View.GONE);return;}
        paymentCardReaderMode=reader;paymentCardReaderBuffer.setLength(0);'''
if needle in s:s=s.replace(needle,replacement,1)

# Replace final normal checkout flow. Calculate the amount locally, open/load Nedarim immediately,
# and create the server-side sale at the same time. This overlaps the two slow operations.
a=s.find('    private void startCheckout(){')
b=s.find('    private void showCheckoutPreparing(){',a)
if b<0:b=s.find('    private void showPayment(){',a)
if a<0 or b<0:raise SystemExit('checkout method markers missing')
normal='''    private void startCheckout(){
        generalAmountCheckout=false;
        if(cart.isEmpty())return;
        saleToken="";saleTotal=0;for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q>0)saleTotal+=q*p.price;}
        paymentCheckoutReady=false;showPayment();
        io.execute(()->{try{
            JSONArray items=new JSONArray();
            for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;JSONObject x=new JSONObject();x.put("product_id",p.id);x.put("unit_price",p.price);x.put("quantity",q);items.put(x);}
            JSONObject body=new JSONObject();body.put("items",items);
            JSONObject r=new JSONObject(requestRaw("POST",CREATE,body,false));saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",saleTotal);
            main.post(()->{paymentCheckoutReady=true;if(paymentStatus!=null)paymentStatus.setText(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal));setPaymentInputMode(true);});
        }catch(Exception e){main.post(()->{paymentCheckoutReady=false;Toast.makeText(this,"לא ניתן להתחיל תשלום: "+safeMsg(e),Toast.LENGTH_LONG).show();showCart();});}});
    }

'''
s=s[:a]+normal+s[b:]

# Do the same for the general-amount calculator checkout if that feature is present.
a=s.find('    private void startGeneralAmountCheckout(double amount){')
if a>=0:
    b=s.find('    private void ',a+20)
    if b<0:raise SystemExit('general amount checkout end missing')
    general='''    private void startGeneralAmountCheckout(double amount){
        generalAmountCheckout=true;saleToken="";saleTotal=amount;paymentCheckoutReady=false;showPayment();
        io.execute(()->{try{JSONArray items=new JSONArray();JSONObject x=new JSONObject();x.put("unit_price",amount);x.put("quantity",1);items.put(x);JSONObject body=new JSONObject();body.put("items",items);JSONObject r=new JSONObject(requestRaw("POST",CREATE,body,false));saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",amount);main.post(()->{paymentCheckoutReady=true;if(paymentStatus!=null)paymentStatus.setText(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal));setPaymentInputMode(true);});}catch(Exception e){main.post(()->{paymentCheckoutReady=false;Toast.makeText(this,"לא ניתן להתחיל תשלום: "+safeMsg(e),Toast.LENGTH_LONG).show();showGeneralAmountCalculator();});}});
    }

'''
    s=s[:a]+general+s[b:]

p.write_text(s,encoding='utf-8')
print('Fast checkout applied: Nedarim loads in parallel with sale creation while payment input remains safely locked')

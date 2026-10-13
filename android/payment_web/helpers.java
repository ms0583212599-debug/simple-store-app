    private PaymentPageWebView directPaymentPage;
    private PaymentKeyboardInput paymentKeyboardInput;
    private boolean isPaymentKeyboardOrigin(String address){
        try{android.net.Uri u=android.net.Uri.parse(address);return "https".equals(u.getScheme())&&"www.matara.pro".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&u.getPath()!=null&&u.getPath().toLowerCase(java.util.Locale.ROOT).startsWith("/nedarimplus/");}catch(Exception ignored){return false;}
    }
    private final class PaymentKeyboardInput extends EditText{
        final PaymentPageWebView page;final String nonce;final String mode;
        PaymentKeyboardInput(PaymentPageWebView page,String mode){super(MainActivity.this);this.page=page;this.nonce=page.nonce;this.mode=mode;setInputType("NUM".equals(mode)?InputType.TYPE_CLASS_NUMBER:InputType.TYPE_CLASS_TEXT);setShowSoftInputOnFocus(false);}
    }
    private void sendPaymentKeyboardKey(PaymentKeyboardInput target,String kind,String key){
        PaymentPageWebView page=target.page;
        if(page!=directPaymentPage||!page.isAttachedToWindow()||!target.nonce.equals(page.nonce)||!isPaymentKeyboardOrigin(page.getUrl()))return;
        page.evaluateJavascript("window.__storePaymentKey&&window.__storePaymentKey("+JSONObject.quote(target.nonce)+","+JSONObject.quote(kind)+","+JSONObject.quote(key)+")",null);
    }
    private void dismissPaymentKeyboard(){
        PaymentKeyboardInput target=paymentKeyboardInput;paymentKeyboardInput=null;
        if(target!=null){Object tag=target.getTag();if(tag instanceof AlertDialog)((AlertDialog)tag).dismiss();}
    }
    private void closeDirectPaymentPage(){
        dismissPaymentKeyboard();
        if(directPaymentPage!=null){PaymentPageWebView old=directPaymentPage;directPaymentPage=null;old.nonce="";old.stopLoading();old.removeJavascriptInterface("StorePaymentKeyboard");if(old.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)old.getParent()).removeView(old);old.destroy();}
    }
    private void preparePaymentKeyboardWindow(android.view.Window window){
        if(window==null)return;
        // Keep Chromium's field/selection focused while native buttons are tapped.
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);
        window.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
    }
    private void paymentKeyboardDismissed(PaymentKeyboardInput target){
        sendPaymentKeyboardKey(target,"done","");
        if(paymentKeyboardInput==target)paymentKeyboardInput=null;
        if(target.page==directPaymentPage&&target.page.getLayoutParams() instanceof LinearLayout.LayoutParams){
            LinearLayout.LayoutParams lp=(LinearLayout.LayoutParams)target.page.getLayoutParams();lp.bottomMargin=0;target.page.setLayoutParams(lp);
        }
    }
    private final class PaymentKeyboardBridge{
        final PaymentPageWebView page;
        PaymentKeyboardBridge(PaymentPageWebView page){this.page=page;}
        @android.webkit.JavascriptInterface public void open(String nonce,String mode){
            main.post(()->{
                if(page!=directPaymentPage||!page.isAttachedToWindow()||!page.nonce.equals(nonce)||!isPaymentKeyboardOrigin(page.getUrl()))return;
                if(!"NUM".equals(mode)&&!"HE".equals(mode)&&!"EN".equals(mode))return;
                if(paymentKeyboardInput!=null&&paymentKeyboardInput.page==page&&paymentKeyboardInput.mode.equals(mode)&&paymentKeyboardInput.getTag() instanceof AlertDialog&&((AlertDialog)paymentKeyboardInput.getTag()).isShowing())return;
                // A focus move already selected the new DOM field. Do not blur it
                // when replacing the previous numeric/alphabetic keyboard.
                if(paymentKeyboardInput!=null){PaymentKeyboardInput previous=paymentKeyboardInput;paymentKeyboardInput=null;Object tag=previous.getTag();if(tag instanceof AlertDialog){((AlertDialog)tag).setOnDismissListener(d->previous.setTag(null));((AlertDialog)tag).dismiss();}}
                PaymentKeyboardInput target=new PaymentKeyboardInput(page,mode);paymentKeyboardInput=target;
                showAppKeyboard(target);hideSystemKeyboardHard();
                Object tag=target.getTag();
                if(tag instanceof AlertDialog){AlertDialog dialog=(AlertDialog)tag;android.view.Window w=dialog.getWindow();if(w!=null){w.getDecorView().setSystemUiVisibility(MainActivity.this.getWindow().getDecorView().getSystemUiVisibility());Runnable resize=()->{
                    if(page!=directPaymentPage||!dialog.isShowing())return;
                    int height=w.getDecorView().getHeight();LinearLayout.LayoutParams lp=(LinearLayout.LayoutParams)page.getLayoutParams();if(height>0&&lp.bottomMargin!=height){lp.bottomMargin=height;page.setLayoutParams(lp);}
                };w.getDecorView().addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->resize.run());w.getDecorView().post(resize);}}
            });
        }
    }
    private final class PaymentPageWebView extends WebView{
        String nonce="";
        PaymentPageWebView(){super(MainActivity.this);if(android.os.Build.VERSION.SDK_INT>=26)setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);addJavascriptInterface(new PaymentKeyboardBridge(this),"StorePaymentKeyboard");}
        // Do not create a connection to Samsung/Gboard, even before page JS loads.
        @Override public boolean onCheckIsTextEditor(){return false;}
        @Override public android.view.inputmethod.InputConnection onCreateInputConnection(android.view.inputmethod.EditorInfo info){return null;}
        void started(){nonce=java.util.UUID.randomUUID().toString();dismissPaymentKeyboard();hideSystemKeyboardHard();}
        void loaded(){if(!isPaymentKeyboardOrigin(getUrl()))return;evaluateJavascript(PAYMENT_KEYBOARD_JS.replace("__NONCE__",JSONObject.quote(nonce)),null);evaluateJavascript(PAYMENT_LAYOUT_JS,null);}
        @Override protected void onDetachedFromWindow(){if(this==directPaymentPage)dismissPaymentKeyboard();super.onDetachedFromWindow();}
    }


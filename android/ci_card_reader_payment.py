from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Runtime-only reader state. Card data is never persisted or logged.
field_marker='    private WebView paymentWebView;'
fields='''    private boolean paymentCardReaderMode=false;\n    private final StringBuilder paymentCardReaderBuffer=new StringBuilder();\n    private Runnable paymentCardReaderFlush=null;\n    private LinearLayout paymentKeyboardPanel=null;\n    private TextView paymentReaderStatus=null;\n    private Button paymentManualToggleButton=null;\n'''
if 'paymentCardReaderMode' not in s:
    if field_marker not in s: raise SystemExit('paymentWebView field marker not found')
    s=s.replace(field_marker,field_marker+'\n'+fields,1)

# Turn the local payment keyboard into a field so reader mode can hide it.
old='LinearLayout paymentKeyboard=buildPaymentNumericKeyboard();root.addView(paymentKeyboard,new LinearLayout.LayoutParams(-1,dp(215)));'
new='paymentKeyboardPanel=buildPaymentNumericKeyboard();root.addView(paymentKeyboardPanel,new LinearLayout.LayoutParams(-1,dp(215)));'
if old in s:s=s.replace(old,new,1)
elif 'paymentKeyboardPanel=buildPaymentNumericKeyboard()' not in s: raise SystemExit('payment keyboard marker not found')

helpers=r'''    private void setPaymentInputMode(boolean reader){
        paymentCardReaderMode=reader;paymentCardReaderBuffer.setLength(0);
        if(paymentKeyboardPanel!=null)paymentKeyboardPanel.setVisibility(reader?View.GONE:View.VISIBLE);
        if(chargeButton!=null)chargeButton.setVisibility(reader?View.GONE:View.VISIBLE);
        if(paymentReaderStatus!=null){
            paymentReaderStatus.setVisibility(View.VISIBLE);
            paymentReaderStatus.setText(reader?"אנא העבר כרטיס לתשלום":"הזן את פרטי הכרטיס");
        }
        if(paymentManualToggleButton!=null)paymentManualToggleButton.setText(reader?"להזנת פרטי כרטיס לחץ כאן":"חזרה להעברת כרטיס");
        if(paymentWebView!=null){
            android.view.ViewGroup.LayoutParams rawLp=paymentWebView.getLayoutParams();
            if(rawLp instanceof LinearLayout.LayoutParams){
                LinearLayout.LayoutParams lp=(LinearLayout.LayoutParams)rawLp;
                if(reader){lp.height=dp(1);lp.weight=0f;}else{lp.height=0;lp.weight=1f;}
                paymentWebView.setLayoutParams(lp);
            }
            paymentWebView.setAlpha(reader?0f:1f);
            paymentWebView.setVisibility(View.VISIBLE);
            if(reader){paymentWebView.requestFocus();main.postDelayed(()->sendPaymentWebKey(android.view.KeyEvent.KEYCODE_TAB),180);}
        }
    }
    private void sendPaymentWebKey(int code){
        if(paymentWebView==null)return;long now=android.os.SystemClock.uptimeMillis();paymentWebView.dispatchKeyEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_DOWN,code,0));paymentWebView.dispatchKeyEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_UP,code,0));
    }
    private void sendPaymentWebDigits(String digits){
        if(digits==null)return;for(int i=0;i<digits.length();i++){char c=digits.charAt(i);if(c>='0'&&c<='9')sendPaymentWebKey(android.view.KeyEvent.KEYCODE_0+(c-'0'));}
    }
    private void finishCardReaderSwipe(){
        String raw=paymentCardReaderBuffer.toString();paymentCardReaderBuffer.setLength(0);
        java.util.regex.Matcher m=java.util.regex.Pattern.compile("(\\d{12,19})[=D](\\d{4})").matcher(raw);
        if(!m.find()){if(paymentReaderStatus!=null)paymentReaderStatus.setText("לא הצלחתי לקרוא את הכרטיס. נסה שוב");return;}
        String pan=m.group(1),expiryYYMM=m.group(2);String expiry=expiryYYMM.substring(2,4)+expiryYYMM.substring(0,2);
        if(paymentReaderStatus!=null)paymentReaderStatus.setText("הכרטיס נקרא בהצלחה — מבצע תשלום...");
        paymentCardReaderMode=false;
        if(paymentWebView!=null){
            paymentWebView.requestFocus();
            main.postDelayed(()->{
                sendPaymentWebDigits(pan);
                sendPaymentWebKey(android.view.KeyEvent.KEYCODE_TAB);
                sendPaymentWebDigits(expiry);
                main.postDelayed(()->chargeCard(),500);
            },80);
        }
    }
    @Override public boolean dispatchKeyEvent(android.view.KeyEvent event){
        if(paymentCardReaderMode&&event.getAction()==android.view.KeyEvent.ACTION_DOWN){
            int code=event.getKeyCode();
            if(code==android.view.KeyEvent.KEYCODE_ENTER){finishCardReaderSwipe();return true;}
            int u=event.getUnicodeChar();char c=(char)u;
            if(Character.isDigit(c)||c=='='||c=='D'||c=='d')paymentCardReaderBuffer.append(c=='d'?'D':c);
            if(paymentCardReaderFlush!=null)main.removeCallbacks(paymentCardReaderFlush);
            paymentCardReaderFlush=()->{if(paymentCardReaderBuffer.length()>8)finishCardReaderSwipe();};main.postDelayed(paymentCardReaderFlush,180);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

'''
marker='    private void sendPaymentKey(String key)'
if 'private void setPaymentInputMode(boolean reader)' not in s:
    if marker not in s: raise SystemExit('sendPaymentKey marker not found')
    s=s.replace(marker,helpers+marker,1)

# Reader-first UX: a clear instruction, with manual card entry hidden behind one button.
pay_start=s.find('    private void showPayment(){')
pay_end=s.find('    private void chargeCard()',pay_start)
if pay_start<0 or pay_end<0: raise SystemExit('showPayment markers not found')
pay=s[pay_start:pay_end]
frame_marker='LinearLayout frameWrap=new LinearLayout(this);'
if 'paymentManualToggleButton=button(' not in pay:
    if frame_marker not in pay: raise SystemExit('frameWrap marker not found')
    selector='''paymentReaderStatus=text("אנא העבר כרטיס לתשלום",20,true);paymentReaderStatus.setGravity(Gravity.CENTER);paymentReaderStatus.setTextColor(Color.rgb(43,119,139));paymentReaderStatus.setPadding(dp(8),dp(12),dp(8),dp(8));body.addView(paymentReaderStatus,new LinearLayout.LayoutParams(-1,dp(58)));\n        paymentManualToggleButton=button("להזנת פרטי כרטיס לחץ כאן",Color.rgb(237,241,247),Color.DKGRAY);paymentManualToggleButton.setOnClickListener(v->setPaymentInputMode(!paymentCardReaderMode));LinearLayout.LayoutParams manualLp=new LinearLayout.LayoutParams(-1,dp(48));manualLp.setMargins(dp(8),0,dp(8),dp(10));body.addView(paymentManualToggleButton,manualLp);\n        '''
    pay=pay.replace(frame_marker,selector+frame_marker,1)

# If an older dual-mode selector is present from a prior transform shape, remove it.
old_selector='''LinearLayout modeRow=new LinearLayout(this);modeRow.setOrientation(LinearLayout.HORIZONTAL);modeRow.setGravity(Gravity.CENTER);modeRow.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);\n        Button swipeMode=button("העברת כרטיס",Color.rgb(43,119,139),Color.WHITE);Button manualMode=button("הקלדת פרטי כרטיס",Color.rgb(237,241,247),Color.DKGRAY);\n        swipeMode.setOnClickListener(v->setPaymentInputMode(true));manualMode.setOnClickListener(v->setPaymentInputMode(false));\n        LinearLayout.LayoutParams mlp=new LinearLayout.LayoutParams(0,dp(42),1);mlp.setMargins(dp(3),dp(4),dp(3),dp(4));modeRow.addView(swipeMode,mlp);modeRow.addView(manualMode,mlp);body.addView(modeRow,new LinearLayout.LayoutParams(-1,dp(50)));\n        paymentReaderStatus=text("",15,true);paymentReaderStatus.setGravity(Gravity.CENTER);paymentReaderStatus.setTextColor(Color.rgb(43,119,139));paymentReaderStatus.setVisibility(View.GONE);body.addView(paymentReaderStatus,new LinearLayout.LayoutParams(-1,dp(34)));\n        '''
pay=pay.replace(old_selector,'')

# Default to reader mode after the payment view has been attached.
if 'setPaymentInputMode(true)' not in pay:
    pay=pay.replace('setContentView(root);','setContentView(root);main.postDelayed(()->setPaymentInputMode(true),350);',1)

s=s[:pay_start]+pay+s[pay_end:]
p.write_text(s,encoding='utf-8')
print('Reader-first payment UX added: hidden manual fields, one manual-entry button, and automatic charge after swipe')

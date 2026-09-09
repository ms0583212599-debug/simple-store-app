from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
field_marker='    private WebView paymentWebView;'
fields='''    private boolean paymentCardReaderMode=false;\n    private final StringBuilder paymentCardReaderBuffer=new StringBuilder();\n    private Runnable paymentCardReaderFlush=null;\n    private LinearLayout paymentKeyboardPanel=null;\n    private LinearLayout paymentFrameWrap=null;\n    private TextView paymentReaderStatus=null;\n    private Button paymentManualToggleButton=null;\n'''
if 'paymentCardReaderMode' not in s:s=s.replace(field_marker,field_marker+'\n'+fields,1)
old='LinearLayout paymentKeyboard=buildPaymentNumericKeyboard();root.addView(paymentKeyboard,new LinearLayout.LayoutParams(-1,dp(215)));'
new='paymentKeyboardPanel=buildPaymentNumericKeyboard();root.addView(paymentKeyboardPanel,new LinearLayout.LayoutParams(-1,dp(215)));'
if old in s:s=s.replace(old,new,1)
elif 'paymentKeyboardPanel=buildPaymentNumericKeyboard()' not in s:raise SystemExit('payment keyboard marker not found')
helpers=r'''    private void setPaymentInputMode(boolean reader){
        paymentCardReaderMode=reader;paymentCardReaderBuffer.setLength(0);
        if(paymentReaderStatus!=null){paymentReaderStatus.setVisibility(View.VISIBLE);paymentReaderStatus.setText(reader?"אנא העבר כרטיס לתשלום":"הזן את פרטי הכרטיס");}
        if(paymentManualToggleButton!=null)paymentManualToggleButton.setText(reader?"להזנת פרטי כרטיס לחץ כאן":"חזרה להעברת כרטיס");
        if(paymentFrameWrap!=null){paymentFrameWrap.setVisibility(reader?View.GONE:View.VISIBLE);paymentFrameWrap.setAlpha(1f);}
        if(paymentKeyboardPanel!=null)paymentKeyboardPanel.setVisibility(reader?View.GONE:View.VISIBLE);
        if(chargeButton!=null)chargeButton.setVisibility(reader?View.GONE:View.VISIBLE);
        if(paymentWebView!=null){paymentWebView.setVisibility(View.VISIBLE);paymentWebView.setAlpha(1f);}
        if(!reader&&paymentFrameWrap!=null){android.view.ViewGroup.LayoutParams raw=paymentFrameWrap.getLayoutParams();if(raw instanceof LinearLayout.LayoutParams){LinearLayout.LayoutParams lp=(LinearLayout.LayoutParams)raw;lp.height=0;lp.weight=1f;paymentFrameWrap.setLayoutParams(lp);}paymentFrameWrap.requestLayout();}
        if(reader&&paymentWebView!=null){paymentWebView.requestFocus();main.postDelayed(()->sendPaymentWebKey(android.view.KeyEvent.KEYCODE_TAB),180);}
    }
    private void sendPaymentWebKey(int code){if(paymentWebView==null)return;long now=android.os.SystemClock.uptimeMillis();paymentWebView.dispatchKeyEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_DOWN,code,0));paymentWebView.dispatchKeyEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_UP,code,0));}
    private void sendPaymentWebDigits(String digits){if(digits==null)return;for(int i=0;i<digits.length();i++){char c=digits.charAt(i);if(c>='0'&&c<='9')sendPaymentWebKey(android.view.KeyEvent.KEYCODE_0+(c-'0'));}}
    private void finishCardReaderSwipe(){String raw=paymentCardReaderBuffer.toString();paymentCardReaderBuffer.setLength(0);java.util.regex.Matcher m=java.util.regex.Pattern.compile("(\\d{12,19})[=D](\\d{4})").matcher(raw);if(!m.find()){if(paymentReaderStatus!=null)paymentReaderStatus.setText("לא הצלחתי לקרוא את הכרטיס. נסה שוב");return;}String pan=m.group(1),expiryYYMM=m.group(2);String expiry=expiryYYMM.substring(2,4)+expiryYYMM.substring(0,2);if(paymentReaderStatus!=null)paymentReaderStatus.setText("הכרטיס נקרא בהצלחה — מבצע תשלום...");paymentCardReaderMode=false;if(paymentWebView!=null){paymentWebView.requestFocus();main.postDelayed(()->{sendPaymentWebDigits(pan);sendPaymentWebKey(android.view.KeyEvent.KEYCODE_TAB);sendPaymentWebDigits(expiry);main.postDelayed(()->chargeCard(),500);},80);}}
    @Override public boolean dispatchKeyEvent(android.view.KeyEvent event){if(paymentCardReaderMode&&event.getAction()==android.view.KeyEvent.ACTION_DOWN){int code=event.getKeyCode();if(code==android.view.KeyEvent.KEYCODE_ENTER){finishCardReaderSwipe();return true;}int u=event.getUnicodeChar();char c=(char)u;if(Character.isDigit(c)||c=='='||c=='D'||c=='d')paymentCardReaderBuffer.append(c=='d'?'D':c);if(paymentCardReaderFlush!=null)main.removeCallbacks(paymentCardReaderFlush);paymentCardReaderFlush=()->{if(paymentCardReaderBuffer.length()>8)finishCardReaderSwipe();};main.postDelayed(paymentCardReaderFlush,180);return true;}return super.dispatchKeyEvent(event);}

'''
marker='    private void sendPaymentKey(String key)'
if 'private void setPaymentInputMode(boolean reader)' not in s:
    if marker not in s:raise SystemExit('sendPaymentKey marker not found')
    s=s.replace(marker,helpers+marker,1)
pay_start=s.find('    private void showPayment(){');pay_end=s.find('    private void chargeCard()',pay_start)
if pay_start<0 or pay_end<0:raise SystemExit('showPayment markers not found')
pay=s[pay_start:pay_end]
frame_marker='LinearLayout frameWrap=new LinearLayout(this);'
if 'paymentManualToggleButton=button(' not in pay:
    selector='''paymentReaderStatus=text("אנא העבר כרטיס לתשלום",20,true);paymentReaderStatus.setGravity(Gravity.CENTER);paymentReaderStatus.setTextColor(Color.rgb(43,119,139));body.addView(paymentReaderStatus,new LinearLayout.LayoutParams(-1,dp(48)));\n        paymentManualToggleButton=button("להזנת פרטי כרטיס לחץ כאן",Color.rgb(237,241,247),Color.DKGRAY);paymentManualToggleButton.setOnClickListener(v->{boolean goReader=!paymentCardReaderMode;setPaymentInputMode(goReader);});body.addView(paymentManualToggleButton,new LinearLayout.LayoutParams(-1,dp(44)));\n        '''
    if frame_marker not in pay:raise SystemExit('frame marker not found')
    pay=pay.replace(frame_marker,selector+frame_marker,1)
if 'paymentFrameWrap=frameWrap;' not in pay:pay=pay.replace(frame_marker,'LinearLayout frameWrap=new LinearLayout(this);paymentFrameWrap=frameWrap;',1)
# Ensure reader mode starts only after every payment view (including keyboard) has been created.
if 'main.postDelayed(()->setPaymentInputMode(true),350);' not in pay:pay=pay.replace('setContentView(root);','setContentView(root);main.postDelayed(()->setPaymentInputMode(true),350);',1)
s=s[:pay_start]+pay+s[pay_end:]
p.write_text(s,encoding='utf-8')
print('Reliable manual card mode: Nedarim fields, app keypad and charge button are explicitly restored')

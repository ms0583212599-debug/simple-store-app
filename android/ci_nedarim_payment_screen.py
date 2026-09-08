from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Keep the proven Nedarim payment transaction flow. This transform only changes the
# Android payment shell and bridges taps inside the iframe to the same app keyboard
# used by customer product search.

# Replace payment shell after payment confirmation transform has already run.
start=s.find('    private void showPayment(){')
end=s.find('    private void chargeCard(){',start)
if start<0 or end<0: raise SystemExit('payment screen markers not found')
old=s[start:end]

# Preserve the current hardened WebView settings and readiness HTML by extracting them.
web_line=None
html_line=None
for line in old.splitlines():
    if 'paymentWebView=new WebView(this);' in line: web_line=line.strip()
    if 'String html=' in line: html_line=line.strip()
if not web_line or not html_line: raise SystemExit('hardened payment WebView/html not found')

# Add JS that tells Android which iframe field was tapped. No system keyboard is shown;
# Android opens the existing in-app keyboard against a hidden EditText bridge.
html_line=html_line.replace("frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});});", "frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});setTimeout(()=>{try{frame.contentWindow.postMessage({Name:'HideKeyboard'},'*')}catch(e){}},250);});")

new='''    private void showPayment(){
        LinearLayout root=baseRoot();root.setBackgroundColor(Color.WHITE);root.setPadding(dp(18),dp(8),dp(18),dp(10));
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(4),dp(4),dp(4),dp(6));
        Button back=button("‹  חזור",Color.WHITE,blue);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(130),dp(50)));
        TextView title=text("תשלום",27,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(50),1));
        View spacer=new View(this);top.addView(spacer,new LinearLayout.LayoutParams(dp(130),dp(50)));root.addView(top);

        TextView instruction=text("פרטי תשלום",20,true);instruction.setGravity(Gravity.CENTER);instruction.setTextColor(Color.rgb(70,82,94));instruction.setPadding(0,dp(2),0,dp(2));root.addView(instruction);
        paymentStatus=text(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal),26,true);paymentStatus.setGravity(Gravity.CENTER);paymentStatus.setTextColor(Color.rgb(31,111,132));paymentStatus.setPadding(0,0,0,dp(6));root.addView(paymentStatus);

        '''+web_line+'''
        LinearLayout.LayoutParams wlp=(LinearLayout.LayoutParams)paymentWebView.getLayoutParams();wlp.setMargins(dp(6),0,dp(6),dp(6));paymentWebView.setLayoutParams(wlp);

        paymentFrameReady=false;chargeButton=button("טוען תשלום...",green,Color.WHITE);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(64));cp.setMargins(dp(6),dp(4),dp(6),0);root.addView(chargeButton,cp);setContentView(root);
        '''+html_line+'''
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

'''
s=s[:start]+new+s[end:]

# Extend the existing PaymentBridge without replacing its proven payment confirmation logic.
needle='    public class PaymentBridge{'
if needle not in s: raise SystemExit('PaymentBridge marker not found')
if 'openPaymentKeyboard' not in s:
    insert='''    private void openPaymentKeyboard(){
        final EditText bridge=input("");bridge.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);configureAppInput(bridge);bridge.setVisibility(View.INVISIBLE);
        LinearLayout host=new LinearLayout(this);host.addView(bridge,new LinearLayout.LayoutParams(1,1));addContentView(host,new android.view.ViewGroup.LayoutParams(1,1));
        bridge.requestFocus();showAppKeyboard(bridge);
    }

'''
    s=s.replace(needle,insert+needle,1)

p.write_text(s,encoding='utf-8')
print('Nedarim-style payment shell applied; recurring-payment UI not added; existing transaction flow preserved')

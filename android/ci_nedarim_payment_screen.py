from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Visual-only refinement around the proven payment iframe/transaction flow.
start=s.find('    private void showPayment(){')
end=s.find('    private void chargeCard(){',start)
if start<0 or end<0: raise SystemExit('payment screen markers not found')
old=s[start:end]
web_line=None;html_line=None
for line in old.splitlines():
    if 'paymentWebView=new WebView(this);' in line:web_line=line.strip()
    if 'String html=' in line:html_line=line.strip()
if not web_line or not html_line:raise SystemExit('hardened payment WebView/html not found')
html_line=html_line.replace("frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});});","frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});setTimeout(()=>{try{frame.contentWindow.postMessage({Name:'HideKeyboard'},'*')}catch(e){}},250);});")

new='''    private void showPayment(){
        LinearLayout root=baseRoot();root.setBackgroundColor(Color.rgb(247,248,249));root.setPadding(dp(12),dp(6),dp(12),dp(8));

        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(4),0,dp(4),dp(2));
        Button back=button("‹  חזור",Color.WHITE,Color.rgb(65,92,108));back.setTextSize(16);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(112),dp(42)));
        TextView title=text("תשלום מאובטח",25,true);title.setTextColor(Color.rgb(54,65,74));title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(44),1));
        View spacer=new View(this);top.addView(spacer,new LinearLayout.LayoutParams(dp(112),dp(42)));root.addView(top);

        paymentStatus=text(String.format(Locale.US,"סכום לתשלום  %.2f ₪",saleTotal),22,true);paymentStatus.setGravity(Gravity.CENTER);paymentStatus.setTextColor(Color.rgb(51,105,123));paymentStatus.setPadding(0,dp(2),0,dp(4));root.addView(paymentStatus);

        LinearLayout frameWrap=new LinearLayout(this);frameWrap.setOrientation(LinearLayout.VERTICAL);frameWrap.setPadding(dp(5),dp(5),dp(5),dp(5));android.graphics.drawable.GradientDrawable fbg=new android.graphics.drawable.GradientDrawable();fbg.setColor(Color.WHITE);fbg.setCornerRadius(dp(5));fbg.setStroke(dp(1),Color.rgb(211,216,220));frameWrap.setBackground(fbg);root.addView(frameWrap,new LinearLayout.LayoutParams(-1,0,1));
        '''+web_line+'''
        android.view.ViewGroup parent=(android.view.ViewGroup)paymentWebView.getParent();if(parent!=null)parent.removeView(paymentWebView);frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));

        paymentFrameReady=false;chargeButton=button("טוען תשלום...",Color.rgb(77,157,88),Color.WHITE);chargeButton.setTextSize(20);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(54));cp.setMargins(dp(5),dp(6),dp(5),0);root.addView(chargeButton,cp);setContentView(root);
        '''+html_line+'''
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

'''
s=s[:start]+new+s[end:]

p.write_text(s,encoding='utf-8')
print('Payment screen shell aligned more closely to Nedarim reference; proven payment flow preserved; no recurring-payment UI added')

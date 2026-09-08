from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java');s=p.read_text(encoding='utf-8')
start=s.find('    private void showPayment(){');end=s.find('    private void chargeCard(){',start)
if start<0 or end<0:raise SystemExit('payment screen markers not found')
old=s[start:end];web_line=None;html_line=None
for line in old.splitlines():
    if 'paymentWebView=new WebView(this);' in line:web_line=line.strip()
    if 'String html=' in line:html_line=line.strip()
if not web_line or not html_line:raise SystemExit('hardened payment WebView/html not found')
html_line=html_line.replace("frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});});","frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});setTimeout(()=>{try{frame.contentWindow.postMessage({Name:'HideKeyboard'},'*')}catch(e){}},250);});")
new='''    private void showPayment(){
        LinearLayout root=baseRoot();root.setBackgroundColor(Color.rgb(247,248,249));root.setPadding(dp(12),dp(6),dp(12),dp(8));
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);Button back=button("‹  חזור",Color.WHITE,Color.rgb(65,92,108));back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(112),dp(42)));TextView title=text("תשלום",23,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(42),1));top.addView(new View(this),new LinearLayout.LayoutParams(dp(112),dp(42)));root.addView(top);
        root.addView(new View(this),new LinearLayout.LayoutParams(-1,0,.35f));
        paymentStatus=text(String.format(Locale.US,"סכום לתשלום  %.2f ₪",saleTotal),21,true);paymentStatus.setGravity(Gravity.CENTER);paymentStatus.setTextColor(Color.rgb(51,105,123));paymentStatus.setPadding(0,0,0,dp(5));root.addView(paymentStatus);
        LinearLayout frameWrap=new LinearLayout(this);frameWrap.setOrientation(LinearLayout.VERTICAL);frameWrap.setPadding(dp(5),dp(5),dp(5),dp(5));android.graphics.drawable.GradientDrawable fbg=new android.graphics.drawable.GradientDrawable();fbg.setColor(Color.WHITE);fbg.setCornerRadius(dp(5));fbg.setStroke(dp(1),Color.rgb(211,216,220));frameWrap.setBackground(fbg);root.addView(frameWrap,new LinearLayout.LayoutParams(-1,dp(330)));
        '''+web_line+'''
        android.view.ViewGroup parent=(android.view.ViewGroup)paymentWebView.getParent();if(parent!=null)parent.removeView(paymentWebView);frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,-1));
        TextView confirm=text("אישור תשלום",20,true);confirm.setGravity(Gravity.CENTER);confirm.setTextColor(Color.rgb(54,65,74));confirm.setPadding(0,dp(8),0,dp(4));root.addView(confirm);
        paymentFrameReady=false;chargeButton=button("טוען תשלום...",Color.rgb(77,157,88),Color.WHITE);chargeButton.setTextSize(20);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(54));cp.setMargins(dp(5),0,dp(5),0);root.addView(chargeButton,cp);root.addView(new View(this),new LinearLayout.LayoutParams(-1,0,.65f));setContentView(root);
        '''+html_line+'''
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

'''
s=s[:start]+new+s[end:];p.write_text(s,encoding='utf-8');print('Payment entry centered; confirmation placed directly below card fields')

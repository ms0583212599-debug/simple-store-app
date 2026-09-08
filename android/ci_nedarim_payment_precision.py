from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
start=s.find('    private void showPayment(){')
end=s.find('    private void chargeCard(){', start)
if start < 0 or end < 0: raise SystemExit('payment screen markers not found')
old=s[start:end]
web_line=html_line=None
for line in old.splitlines():
    stripped=line.strip()
    if 'paymentWebView=new WebView(this);' in stripped: web_line=stripped
    if stripped.startswith('String html='): html_line=stripped
if not web_line or not html_line: raise SystemExit('hardened payment WebView/html not found')

new='''    private void showPayment(){
        LinearLayout root=baseRoot();
        root.setBackgroundColor(Color.rgb(247,248,249));
        root.setPadding(dp(10),dp(5),dp(10),dp(7));

        LinearLayout nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER_VERTICAL);
        Button back=button("‹  חזור",Color.WHITE,Color.rgb(65,92,108));back.setOnClickListener(v->showCart());
        nav.addView(back,new LinearLayout.LayoutParams(dp(100),dp(38)));
        nav.addView(new View(this),new LinearLayout.LayoutParams(0,dp(38),1));
        root.addView(nav,new LinearLayout.LayoutParams(-1,dp(40)));

        LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);body.setPadding(dp(24),dp(2),dp(24),0);
        root.addView(body,new LinearLayout.LayoutParams(-1,0,1));

        TextView tab=text("חיוב בודד / תשלומים",17,true);tab.setGravity(Gravity.CENTER);tab.setTextColor(Color.WHITE);tab.setBackground(roundRect(Color.rgb(43,119,139),Color.rgb(43,119,139),0,1));
        LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(-1,dp(42));tp.setMargins(0,0,0,dp(7));body.addView(tab,tp);

        TextView amountLabel=text("סכום לחיוב",15,false);amountLabel.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);amountLabel.setTextColor(Color.rgb(70,76,82));body.addView(amountLabel,new LinearLayout.LayoutParams(-1,dp(25)));
        paymentStatus=text(String.format(Locale.US,"%.2f ₪",saleTotal),17,true);paymentStatus.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);paymentStatus.setPadding(dp(10),0,dp(10),0);paymentStatus.setTextColor(Color.rgb(49,77,91));paymentStatus.setBackground(roundRect(Color.WHITE,Color.rgb(188,194,199),1,1));body.addView(paymentStatus,new LinearLayout.LayoutParams(-1,dp(44)));

        TextView installmentsLabel=text("מספר תשלומים",15,false);installmentsLabel.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);installmentsLabel.setTextColor(Color.rgb(70,76,82));LinearLayout.LayoutParams ilp=new LinearLayout.LayoutParams(-1,dp(25));ilp.setMargins(0,dp(4),0,0);body.addView(installmentsLabel,ilp);
        TextView installmentsValue=text("1",17,true);installmentsValue.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);installmentsValue.setPadding(dp(10),0,dp(10),0);installmentsValue.setTextColor(Color.rgb(49,77,91));installmentsValue.setBackground(roundRect(Color.WHITE,Color.rgb(188,194,199),1,1));body.addView(installmentsValue,new LinearLayout.LayoutParams(-1,dp(44)));

        LinearLayout frameWrap=new LinearLayout(this);frameWrap.setPadding(dp(1),dp(1),dp(1),dp(1));frameWrap.setBackground(roundRect(Color.WHITE,Color.rgb(205,211,216),1,1));LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,0,1);fp.setMargins(0,dp(7),0,dp(7));body.addView(frameWrap,fp);
        '''+web_line+'''
        android.view.ViewGroup parent=(android.view.ViewGroup)paymentWebView.getParent();if(parent!=null)parent.removeView(paymentWebView);frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,-1));
        paymentFrameReady=false;chargeButton=button("טוען תשלום...",Color.rgb(77,157,88),Color.WHITE);chargeButton.setTextSize(18);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());body.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(48)));
        setContentView(root);
        '''+html_line+'''
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

'''
s=s[:start]+new+s[end:]
p.write_text(s,encoding='utf-8')
print('Nedarim payment reference styling applied')

from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

start=s.find('    private void showPayment(){')
end=s.find('    private void chargeCard(){', start)
if start < 0 or end < 0:
    raise SystemExit('payment screen markers not found')
old=s[start:end]

web_line=None
html_line=None
for line in old.splitlines():
    stripped=line.strip()
    if 'paymentWebView=new WebView(this);' in stripped:
        web_line=stripped
    if stripped.startswith('String html='):
        html_line=stripped

if not web_line or not html_line:
    raise SystemExit('hardened payment WebView/html not found')

new='''    private void showPayment(){
        LinearLayout root=baseRoot();
        root.setBackgroundColor(Color.rgb(247,248,249));
        root.setPadding(dp(12),dp(6),dp(12),dp(8));

        LinearLayout top=new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        Button back=button("‹  חזור",Color.WHITE,Color.rgb(65,92,108));
        back.setOnClickListener(v->showCart());
        top.addView(back,new LinearLayout.LayoutParams(dp(104),dp(40)));
        TextView title=text("תשלום",22,true);
        title.setGravity(Gravity.CENTER);
        top.addView(title,new LinearLayout.LayoutParams(0,dp(40),1));
        top.addView(new View(this),new LinearLayout.LayoutParams(dp(104),dp(40)));
        root.addView(top,new LinearLayout.LayoutParams(-1,dp(44)));

        LinearLayout body=new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);
        body.setPadding(dp(28),dp(4),dp(28),0);
        root.addView(body,new LinearLayout.LayoutParams(-1,0,1));

        TextView tab=text("חיוב בודד / תשלומים",17,true);
        tab.setGravity(Gravity.CENTER);
        tab.setTextColor(Color.WHITE);
        tab.setBackground(roundRect(Color.rgb(43,119,139),Color.rgb(43,119,139),0,2));
        LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(-1,dp(43));
        tp.setMargins(0,0,0,dp(8));
        body.addView(tab,tp);

        LinearLayout amountRow=new LinearLayout(this);
        amountRow.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        amountRow.setGravity(Gravity.CENTER_VERTICAL);
        amountRow.setPadding(dp(12),0,dp(12),0);
        amountRow.setBackground(roundRect(Color.WHITE,Color.rgb(190,197,203),1,2));
        TextView amountLabel=text("סכום לחיוב",16,true);
        amountLabel.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        amountLabel.setTextColor(Color.rgb(68,76,83));
        amountRow.addView(amountLabel,new LinearLayout.LayoutParams(0,-1,1));
        paymentStatus=text(String.format(Locale.US,"%.2f ₪",saleTotal),18,true);
        paymentStatus.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL);
        paymentStatus.setTextColor(Color.rgb(45,104,123));
        amountRow.addView(paymentStatus,new LinearLayout.LayoutParams(dp(170),-1));
        body.addView(amountRow,new LinearLayout.LayoutParams(-1,dp(48)));

        LinearLayout installmentsRow=new LinearLayout(this);
        installmentsRow.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        installmentsRow.setGravity(Gravity.CENTER_VERTICAL);
        installmentsRow.setPadding(dp(12),0,dp(12),0);
        installmentsRow.setBackground(roundRect(Color.WHITE,Color.rgb(190,197,203),1,2));
        TextView installmentsLabel=text("מספר תשלומים",16,true);
        installmentsLabel.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);
        installmentsLabel.setTextColor(Color.rgb(68,76,83));
        installmentsRow.addView(installmentsLabel,new LinearLayout.LayoutParams(0,-1,1));
        TextView installmentsValue=text("1",18,true);
        installmentsValue.setGravity(Gravity.LEFT|Gravity.CENTER_VERTICAL);
        installmentsValue.setTextColor(Color.rgb(45,104,123));
        installmentsRow.addView(installmentsValue,new LinearLayout.LayoutParams(dp(170),-1));
        LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(-1,dp(48));
        ip.setMargins(0,dp(6),0,dp(7));
        body.addView(installmentsRow,ip);

        LinearLayout frameWrap=new LinearLayout(this);
        frameWrap.setPadding(dp(2),dp(2),dp(2),dp(2));
        frameWrap.setBackground(roundRect(Color.WHITE,Color.rgb(205,211,216),1,2));
        LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,0,1);
        fp.setMargins(0,0,0,dp(7));
        body.addView(frameWrap,fp);

        '''+web_line+'''
        android.view.ViewGroup parent=(android.view.ViewGroup)paymentWebView.getParent();
        if(parent!=null)parent.removeView(paymentWebView);
        frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,-1));

        paymentFrameReady=false;
        chargeButton=button("טוען תשלום...",Color.rgb(77,157,88),Color.WHITE);
        chargeButton.setTextSize(19);
        chargeButton.setEnabled(false);
        chargeButton.setOnClickListener(v->chargeCard());
        LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(52));
        cp.setMargins(0,0,0,0);
        body.addView(chargeButton,cp);

        setContentView(root);
        '''+html_line+'''
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

'''

s=s[:start]+new+s[end:]
p.write_text(s,encoding='utf-8')
print('Responsive Nedarim payment precision styling applied')

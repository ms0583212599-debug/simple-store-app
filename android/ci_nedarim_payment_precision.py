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
        LinearLayout root=baseRoot();root.setBackgroundColor(Color.rgb(250,250,250));root.setPadding(dp(10),dp(5),dp(10),dp(7));
        LinearLayout nav=new LinearLayout(this);nav.setGravity(Gravity.CENTER_VERTICAL);Button back=button("‹  חזור",Color.WHITE,Color.rgb(65,92,108));back.setOnClickListener(v->showCart());nav.addView(back,new LinearLayout.LayoutParams(dp(100),dp(38)));nav.addView(new View(this),new LinearLayout.LayoutParams(0,dp(38),1));root.addView(nav,new LinearLayout.LayoutParams(-1,dp(40)));
        LinearLayout body=new LinearLayout(this);body.setOrientation(LinearLayout.VERTICAL);body.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);body.setPadding(dp(24),dp(2),dp(24),0);root.addView(body,new LinearLayout.LayoutParams(-1,0,1));

        LinearLayout choice=new LinearLayout(this);choice.setOrientation(LinearLayout.VERTICAL);choice.setGravity(Gravity.CENTER);choice.setPadding(dp(8),dp(10),dp(8),dp(8));choice.setBackground(roundRect(Color.WHITE,Color.rgb(218,218,218),1,3));
        TextView icon=text("▣",25,true);icon.setGravity(Gravity.CENTER);icon.setTextColor(Color.rgb(73,124,196));android.graphics.drawable.GradientDrawable iconBg=new android.graphics.drawable.GradientDrawable();iconBg.setShape(android.graphics.drawable.GradientDrawable.OVAL);iconBg.setColor(Color.rgb(255,215,58));icon.setBackground(iconBg);choice.addView(icon,new LinearLayout.LayoutParams(dp(42),dp(42)));
        TextView choiceTitle=text("חיוב בודד / תשלומים",16,false);choiceTitle.setGravity(Gravity.CENTER);choiceTitle.setTextColor(Color.rgb(20,20,20));LinearLayout.LayoutParams ctlp=new LinearLayout.LayoutParams(-1,dp(27));ctlp.setMargins(0,dp(7),0,0);choice.addView(choiceTitle,ctlp);
        TextView choiceSub=text("באמצעות אשראי",12,false);choiceSub.setGravity(Gravity.CENTER);choiceSub.setTextColor(Color.rgb(125,125,125));choice.addView(choiceSub,new LinearLayout.LayoutParams(-1,dp(22)));
        LinearLayout.LayoutParams choiceLp=new LinearLayout.LayoutParams(dp(155),dp(140));choiceLp.gravity=Gravity.CENTER_HORIZONTAL;choiceLp.setMargins(0,0,0,dp(9));body.addView(choice,choiceLp);

        TextView amountLabel=text("סכום לחיוב",15,false);amountLabel.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);amountLabel.setTextColor(Color.rgb(70,76,82));body.addView(amountLabel,new LinearLayout.LayoutParams(-1,dp(24)));
        paymentStatus=text(String.format(Locale.US,"%.2f ₪",saleTotal),17,true);paymentStatus.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);paymentStatus.setPadding(dp(10),0,dp(10),0);paymentStatus.setTextColor(Color.rgb(49,77,91));paymentStatus.setBackground(roundRect(Color.WHITE,Color.rgb(188,194,199),1,1));body.addView(paymentStatus,new LinearLayout.LayoutParams(-1,dp(42)));
        TextView installmentsLabel=text("מספר תשלומים",15,false);installmentsLabel.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);installmentsLabel.setTextColor(Color.rgb(70,76,82));LinearLayout.LayoutParams ilp=new LinearLayout.LayoutParams(-1,dp(24));ilp.setMargins(0,dp(3),0,0);body.addView(installmentsLabel,ilp);
        TextView installmentsValue=text("1",17,true);installmentsValue.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);installmentsValue.setPadding(dp(10),0,dp(10),0);installmentsValue.setTextColor(Color.rgb(49,77,91));installmentsValue.setBackground(roundRect(Color.WHITE,Color.rgb(188,194,199),1,1));body.addView(installmentsValue,new LinearLayout.LayoutParams(-1,dp(42)));
        LinearLayout frameWrap=new LinearLayout(this);frameWrap.setPadding(dp(1),dp(1),dp(1),dp(1));frameWrap.setBackground(roundRect(Color.WHITE,Color.rgb(205,211,216),1,1));LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,0,1);fp.setMargins(0,dp(6),0,dp(6));body.addView(frameWrap,fp);
        '''+web_line+'''
        android.view.ViewGroup parent=(android.view.ViewGroup)paymentWebView.getParent();if(parent!=null)parent.removeView(paymentWebView);frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,-1));
        paymentFrameReady=false;chargeButton=button("טוען תשלום...",Color.rgb(77,157,88),Color.WHITE);chargeButton.setTextSize(18);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());body.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(48)));setContentView(root);
        '''+html_line+'''
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

'''
s=s[:start]+new+s[end:]
p.write_text(s,encoding='utf-8')
print('Nedarim credit choice card styling applied')

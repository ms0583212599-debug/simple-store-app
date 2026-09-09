from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# State for general-amount checkout.
needle='    private double saleTotal = 0;'
if needle not in s: raise SystemExit('saleTotal marker missing')
s=s.replace(needle,needle+'\n    private boolean generalAmountCheckout = false;',1)

# Add special customer entries before the normal category list.
old='grid.removeAllViews();for(Category c:categories){boolean catMatch=q.isEmpty()||c.name.toLowerCase(Locale.ROOT).contains(q);'
new='grid.removeAllViews();if(q.isEmpty()){View all=customerSpecialRow("כל המוצרים");all.setOnClickListener(v->showAllCustomerProducts());GridLayout.LayoutParams agp=new GridLayout.LayoutParams();agp.width=GridLayout.LayoutParams.MATCH_PARENT;agp.height=dp(68);agp.setMargins(0,dp(2),0,dp(2));grid.addView(all,agp);if(generalAmountEnabled()){View ga=customerSpecialRow("סכום כללי  |  מחשבון");ga.setOnClickListener(v->showGeneralAmountCalculator());GridLayout.LayoutParams ggp=new GridLayout.LayoutParams();ggp.width=GridLayout.LayoutParams.MATCH_PARENT;ggp.height=dp(68);ggp.setMargins(0,dp(2),0,dp(2));grid.addView(ga,ggp);}}for(Category c:categories){boolean catMatch=q.isEmpty()||c.name.toLowerCase(Locale.ROOT).contains(q);'
if old not in s: raise SystemExit('home render marker missing')
s=s.replace(old,new,1)

# Payment back returns to calculator for general amount, cart otherwise.
start=s.find('    private void showPayment(){'); end=s.find('    private void chargeCard(){',start)
if start<0 or end<0: raise SystemExit('payment markers missing')
pay=s[start:end]
pay=pay.replace('back.setOnClickListener(v->showCart());','back.setOnClickListener(v->{if(generalAmountCheckout)showGeneralAmountCalculator();else showCart();});',1)
s=s[:start]+pay+s[end:]

# Normal product checkout resets general mode.
old='    private void startCheckout(){\n        if(cart.isEmpty())return;'
new='    private void startCheckout(){\n        generalAmountCheckout=false;\n        if(cart.isEmpty())return;'
if old not in s: raise SystemExit('startCheckout marker missing')
s=s.replace(old,new,1)

# Add management toggle near the top of the final admin home without replacing other admin features.
start=s.find('    private void showAdminHome(){')
if start<0: raise SystemExit('admin home missing')
brace=s.find('{',start)
pos=s.find('\n',brace)+1
admin_insert='''        Button generalToggle=button(generalAmountEnabled()?"סכום כללי ללקוחות: פעיל":"סכום כללי ללקוחות: כבוי",generalAmountEnabled()?green:Color.WHITE,generalAmountEnabled()?Color.WHITE:blue);generalToggle.setOnClickListener(v->{boolean next=!generalAmountEnabled();getSharedPreferences("customer_options",MODE_PRIVATE).edit().putBoolean("general_amount",next).apply();showAdminHome();});LinearLayout.LayoutParams generalToggleLp=new LinearLayout.LayoutParams(-1,dp(60));generalToggleLp.setMargins(0,0,0,dp(12));content.addView(generalToggle,generalToggleLp);\n'''
line_end=s.find('\n',s.find('buildShell(',start))+1
if line_end<=0: raise SystemExit('admin buildShell missing')
s=s[:line_end]+admin_insert+s[line_end:]

helpers=r'''
    private boolean generalAmountEnabled(){return getSharedPreferences("customer_options",MODE_PRIVATE).getBoolean("general_amount",true);}

    private View customerSpecialRow(String label){
        LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(5),dp(3),dp(5),dp(3));card.setBackground(roundRect(Color.WHITE,Color.rgb(202,207,211),1,2));
        TextView arrow=text("‹",22,false);arrow.setGravity(Gravity.CENTER);arrow.setTextColor(Color.rgb(92,99,105));card.addView(arrow,new LinearLayout.LayoutParams(dp(34),-1));
        TextView name=text(label,17,true);name.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);name.setTextColor(Color.rgb(62,72,82));name.setPadding(dp(5),0,dp(8),0);card.addView(name,new LinearLayout.LayoutParams(0,-1,1));
        TextView icon=text("כל המוצרים".equals(label)?"▦":"🧮",25,true);icon.setGravity(Gravity.CENTER);icon.setTextColor(Color.rgb(43,119,139));card.addView(icon,new LinearLayout.LayoutParams(dp(76),dp(60)));return card;
    }

    private void showAllCustomerProducts(){
        buildShell("כל המוצרים",this::showHome,true);TextView h=text("כל המוצרים",21,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(4),0,dp(8));content.addView(h);
        for(Product p:products)if(p.showToCustomers)content.addView(productCard(p),new LinearLayout.LayoutParams(-1,dp(74)));refreshMiniCart();
    }

    private void showGeneralAmountCalculator(){
        buildShell("סכום כללי",this::showHome,true);generalAmountCheckout=true;
        TextView display=text("0",30,true);display.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);display.setPadding(dp(16),0,dp(16),0);display.setBackground(roundRect(Color.WHITE,Color.rgb(188,194,199),1,3));content.addView(display,new LinearLayout.LayoutParams(-1,dp(68)));
        final String[] expr={""};
        String[][] keys={{"7","8","9","÷"},{"4","5","6","×"},{"1","2","3","−"},{"C","0",".","+"}};
        for(String[] row:keys){LinearLayout r=new LinearLayout(this);r.setGravity(Gravity.CENTER);for(String k:row){Button b=button(k,Color.WHITE,Color.rgb(55,70,82));b.setTextSize(21);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(58),1);lp.setMargins(dp(3),dp(3),dp(3),dp(3));r.addView(b,lp);b.setOnClickListener(v->{if("C".equals(k))expr[0]="";else expr[0]+=k;display.setText(expr[0].isEmpty()?"0":expr[0]);});}content.addView(r);}
        LinearLayout actions=new LinearLayout(this);Button eq=button("=",Color.rgb(119,125,130),Color.WHITE);Button pay=button("מעבר לתשלום",green,Color.WHITE);actions.addView(eq,new LinearLayout.LayoutParams(0,dp(62),1));LinearLayout.LayoutParams plp=new LinearLayout.LayoutParams(0,dp(62),2);plp.setMargins(dp(8),0,0,0);actions.addView(pay,plp);LinearLayout.LayoutParams alp=new LinearLayout.LayoutParams(-1,dp(62));alp.setMargins(0,dp(10),0,0);content.addView(actions,alp);
        eq.setOnClickListener(v->{try{double x=evalAmount(expr[0]);expr[0]=String.format(Locale.US,"%.2f",x);display.setText(expr[0]+" ₪");}catch(Exception e){Toast.makeText(this,"בדוק את החישוב",Toast.LENGTH_SHORT).show();}});
        pay.setOnClickListener(v->{try{double x=evalAmount(expr[0]);if(x<=0)throw new Exception();startGeneralAmountCheckout(x);}catch(Exception e){Toast.makeText(this,"יש להזין סכום תקין",Toast.LENGTH_SHORT).show();}});
    }

    private double evalAmount(String raw)throws Exception{
        String x=raw.replace('×','*').replace('÷','/').replace('−','-').replace(" ","");if(x.isEmpty())throw new Exception();
        final String z=x;class P{int i=0;double expr()throws Exception{double v=term();while(i<z.length()){char c=z.charAt(i);if(c!='+'&&c!='-')break;i++;double n=term();v=c=='+'?v+n:v-n;}return v;}double term()throws Exception{double v=num();while(i<z.length()){char c=z.charAt(i);if(c!='*'&&c!='/')break;i++;double n=num();if(c=='/'&&n==0)throw new Exception();v=c=='*'?v*n:v/n;}return v;}double num()throws Exception{int a=i;while(i<z.length()&&(Character.isDigit(z.charAt(i))||z.charAt(i)=='.'))i++;if(a==i)throw new Exception();return Double.parseDouble(z.substring(a,i));}}P p=new P();double v=p.expr();if(p.i!=z.length()||!Double.isFinite(v))throw new Exception();return Math.round(v*100.0)/100.0;
    }

    private void startGeneralAmountCheckout(double amount){
        generalAmountCheckout=true;io.execute(()->{try{JSONArray items=new JSONArray();JSONObject x=new JSONObject();x.put("unit_price",amount);x.put("quantity",1);items.put(x);JSONObject body=new JSONObject();body.put("items",items);JSONObject r=new JSONObject(requestRaw("POST",CREATE,body,false));saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",amount);main.post(this::showPayment);}catch(Exception e){main.post(()->Toast.makeText(this,"לא ניתן להתחיל תשלום: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

'''
marker='    private void openAdmin()'
if marker not in s: raise SystemExit('openAdmin marker missing')
s=s.replace(marker,helpers+marker,1)
p.write_text(s,encoding='utf-8')
print('All-products and general-amount checkout applied')

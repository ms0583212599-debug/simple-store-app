from pathlib import Path
import re

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(text, signature, replacement):
    start=text.find(signature)
    if start<0: raise SystemExit(signature+' marker not found')
    brace=text.find('{',start); depth=0; i=brace; instr=False; esc=False; charlit=False
    while i<len(text):
        ch=text[i]
        if instr:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=='"': instr=False
        elif charlit:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=="'": charlit=False
        else:
            if ch=='"': instr=True
            elif ch=="'": charlit=True
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return text[:start]+replacement+text[i+1:]
        i+=1
    raise SystemExit(signature+' closing brace not found')

# 1) Mini cart: products vertically, one clear row per product.
mini=r'''    private void refreshMiniCart(){
        if(miniCartPanel==null)return;miniCartPanel.removeAllViews();
        if(cart.isEmpty()){miniCartPanel.setVisibility(View.GONE);return;}miniCartPanel.setVisibility(View.VISIBLE);
        LinearLayout head=new LinearLayout(this);head.setGravity(Gravity.CENTER_VERTICAL);TextView title=text("הסל שלי",17,true);head.addView(title,new LinearLayout.LayoutParams(0,dp(34),1));
        double total=0;int count=0;for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q>0){total+=q*p.price;count+=q;}}
        TextView sum=text(String.format(Locale.US,"%d פריטים   |   %.2f ₪",count,total),16,true);sum.setGravity(Gravity.CENTER);head.addView(sum,new LinearLayout.LayoutParams(dp(220),dp(34)));Button full=button("לסל / לתשלום",Color.rgb(43,119,139),Color.WHITE);full.setOnClickListener(v->showCart());head.addView(full,new LinearLayout.LayoutParams(dp(160),dp(38)));miniCartPanel.addView(head);
        LinearLayout rows=new LinearLayout(this);rows.setOrientation(LinearLayout.VERTICAL);rows.setPadding(0,dp(3),0,0);
        for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.HORIZONTAL);item.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);item.setGravity(Gravity.CENTER_VERTICAL);item.setPadding(dp(4),dp(2),dp(4),dp(2));TextView n=text(p.name,14,true);n.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);item.addView(n,new LinearLayout.LayoutParams(0,dp(36),1));TextView qty=text("× "+q,14,true);qty.setGravity(Gravity.CENTER);item.addView(qty,new LinearLayout.LayoutParams(dp(58),dp(36)));Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);updateCartButton();refreshMiniCart();});item.addView(minus,new LinearLayout.LayoutParams(dp(42),dp(34)));Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock){cart.put(p.id,x+1);updateCartButton();refreshMiniCart();}});item.addView(plus,new LinearLayout.LayoutParams(dp(42),dp(34)));rows.addView(item,new LinearLayout.LayoutParams(-1,dp(40)));}
        miniCartPanel.addView(rows,new LinearLayout.LayoutParams(-1,-2));
    }'''
s=replace_method(s,'    private void refreshMiniCart()',mini)

# 2) Payment keypad: same visual language as the app keyboard, digits only.
helpers=r'''    private void sendPaymentKey(String key){
        if(paymentWebView==null)return;
        paymentWebView.requestFocus();
        int code;
        if("⌫".equals(key))code=android.view.KeyEvent.KEYCODE_DEL;
        else if(key.length()==1&&Character.isDigit(key.charAt(0)))code=android.view.KeyEvent.KEYCODE_0+Character.digit(key.charAt(0),10);
        else return;
        long now=android.os.SystemClock.uptimeMillis();
        paymentWebView.dispatchKeyEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_DOWN,code,0));
        paymentWebView.dispatchKeyEvent(new android.view.KeyEvent(now,now,android.view.KeyEvent.ACTION_UP,code,0));
    }
    private LinearLayout buildPaymentNumericKeyboard(){
        LinearLayout shell=new LinearLayout(this);shell.setOrientation(LinearLayout.VERTICAL);shell.setBackgroundColor(Color.rgb(73,82,91));shell.setPadding(dp(8),dp(5),dp(8),dp(7));int keyBg=Color.rgb(239,242,246);
        String[][] rows={{"1","2","3"},{"4","5","6"},{"7","8","9"},{"⌫","0","סיום"}};
        for(String[] keys:rows){LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER);row.setPadding(dp(3),dp(3),dp(3),0);for(String k:keys){Button b=keyboardKey(k,keyBg,Color.rgb(35,43,52));b.setFocusable(false);b.setFocusableInTouchMode(false);if("סיום".equals(k))b.setOnClickListener(v->{if(paymentWebView!=null)paymentWebView.requestFocus();android.view.inputmethod.InputMethodManager imm=(android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(imm!=null&&paymentWebView!=null)imm.hideSoftInputFromWindow(paymentWebView.getWindowToken(),0);});else b.setOnClickListener(v->sendPaymentKey(k));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(48),1);lp.setMargins(dp(3),0,dp(3),0);row.addView(b,lp);}shell.addView(row,new LinearLayout.LayoutParams(-1,dp(52)));}
        return shell;
    }
    private void showPaymentSuccessScreen(){
        LinearLayout root=baseRoot();root.setGravity(Gravity.CENTER);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);root.setPadding(dp(24),dp(24),dp(24),dp(24));
        TextView check=text("✓",64,true);check.setGravity(Gravity.CENTER);check.setTextColor(Color.rgb(61,154,79));root.addView(check,new LinearLayout.LayoutParams(-1,dp(92)));
        TextView ok=text("התשלום בוצע בהצלחה",32,true);ok.setGravity(Gravity.CENTER);ok.setTextColor(Color.rgb(42,55,64));root.addView(ok,new LinearLayout.LayoutParams(-1,dp(58)));
        TextView thanks=text("תודה רבה",26,true);thanks.setGravity(Gravity.CENTER);thanks.setTextColor(Color.rgb(80,91,100));root.addView(thanks,new LinearLayout.LayoutParams(-1,dp(50)));
        setContentView(root);main.postDelayed(this::showHome,2000);
    }
    private void finishSuccessfulPayment(){
        polling=false;cart.clear();loadData(this::showPaymentSuccessScreen);
    }

'''
marker='    private void chargeCard()'
if marker not in s: raise SystemExit('chargeCard marker not found')
if 'private LinearLayout buildPaymentNumericKeyboard()' not in s:s=s.replace(marker,helpers+marker,1)

# Add fixed numeric keypad beneath the payment iframe, and suppress the system IME after iframe taps.
pay_start=s.find('    private void showPayment(){')
pay_end=s.find('    private void chargeCard()',pay_start)
if pay_start<0 or pay_end<0: raise SystemExit('showPayment markers not found')
pay=s[pay_start:pay_end]
needle='frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,-1));'
if needle not in pay: raise SystemExit('payment frame add marker not found')
insert=needle+'\n        paymentWebView.setOnTouchListener((v,e)->{if(e.getAction()==android.view.MotionEvent.ACTION_UP)main.postDelayed(()->{android.view.inputmethod.InputMethodManager imm=(android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);if(imm!=null&&paymentWebView!=null)imm.hideSoftInputFromWindow(paymentWebView.getWindowToken(),0);},120);return false;});\n        LinearLayout paymentKeyboard=buildPaymentNumericKeyboard();root.addView(paymentKeyboard,new LinearLayout.LayoutParams(-1,dp(215)));'
pay=pay.replace(needle,insert,1)
s=s[:pay_start]+pay+s[pay_end:]

# 3) Successful payment: full-screen confirmation for 2 seconds, then home.
patterns=[
    r'cart\.clear\(\);loadData\(\(\)->\{Toast\.makeText\(MainActivity\.this,"התשלום בוצע",Toast\.LENGTH_LONG\)\.show\(\);showHome\(\);\}\);return;',
    r'cart\.clear\(\);loadData\(\(\)->\{Toast\.makeText\(this,"התשלום בוצע",Toast\.LENGTH_LONG\)\.show\(\);showHome\(\);\}\);return;'
]
changed=0
for pat in patterns:
    s,n=re.subn(pat,'finishSuccessfulPayment();return;',s)
    changed+=n
if changed<2: raise SystemExit(f'expected two payment success branches, replaced {changed}')

p.write_text(s,encoding='utf-8')
print('Vertical mini cart, numeric payment keypad, and 2-second payment success screen applied')

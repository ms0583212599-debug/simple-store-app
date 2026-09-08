from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java');s=p.read_text(encoding='utf-8')
# Add a compact cart preview after the existing customer content. It reuses the same cart map and checkout flow.
marker='    private void showCart(){'
code=r'''    private void showMiniCart(){
        if(cart.isEmpty())return;
        final AlertDialog[] dlg=new AlertDialog[1];LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(14),dp(10),dp(14),dp(12));
        TextView head=text("הסל שלי",20,true);head.setGravity(Gravity.CENTER);box.addView(head);
        final LinearLayout rows=new LinearLayout(this);rows.setOrientation(LinearLayout.VERTICAL);box.addView(rows);
        Runnable[] render=new Runnable[1];render[0]=()->{rows.removeAllViews();double total=0;for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;LinearLayout row=new LinearLayout(this);row.setGravity(Gravity.CENTER_VERTICAL);TextView n=text(p.name,16,true);row.addView(n,new LinearLayout.LayoutParams(0,dp(46),1));Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);updateCartButton();if(cart.isEmpty()){dlg[0].dismiss();return;}render[0].run();});row.addView(minus,new LinearLayout.LayoutParams(dp(46),dp(40)));TextView qty=text(String.valueOf(q),16,true);qty.setGravity(Gravity.CENTER);row.addView(qty,new LinearLayout.LayoutParams(dp(40),dp(40)));Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock){cart.put(p.id,x+1);updateCartButton();render[0].run();}});row.addView(plus,new LinearLayout.LayoutParams(dp(46),dp(40)));rows.addView(row);total+=q*p.price;}TextView sum=text(String.format(Locale.US,"סה״כ: %.2f ₪",total),19,true);sum.setGravity(Gravity.CENTER);sum.setPadding(0,dp(8),0,dp(5));rows.addView(sum);Button full=button("לסל / לתשלום",green,Color.WHITE);full.setOnClickListener(v->{dlg[0].dismiss();showCart();});rows.addView(full,new LinearLayout.LayoutParams(-1,dp(48)));};
        render[0].run();dlg[0]=new AlertDialog.Builder(this).setView(box).create();dlg[0].show();android.view.Window w=dlg[0].getWindow();if(w!=null){w.setGravity(Gravity.BOTTOM|Gravity.END);w.setLayout(dp(430),android.view.WindowManager.LayoutParams.WRAP_CONTENT);}
    }

'''
if marker not in s:raise SystemExit('showCart marker not found')
s=s.replace(marker,code+marker,1)
# First item added opens preview; subsequent adds update cart count normally.
old='cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();'
new='boolean first=cart.isEmpty();cart.put(p.id,now+1);updateCartButton();if(first)showMiniCart();else Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();'
s=s.replace(old,new)
# Disabled unavailable buttons use a clearly different gray.
s=s.replace('Button add=button(p.stock>0?"הוסף לסל":"לא זמין",Color.rgb(43,119,139),Color.WHITE);','Button add=button(p.stock>0?"הוסף לסל":"לא זמין",p.stock>0?Color.rgb(43,119,139):Color.rgb(145,151,157),Color.WHITE);')
p.write_text(s,encoding='utf-8');print('Mini cart added; unavailable buttons gray')

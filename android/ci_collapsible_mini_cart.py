from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(text, signature, replacement):
    start=text.find(signature)
    if start<0: raise SystemExit(signature+' marker not found')
    brace=text.find('{',start); depth=0; i=brace; instr=False; esc=False
    while i<len(text):
        ch=text[i]
        if instr:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=='"': instr=False
        else:
            if ch=='"': instr=True
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return text[:start]+replacement+text[i+1:]
        i+=1
    raise SystemExit(signature+' closing brace not found')

# Default is expanded whenever a fresh customer shell is created.
field='    private boolean miniCartExpanded = true;\n    private String lastMiniCartProductId = null;\n'
marker='    private LinearLayout miniCartPanel;'
if field.strip() not in s:
    if marker not in s: raise SystemExit('miniCartPanel field marker not found')
    s=s.replace(marker,marker+'\n'+field,1)

# Track the latest product added from customer product cards.
needle='cart.put(p.id,now+1);updateCartButton();refreshMiniCart();'
repl='cart.put(p.id,now+1);lastMiniCartProductId=p.id;updateCartButton();refreshMiniCart();'
s=s.replace(needle,repl)

mini=r'''    private void refreshMiniCart(){
        if(miniCartPanel==null)return;miniCartPanel.removeAllViews();
        if(cart.isEmpty()){miniCartPanel.setVisibility(View.GONE);lastMiniCartProductId=null;return;}miniCartPanel.setVisibility(View.VISIBLE);
        LinearLayout head=new LinearLayout(this);head.setGravity(Gravity.CENTER_VERTICAL);head.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        TextView title=text("הסל שלי",17,true);head.addView(title,new LinearLayout.LayoutParams(0,dp(38),1));
        double total=0;int count=0;for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q>0){total+=q*p.price;count+=q;}}
        TextView sum=text(String.format(Locale.US,"%d פריטים | %.2f ₪",count,total),15,true);sum.setGravity(Gravity.CENTER);head.addView(sum,new LinearLayout.LayoutParams(dp(200),dp(38)));
        Button toggle=button(miniCartExpanded?"צמצם ▲":"הגדל ▼",Color.rgb(237,241,247),Color.DKGRAY);toggle.setOnClickListener(v->{miniCartExpanded=!miniCartExpanded;refreshMiniCart();});head.addView(toggle,new LinearLayout.LayoutParams(dp(100),dp(36)));
        Button full=button("לסל / לתשלום",Color.rgb(43,119,139),Color.WHITE);full.setOnClickListener(v->showCart());LinearLayout.LayoutParams flp=new LinearLayout.LayoutParams(dp(160),dp(38));flp.setMargins(dp(6),0,0,0);head.addView(full,flp);miniCartPanel.addView(head);
        LinearLayout rows=new LinearLayout(this);rows.setOrientation(LinearLayout.VERTICAL);rows.setPadding(0,dp(3),0,0);
        Product last=null;if(lastMiniCartProductId!=null)for(Product p:products)if(p.id.equals(lastMiniCartProductId)&&cart.getOrDefault(p.id,0)>0){last=p;break;}if(last==null)for(Product p:products)if(cart.getOrDefault(p.id,0)>0)last=p;
        for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;if(!miniCartExpanded&&p!=last)continue;LinearLayout item=new LinearLayout(this);item.setOrientation(LinearLayout.HORIZONTAL);item.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);item.setGravity(Gravity.CENTER_VERTICAL);item.setPadding(dp(4),dp(2),dp(4),dp(2));TextView n=text(p.name,14,true);n.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);item.addView(n,new LinearLayout.LayoutParams(0,dp(36),1));TextView qty=text("× "+q,14,true);qty.setGravity(Gravity.CENTER);item.addView(qty,new LinearLayout.LayoutParams(dp(58),dp(36)));Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);updateCartButton();refreshMiniCart();});item.addView(minus,new LinearLayout.LayoutParams(dp(42),dp(34)));Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock){cart.put(p.id,x+1);lastMiniCartProductId=p.id;updateCartButton();refreshMiniCart();}});item.addView(plus,new LinearLayout.LayoutParams(dp(42),dp(34)));rows.addView(item,new LinearLayout.LayoutParams(-1,dp(40)));}
        miniCartPanel.addView(rows,new LinearLayout.LayoutParams(-1,-2));
    }'''
s=replace_method(s,'    private void refreshMiniCart()',mini)

p.write_text(s,encoding='utf-8')
print('Collapsible mini cart applied; default expanded, collapsed shows latest added product')

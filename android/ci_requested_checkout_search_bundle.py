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

# Product visibility remains available to admin/inventory but can be hidden from customers.
s=s.replace('private Button cartButton;','private Button cartButton;\n    private LinearLayout miniCartPanel;',1)
s=s.replace('products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0)));','products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0),o.optBoolean("show_to_customers",true)));',1)
s=s.replace('static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;Product(String i,String c,String n,double p,int s,String u,int l,int so){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;}}','static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;boolean showToCustomers;Product(String i,String c,String n,double p,int s,String u,int l,int so,boolean sh){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;showToCustomers=sh;}}',1)
# Any helper-created Product instances default visible.
s=s.replace('new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0))','new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0),o.optBoolean("show_to_customers",true))')

# Fixed mini-cart area: unlike AlertDialog it never blocks or dims the product list.
old='scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));\n        setContentView(root);updateCartButton();'
new='scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));\n        miniCartPanel=new LinearLayout(this);miniCartPanel.setOrientation(LinearLayout.VERTICAL);miniCartPanel.setPadding(dp(18),dp(7),dp(18),dp(8));miniCartPanel.setBackgroundColor(Color.WHITE);root.addView(miniCartPanel,new LinearLayout.LayoutParams(-1,-2));\n        setContentView(root);updateCartButton();refreshMiniCart();'
if old not in s: raise SystemExit('buildShell mini cart marker not found')
s=s.replace(old,new,1)

refresh=r'''    private void refreshMiniCart(){
        if(miniCartPanel==null)return;miniCartPanel.removeAllViews();
        if(cart.isEmpty()){miniCartPanel.setVisibility(View.GONE);return;}miniCartPanel.setVisibility(View.VISIBLE);
        LinearLayout head=new LinearLayout(this);head.setGravity(Gravity.CENTER_VERTICAL);TextView title=text("הסל שלי",17,true);head.addView(title,new LinearLayout.LayoutParams(0,dp(34),1));
        double total=0;int count=0;for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q>0){total+=q*p.price;count+=q;}}
        TextView sum=text(String.format(Locale.US,"%d פריטים   |   %.2f ₪",count,total),16,true);sum.setGravity(Gravity.CENTER);head.addView(sum,new LinearLayout.LayoutParams(dp(220),dp(34)));Button full=button("לסל / לתשלום",Color.rgb(43,119,139),Color.WHITE);full.setOnClickListener(v->showCart());head.addView(full,new LinearLayout.LayoutParams(dp(160),dp(38)));miniCartPanel.addView(head);
        LinearLayout rows=new LinearLayout(this);rows.setOrientation(LinearLayout.HORIZONTAL);rows.setGravity(Gravity.CENTER_VERTICAL);for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;LinearLayout item=new LinearLayout(this);item.setGravity(Gravity.CENTER_VERTICAL);item.setPadding(dp(5),0,dp(5),0);TextView n=text(p.name+" × "+q,14,true);item.addView(n);Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);updateCartButton();refreshMiniCart();});item.addView(minus,new LinearLayout.LayoutParams(dp(38),dp(34)));Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock){cart.put(p.id,x+1);updateCartButton();refreshMiniCart();}});item.addView(plus,new LinearLayout.LayoutParams(dp(38),dp(34)));rows.addView(item);}android.widget.HorizontalScrollView hs=new android.widget.HorizontalScrollView(this);hs.addView(rows);miniCartPanel.addView(hs,new LinearLayout.LayoutParams(-1,dp(42)));
    }

'''
marker='    private void updateCartButton()'
if marker not in s: raise SystemExit('updateCartButton marker not found')
s=s.replace(marker,refresh+marker,1)

home=r'''    private void showHome(){
        polling=false;buildShell("מערכת מכירה",null,true);
        LinearLayout searchBox=new LinearLayout(this);searchBox.setOrientation(LinearLayout.VERTICAL);searchBox.setGravity(Gravity.CENTER);searchBox.setPadding(dp(40),dp(4),dp(40),dp(8));
        LinearLayout field=new LinearLayout(this);field.setGravity(Gravity.CENTER_VERTICAL);field.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);field.setBackground(roundRect(Color.WHITE,Color.rgb(191,198,204),1,5));
        Button clear=button("×",Color.WHITE,Color.rgb(85,94,102));clear.setTextSize(26);field.addView(clear,new LinearLayout.LayoutParams(dp(62),dp(58)));
        EditText search=input("חיפוש קטגוריה/מוצר");search.setBackgroundColor(Color.TRANSPARENT);search.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);field.addView(search,new LinearLayout.LayoutParams(0,dp(58),1));searchBox.addView(field,new LinearLayout.LayoutParams(-1,dp(58)));
        Button searchBtn=button("חיפוש",Color.rgb(118,126,134),Color.WHITE);LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(-1,dp(52));bp.setMargins(0,dp(8),0,0);searchBox.addView(searchBtn,bp);content.addView(searchBox);
        TextView h=text("בחר קטגוריה או מוצר",24,true);h.setTextColor(Color.rgb(62,72,82));h.setGravity(Gravity.CENTER);h.setPadding(0,dp(7),0,dp(6));content.addView(h);
        GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        Runnable render=()->{String q=search.getText().toString().trim().toLowerCase(Locale.ROOT);grid.removeAllViews();for(Category c:categories){boolean catMatch=q.isEmpty()||c.name.toLowerCase(Locale.ROOT).contains(q);if(catMatch)grid.addView(categoryCard(c),gridParams());}if(!q.isEmpty())for(Product p:products){if(!p.showToCustomers)continue;if(p.name.toLowerCase(Locale.ROOT).contains(q))grid.addView(productCard(p),gridParams());}};
        render.run();search.addTextChangedListener(new SimpleWatcher(render));searchBtn.setOnClickListener(v->render.run());clear.setOnClickListener(v->{search.setText("");search.requestFocus();});search.setOnEditorActionListener((v,a,e)->{render.run();return true;});refreshMiniCart();
    }'''
s=replace_method(s,'    private void showHome()',home)

# Customer category and search only show customer-visible products.
s=s.replace('for(Product p:products)if(p.categoryId.equals(c.id))grid.addView(productCard(p),gridParams());','for(Product p:products)if(p.showToCustomers&&p.categoryId.equals(c.id))grid.addView(productCard(p),gridParams());')
s=s.replace('if(!p.categoryId.equals(c.id)||p.imageUrl==null||p.imageUrl.isEmpty())continue;','if(!p.showToCustomers||!p.categoryId.equals(c.id)||p.imageUrl==null||p.imageUrl.isEmpty())continue;')

# Final product card: customer mode edits with the same full productDialog; otherwise cart stays live.
product=r'''    private View productCard(Product p){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(7),dp(4),dp(7),dp(4));
        LinearLayout actionCol=new LinearLayout(this);actionCol.setOrientation(LinearLayout.VERTICAL);actionCol.setGravity(Gravity.CENTER_VERTICAL|Gravity.LEFT);actionCol.setPadding(0,0,dp(7),0);
        Button add=button(customerAdminMode?"✎ עריכת מוצר":(p.stock>0?"הוסף לסל":"לא זמין"),customerAdminMode?blue:(p.stock>0?Color.rgb(43,119,139):Color.rgb(145,151,157)),Color.WHITE);add.setTextSize(13);add.setEnabled(customerAdminMode||p.stock>0);add.setOnClickListener(v->{if(customerAdminMode){productDialog(p);return;}int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();refreshMiniCart();}});actionCol.addView(add,new LinearLayout.LayoutParams(dp(150),dp(32)));card.addView(actionCol,new LinearLayout.LayoutParams(dp(160),dp(80)));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);info.setPadding(dp(7),0,dp(9),0);TextView n=text(p.name,18,true);n.setTextColor(Color.rgb(148,48,61));n.setGravity(Gravity.RIGHT);info.addView(n);TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),15,true);price.setTextColor(Color.rgb(57,71,82));price.setGravity(Gravity.RIGHT);info.addView(price);TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",11,false);stock.setTextColor(p.stock>0?Color.rgb(105,113,120):Color.rgb(185,46,46));stock.setGravity(Gravity.RIGHT);info.addView(stock);card.addView(info,new LinearLayout.LayoutParams(0,dp(80),1));ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(dp(98),dp(80)));if(customerAdminMode)card.setOnClickListener(v->productDialog(p));return card;
    }'''
s=replace_method(s,'    private View productCard(Product p)',product)

# Add customer visibility control to the existing full editor.
needle='Spinner cat=new Spinner(this);List<String> names=new ArrayList<>();for(Category c:categories)names.add(c.name);cat.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));'
repl=needle+'\n        Spinner customerVisible=new Spinner(this);String[] visibleOptions={"הצג ללקוחות — כן","הצג ללקוחות — לא"};customerVisible.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,visibleOptions));'
s=s.replace(needle,repl,1)
s=s.replace('box.addView(name);box.addView(price);box.addView(stock);box.addView(low);box.addView(cat);','box.addView(name);box.addView(price);box.addView(stock);box.addView(low);box.addView(cat);box.addView(customerVisible);',1)
s=s.replace('if(p!=null){name.setText(p.name);price.setText(String.valueOf(p.price));stock.setText(String.valueOf(p.stock));low.setText(String.valueOf(p.lowStock));','if(p!=null){name.setText(p.name);price.setText(String.valueOf(p.price));stock.setText(String.valueOf(p.stock));low.setText(String.valueOf(p.lowStock));customerVisible.setSelection(p.showToCustomers?0:1);',1)
s=s.replace('body.put("category_id",categories.get(cat.getSelectedItemPosition()).id);body.put("is_active",true);','body.put("category_id",categories.get(cat.getSelectedItemPosition()).id);body.put("is_active",true);body.put("show_to_customers",customerVisible.getSelectedItemPosition()==0);',1)

# Payment screen: only the single-payment tab, locked amount, locked installments=1, then card iframe and approval button.
payment=r'''    private void showPayment(){
        LinearLayout root=baseRoot();root.setBackgroundColor(Color.rgb(247,248,249));root.setPadding(dp(12),dp(6),dp(12),dp(8));LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);Button back=button("‹  חזור",Color.WHITE,Color.rgb(65,92,108));back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(112),dp(42)));TextView title=text("תשלום",23,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(42),1));top.addView(new View(this),new LinearLayout.LayoutParams(dp(112),dp(42)));root.addView(top);
        TextView tab=text("חיוב בודד / תשלומים",18,true);tab.setGravity(Gravity.CENTER);tab.setTextColor(Color.WHITE);tab.setBackground(roundRect(Color.rgb(43,119,139),Color.rgb(43,119,139),0,5));LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(-1,dp(48));tp.setMargins(dp(80),dp(6),dp(80),dp(8));root.addView(tab,tp);
        paymentStatus=text(String.format(Locale.US,"סכום לחיוב     %.2f ₪",saleTotal),19,true);paymentStatus.setGravity(Gravity.CENTER);paymentStatus.setBackground(roundRect(Color.WHITE,Color.rgb(191,198,204),1,5));root.addView(paymentStatus,new LinearLayout.LayoutParams(-1,dp(52)));
        TextView installments=text("מספר תשלומים     1",18,true);installments.setGravity(Gravity.CENTER);installments.setBackground(roundRect(Color.WHITE,Color.rgb(191,198,204),1,5));LinearLayout.LayoutParams ipay=new LinearLayout.LayoutParams(-1,dp(50));ipay.setMargins(0,dp(7),0,dp(7));root.addView(installments,ipay);
        LinearLayout frameWrap=new LinearLayout(this);frameWrap.setPadding(dp(5),dp(5),dp(5),dp(5));frameWrap.setBackground(roundRect(Color.WHITE,Color.rgb(211,216,220),1,5));root.addView(frameWrap,new LinearLayout.LayoutParams(-1,0,1));
        paymentWebView=new WebView(this);WebSettings ws=paymentWebView.getSettings();ws.setJavaScriptEnabled(true);ws.setDomStorageEnabled(true);ws.setDatabaseEnabled(true);android.webkit.CookieManager cm=android.webkit.CookieManager.getInstance();cm.setAcceptCookie(true);cm.setAcceptThirdPartyCookies(paymentWebView,true);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");frameWrap.addView(paymentWebView,new LinearLayout.LayoutParams(-1,-1));
        paymentFrameReady=false;chargeButton=button("טוען תשלום...",Color.rgb(77,157,88),Color.WHITE);chargeButton.setTextSize(20);chargeButton.setEnabled(false);chargeButton.setOnClickListener(v->chargeCard());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(56));cp.setMargins(dp(5),dp(7),dp(5),0);root.addView(chargeButton,cp);setContentView(root);
        String html="<!doctype html><html dir='rtl'><body style='margin:0'><iframe id='frame' src='https://www.matara.pro/nedarimplus/iframe/?Picture=Hide' style='width:100%;height:100vh;border:0'></iframe><script>const frame=document.getElementById('frame');function p(d){frame.contentWindow.postMessage(d,'*')}frame.addEventListener('load',()=>{Android.onFrameReady();p({Name:'GetHeight'});setTimeout(()=>{try{frame.contentWindow.postMessage({Name:'HideKeyboard'},'*')}catch(e){}},250);});window.addEventListener('message',e=>{let d=e.data;if(d&&d.Name==='TransactionResponse')Android.onTransaction(JSON.stringify(d.Value||{}));});</script></body></html>";paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }'''
s=replace_method(s,'    private void showPayment()',payment)
s=s.replace('chargeButton.setText("בצע תשלום")','chargeButton.setText("אישור תשלום")')
s=s.replace('paymentStatus.setText(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal))','paymentStatus.setText(String.format(Locale.US,"סכום לחיוב     %.2f ₪",saleTotal))')

p.write_text(s,encoding='utf-8')
print('Requested bundle applied: persistent cart, combined live search, customer visibility, customer editing and Nedarim-style payment')

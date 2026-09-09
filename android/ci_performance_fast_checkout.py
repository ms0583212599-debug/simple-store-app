from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# 1) Show cached catalog immediately on startup, then refresh from cloud quietly.
old='''        showLoading();
        loadData(this::showHome);'''
new='''        showLoading();
        try{
            JSONArray cachedCategories=offline.categories(),cachedProducts=offline.products();
            if(cachedCategories.length()>0||cachedProducts.length()>0){
                parseCatalog(cachedCategories,cachedProducts);showHome();
                io.execute(()->{try{
                    JSONArray cs=requestArray("GET","/rest/v1/categories?select=*&order=sort_order.asc",null,false);
                    JSONArray ps=requestArray("GET","/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc",null,false);
                    offline.saveCatalog(cs,ps);parseCatalog(cs,ps);
                }catch(Exception ignored){}});
            }else loadData(this::showHome);
        }catch(Exception e){loadData(this::showHome);}'''
if old in s:s=s.replace(old,new,1)

# 2) Give HTTP calls sensible fast failure instead of freezing for 15 seconds.
s=s.replace('c.setConnectTimeout(15000);c.setReadTimeout(15000);','c.setConnectTimeout(6000);c.setReadTimeout(10000);',1)

# 3) Make checkout feel instant: display a payment/loading shell immediately while create-checkout runs.
old_start='''    private void startCheckout(){
        if(cart.isEmpty())return;
        io.execute(()->{try{'''
new_start='''    private void startCheckout(){
        if(cart.isEmpty())return;
        showCheckoutPreparing();
        io.execute(()->{try{'''
if old_start in s:s=s.replace(old_start,new_start,1)

marker='    private void showPayment(){'
helper='''    private void showCheckoutPreparing(){
        LinearLayout root=baseRoot();
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(22),dp(12),dp(22),dp(8));
        Button back=button("‹  חזור",Color.WHITE,blue);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(130),dp(52)));
        TextView title=text("תשלום",24,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));root.addView(top);
        TextView wait=text("מכין את התשלום...",24,true);wait.setGravity(Gravity.CENTER);wait.setPadding(dp(20),dp(100),dp(20),dp(20));root.addView(wait,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
    }

'''
if 'private void showCheckoutPreparing()' not in s:
    if marker not in s:raise SystemExit('showPayment marker not found')
    s=s.replace(marker,helper+marker,1)

p.write_text(s,encoding='utf-8')
print('Performance pass applied: instant cached startup, faster network failure, immediate checkout transition')

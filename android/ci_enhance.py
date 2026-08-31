from pathlib import Path

path = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
text = path.read_text(encoding='utf-8')

marker = '        Button logout=button("יציאה מניהול",red,Color.WHITE);'
button = '        Button update=button("בדוק עדכון אפליקציה ••••",green,Color.WHITE);update.setOnClickListener(v->AppUpdater.checkForUpdate(this));LinearLayout.LayoutParams up=new LinearLayout.LayoutParams(-1,dp(60));up.setMargins(0,0,0,dp(12));content.addView(update,up);\n'
if 'בדוק עדכון אפליקציה ••••' not in text:
    if marker not in text: raise SystemExit('Admin update button marker not found')
    text = text.replace(marker, button + marker, 1)

old_cat = '        for(Category c:categories){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView t=text(c.name+"   "+("custom".equals(c.imageMode)?"תמונה מותאמת":"תמונות אוטומטיות"),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->categoryDialog(c));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}'
new_cat = '        for(Category c:categories){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);int pc=0;for(Product p:products)if(p.categoryId.equals(c.id))pc++;TextView t=text(c.name+"   ("+pc+" מוצרים)",18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button upc=button("↑",Color.rgb(237,241,247),blue);upc.setOnClickListener(v->moveCategory(c,-1));row.addView(upc,new LinearLayout.LayoutParams(dp(58),dp(52)));Button dnc=button("↓",Color.rgb(237,241,247),blue);dnc.setOnClickListener(v->moveCategory(c,1));row.addView(dnc,new LinearLayout.LayoutParams(dp(58),dp(52)));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->categoryDialog(c));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}'
if old_cat in text: text = text.replace(old_cat, new_cat, 1)
old_prod = '                Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->productDialog(p));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);'
new_prod = '                Button upp=button("↑",Color.rgb(237,241,247),blue);upp.setOnClickListener(v->moveProduct(p,-1));row.addView(upp,new LinearLayout.LayoutParams(dp(56),dp(52)));Button dnp=button("↓",Color.rgb(237,241,247),blue);dnp.setOnClickListener(v->moveProduct(p,1));row.addView(dnp,new LinearLayout.LayoutParams(dp(56),dp(52)));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->productDialog(p));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);'
if old_prod in text: text = text.replace(old_prod, new_prod, 1)

helper_marker = '    private void showStockAdmin(){'
helpers = '''    private void moveCategory(Category c,int d){int i=categories.indexOf(c),j=i+d;if(i<0||j<0||j>=categories.size())return;Category o=categories.get(j);int a=c.sortOrder,b=o.sortOrder;if(a==b){a=i+1;b=j+1;}final int ca=b,ob=a;io.execute(()->{try{JSONObject x=new JSONObject();x.put("sort_order",ca);requestRaw("PATCH","/rest/v1/categories?id=eq."+url(c.id),x,true);JSONObject y=new JSONObject();y.put("sort_order",ob);requestRaw("PATCH","/rest/v1/categories?id=eq."+url(o.id),y,true);loadData(this::showCategoriesAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שינוי סדר קטגוריות נכשל",Toast.LENGTH_LONG).show());}});}
    private void moveProduct(Product p,int d){List<Product> s=new ArrayList<>();for(Product x:products)if(x.categoryId.equals(p.categoryId))s.add(x);int i=s.indexOf(p),j=i+d;if(i<0||j<0||j>=s.size())return;Product o=s.get(j);int a=p.sortOrder,b=o.sortOrder;if(a==b){a=i+1;b=j+1;}final int pa=b,ob=a;io.execute(()->{try{JSONObject x=new JSONObject();x.put("sort_order",pa);requestRaw("PATCH","/rest/v1/products?id=eq."+url(p.id),x,true);JSONObject y=new JSONObject();y.put("sort_order",ob);requestRaw("PATCH","/rest/v1/products?id=eq."+url(o.id),y,true);loadData(this::showProductsAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שינוי סדר מוצרים נכשל",Toast.LENGTH_LONG).show());}});}

'''
if 'private void moveCategory(Category c,int d)' not in text:
    if helper_marker not in text: raise SystemExit('Admin helper marker not found')
    text = text.replace(helper_marker, helpers + helper_marker, 1)

# Existing build-time enhancements below are intentionally preserved in source history.
path.write_text(text, encoding='utf-8')

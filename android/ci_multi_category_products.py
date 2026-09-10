from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Product model: keep one primary category and optional additional categories.
old='static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;'
new='static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;java.util.Set<String> extraCategoryIds=new java.util.HashSet<>();'
if old in s:s=s.replace(old,new,1)
elif 'extraCategoryIds' not in s: raise SystemExit('Product model marker missing')

def replace_method(src, sig, repl):
    a=src.find(sig)
    if a<0: raise SystemExit(sig+' missing')
    b=src.find('{',a);d=0;i=b;ins=False;esc=False;chlit=False
    while i<len(src):
        ch=src[i]
        if ins:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=='"': ins=False
        elif chlit:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=="'": chlit=False
        else:
            if ch=='"': ins=True
            elif ch=="'": chlit=True
            elif ch=='{': d+=1
            elif ch=='}':
                d-=1
                if d==0:return src[:a]+repl+src[i+1:]
        i+=1
    raise SystemExit('method close missing')

parse=r'''    private void parseCatalog(JSONArray cs,JSONArray ps)throws Exception{
        categories.clear();products.clear();
        for(int i=0;i<cs.length();i++){JSONObject o=cs.getJSONObject(i);categories.add(new Category(o.optString("id"),o.optString("name"),o.optString("image_url"),o.optString("image_mode"),o.optInt("sort_order",0)));}
        for(int i=0;i<ps.length();i++){
            JSONObject o=ps.getJSONObject(i);if(!o.optBoolean("is_active",true))continue;
            Product pr=new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0),o.optBoolean("show_to_customers",true));
            JSONArray ex=o.optJSONArray("additional_category_ids");if(ex!=null)for(int j=0;j<ex.length();j++){String id=ex.optString(j);if(id!=null&&!id.isEmpty()&&!id.equals(pr.categoryId))pr.extraCategoryIds.add(id);}products.add(pr);
        }
    }
'''
s=replace_method(s,'    private void parseCatalog(JSONArray cs,JSONArray ps)',parse)

marker='    private Product findProduct(String id)'
helper='    private boolean productInCategory(Product p,String categoryId){return p!=null&&categoryId!=null&&(categoryId.equals(p.categoryId)||p.extraCategoryIds.contains(categoryId));}\n'
if 'private boolean productInCategory(' not in s:
    if marker not in s: raise SystemExit('findProduct marker missing')
    s=s.replace(marker,helper+marker,1)
s=s.replace('!p.categoryId.equals(c.id)','!productInCategory(p,c.id)')
s=s.replace('p.categoryId.equals(c.id)','productInCategory(p,c.id)')

needle='box.addView(name);box.addView(price);box.addView(stock);box.addView(low);box.addView(cat);'
if needle not in s: raise SystemExit('product dialog fields marker missing')
extra=r'''box.addView(name);box.addView(price);box.addView(stock);box.addView(low);box.addView(cat);
        final boolean[] extraSelected=new boolean[categories.size()];
        if(p!=null)for(int i=0;i<categories.size();i++)extraSelected[i]=p.extraCategoryIds.contains(categories.get(i).id);
        Button extraCats=button("קטגוריות נוספות",Color.WHITE,blue);box.addView(extraCats,new LinearLayout.LayoutParams(-1,dp(54)));
        Runnable refreshExtraLabel=()->{int n=0;for(boolean z:extraSelected)if(z)n++;extraCats.setText(n==0?"קטגוריות נוספות":"קטגוריות נוספות ("+n+")");};refreshExtraLabel.run();
        extraCats.setOnClickListener(v->{String[] labels=new String[categories.size()];for(int i=0;i<categories.size();i++)labels[i]=categories.get(i).name;new AlertDialog.Builder(this).setTitle("בחר קטגוריות נוספות").setMultiChoiceItems(labels,extraSelected,(d,which,checked)->extraSelected[which]=checked).setNegativeButton("ביטול",null).setPositiveButton("אישור",(d,w)->refreshExtraLabel.run()).show();});'''
s=s.replace(needle,extra,1)

needle2='body.put("category_id",categories.get(cat.getSelectedItemPosition()).id);'
if needle2 not in s: raise SystemExit('category save marker missing')
save=r'''body.put("category_id",categories.get(cat.getSelectedItemPosition()).id);JSONArray extraIds=new JSONArray();String primaryId=categories.get(cat.getSelectedItemPosition()).id;for(int ci=0;ci<categories.size();ci++)if(extraSelected[ci]&&!categories.get(ci).id.equals(primaryId))extraIds.put(categories.get(ci).id);body.put("additional_category_ids",extraIds);'''
s=s.replace(needle2,save,1)

p.write_text(s,encoding='utf-8')
print('Multi-category product support applied')

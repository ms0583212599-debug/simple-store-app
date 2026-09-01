from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
old='Spinner prod=productSpinner();EditText productName=input("שם מוצר");EditText qty=input("כמות");'
new='Spinner prod=productSpinner();EditText productName=input("שם מוצר");android.widget.CheckBox visible=new android.widget.CheckBox(this);visible.setText("מפורסם ללקוחות");visible.setChecked(true);EditText qty=input("כמות");'
if old not in s: raise SystemExit('purchase visibility row marker not found')
s=s.replace(old,new,1)
old='box.addView(productName);box.addView(prod);box.addView(qty);box.addView(cost);box.addView(sale);'
new='box.addView(productName);box.addView(prod);box.addView(visible);box.addView(qty);box.addView(cost);box.addView(sale);'
if old not in s: raise SystemExit('purchase visibility view marker not found')
s=s.replace(old,new,1)
old='PurchaseLine line=new PurchaseLine(box,prod,productName,qty,cost,sale);models.add(line);'
new='PurchaseLine line=new PurchaseLine(box,prod,productName,visible,qty,cost,sale);models.add(line);'
if old not in s: raise SystemExit('purchase visibility model marker not found')
s=s.replace(old,new,1)
old='prod.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){if(position>=0&&position<products.size())productName.setText(products.get(position).name);}public void onNothingSelected(android.widget.AdapterView<?> parent){}});'
new='prod.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){if(position>=0&&position<products.size()){productName.setText(products.get(position).name);visible.setChecked(products.get(position).active);}}public void onNothingSelected(android.widget.AdapterView<?> parent){}});'
if old not in s: raise SystemExit('purchase visibility spinner marker not found')
s=s.replace(old,new,1)
s=s.replace('renamePurchaseProductIfNeeded(p,l.name);','updatePurchaseProductFromLine(p,l);')
s=s.replace('renamePurchaseProductIfNeeded(pr,l.name);','updatePurchaseProductFromLine(pr,l);')
marker='    private void renamePurchaseProductIfNeeded(Product p,EditText name)throws Exception{String value=name.getText().toString().trim();if(value.isEmpty())throw new Exception("חסר שם מוצר");if(!value.equals(p.name)){JSONObject b=new JSONObject();b.put("name",value);requestRaw("PATCH","/rest/v1/products?id=eq."+url(p.id),b,true);p.name=value;}}'
replacement=marker+'\n    private void updatePurchaseProductFromLine(Product p,PurchaseLine l)throws Exception{String value=l.name.getText().toString().trim();if(value.isEmpty())throw new Exception("חסר שם מוצר");boolean active=l.visible.isChecked();if(!value.equals(p.name)||active!=p.active){JSONObject b=new JSONObject();b.put("name",value);b.put("is_active",active);requestRaw("PATCH","/rest/v1/products?id=eq."+url(p.id),b,true);p.name=value;p.active=active;}}'
if marker not in s: raise SystemExit('purchase visibility helper marker not found')
s=s.replace(marker,replacement,1)
old='static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;Product(String i,String c,String n,double p,int s,String u,int l,int so){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;}}'
new='static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;boolean active=true;Product(String i,String c,String n,double p,int s,String u,int l,int so){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;}}'
if old not in s: raise SystemExit('product active marker not found')
s=s.replace(old,new,1)
old='static class PurchaseLine{LinearLayout root;Spinner product;EditText name,qty,cost,sale;Runnable onChange;PurchaseLine(LinearLayout r,Spinner p,EditText n,EditText q,EditText c,EditText s){root=r;product=p;name=n;qty=q;cost=c;sale=s;}'
new='static class PurchaseLine{LinearLayout root;Spinner product;EditText name,qty,cost,sale;android.widget.CheckBox visible;Runnable onChange;PurchaseLine(LinearLayout r,Spinner p,EditText n,android.widget.CheckBox v,EditText q,EditText c,EditText s){root=r;product=p;name=n;visible=v;qty=q;cost=c;sale=s;}'
if old not in s: raise SystemExit('purchase visibility class marker not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

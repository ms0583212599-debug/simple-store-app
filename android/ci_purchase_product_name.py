from pathlib import Path

path=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=path.read_text(encoding='utf-8')

old='''        Spinner prod=productSpinner();EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);EditText cost=input("מחיר קנייה ליחידה");cost.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText sale=input("מחיר מכירה");sale.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);\n        box.addView(prod);box.addView(qty);box.addView(cost);box.addView(sale);\n        PurchaseLine line=new PurchaseLine(box,prod,qty,cost,sale);models.add(line);\n        if(seed!=null){for(int i=0;i<products.size();i++)if(products.get(i).id.equals(seed.productId))prod.setSelection(i);qty.setText(String.valueOf(seed.quantity));cost.setText(String.valueOf(seed.unitCost));sale.setText(String.valueOf(seed.salePrice));}'''
new='''        Spinner prod=productSpinner();EditText productName=input("שם מוצר");EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);EditText cost=input("מחיר קנייה ליחידה");cost.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText sale=input("מחיר מכירה");sale.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);\n        box.addView(productName);box.addView(prod);box.addView(qty);box.addView(cost);box.addView(sale);\n        PurchaseLine line=new PurchaseLine(box,prod,productName,qty,cost,sale);models.add(line);\n        prod.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onItemSelected(android.widget.AdapterView<?> parent,View view,int position,long id){if(position>=0&&position<products.size())productName.setText(products.get(position).name);}public void onNothingSelected(android.widget.AdapterView<?> parent){}});\n        if(seed!=null){for(int i=0;i<products.size();i++)if(products.get(i).id.equals(seed.productId)){prod.setSelection(i);productName.setText(products.get(i).name);}qty.setText(String.valueOf(seed.quantity));cost.setText(String.valueOf(seed.unitCost));sale.setText(String.valueOf(seed.salePrice));}else if(!products.isEmpty())productName.setText(products.get(prod.getSelectedItemPosition()).name);'''
if old not in s:
    raise SystemExit('purchase line marker not found')
s=s.replace(old,new,1)

old_save='''            for(PurchaseLine l:lines){if(l.quantity()<1)continue;JSONObject it=new JSONObject();Product p=products.get(l.product.getSelectedItemPosition());it.put("product_id",p.id);it.put("quantity",l.quantity());it.put("unit_cost",l.cost());it.put("sale_price",l.sale());items.put(it);}'''
new_save='''            for(PurchaseLine l:lines){if(l.quantity()<1)continue;JSONObject it=new JSONObject();Product p=products.get(l.product.getSelectedItemPosition());renamePurchaseProductIfNeeded(p,l.name);it.put("product_id",p.id);it.put("quantity",l.quantity());it.put("unit_cost",l.cost());it.put("sale_price",l.sale());items.put(it);}'''
if old_save not in s:
    raise SystemExit('new purchase save marker not found')
s=s.replace(old_save,new_save,1)

old_edit='''for(PurchaseLine l:lines){if(l.quantity()<1)continue;JSONObject it=new JSONObject();Product pr=products.get(l.product.getSelectedItemPosition());it.put("product_id",pr.id);it.put("quantity",l.quantity());it.put("unit_cost",l.cost());it.put("sale_price",l.sale());arr.put(it);}'''
new_edit='''for(PurchaseLine l:lines){if(l.quantity()<1)continue;JSONObject it=new JSONObject();Product pr=products.get(l.product.getSelectedItemPosition());renamePurchaseProductIfNeeded(pr,l.name);it.put("product_id",pr.id);it.put("quantity",l.quantity());it.put("unit_cost",l.cost());it.put("sale_price",l.sale());arr.put(it);}'''
if old_edit not in s:
    raise SystemExit('edit purchase save marker not found')
s=s.replace(old_edit,new_edit,1)

helper='''    private void renamePurchaseProductIfNeeded(Product p,EditText name)throws Exception{String value=name.getText().toString().trim();if(value.isEmpty())throw new Exception("חסר שם מוצר");if(!value.equals(p.name)){JSONObject b=new JSONObject();b.put("name",value);requestRaw("PATCH","/rest/v1/products?id=eq."+url(p.id),b,true);p.name=value;}}\n\n'''
marker='    private Spinner supplierSpinner()'
if 'renamePurchaseProductIfNeeded' not in s[s.find(marker)-500:s.find(marker)]:
    if marker not in s: raise SystemExit('helper marker not found')
    s=s.replace(marker,helper+marker,1)

old_cls='''    static class PurchaseLine{LinearLayout root;Spinner product;EditText qty,cost,sale;Runnable onChange;PurchaseLine(LinearLayout r,Spinner p,EditText q,EditText c,EditText s){root=r;product=p;qty=q;cost=c;sale=s;}int quantity(){try{return Integer.parseInt(qty.getText().toString().trim());}catch(Exception e){return 0;}}double cost(){try{return Double.parseDouble(cost.getText().toString().trim());}catch(Exception e){return 0;}}double sale(){try{return Double.parseDouble(sale.getText().toString().trim());}catch(Exception e){return 0;}}}'''
new_cls='''    static class PurchaseLine{LinearLayout root;Spinner product;EditText name,qty,cost,sale;Runnable onChange;PurchaseLine(LinearLayout r,Spinner p,EditText n,EditText q,EditText c,EditText s){root=r;product=p;name=n;qty=q;cost=c;sale=s;}int quantity(){try{return Integer.parseInt(qty.getText().toString().trim());}catch(Exception e){return 0;}}double cost(){try{return Double.parseDouble(cost.getText().toString().trim());}catch(Exception e){return 0;}}double sale(){try{return Double.parseDouble(sale.getText().toString().trim());}catch(Exception e){return 0;}}}'''
if old_cls not in s:
    raise SystemExit('PurchaseLine class marker not found')
s=s.replace(old_cls,new_cls,1)

path.write_text(s,encoding='utf-8')

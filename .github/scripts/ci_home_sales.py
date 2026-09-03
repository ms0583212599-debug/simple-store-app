from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

admin_marker='        Button logout=button("יציאה מניהול",red,Color.WHITE);'
buttons='''        Button homeUse=button("שימוש עצמי",Color.WHITE,blue);homeUse.setOnClickListener(v->showHomeUseNative());LinearLayout.LayoutParams hup=new LinearLayout.LayoutParams(-1,dp(64));hup.setMargins(0,0,0,dp(12));content.addView(homeUse,hup);\n        Button specialSale=button("מכירה מיוחדת",Color.WHITE,blue);specialSale.setOnClickListener(v->showSpecialSaleNative());LinearLayout.LayoutParams ssp=new LinearLayout.LayoutParams(-1,dp(64));ssp.setMargins(0,0,0,dp(12));content.addView(specialSale,ssp);\n        Button activitySummary=button("סיכום מכירות ומוצרים",Color.WHITE,blue);activitySummary.setOnClickListener(v->showProductActivitySummaryNative());LinearLayout.LayoutParams asp=new LinearLayout.LayoutParams(-1,dp(64));asp.setMargins(0,0,0,dp(12));content.addView(activitySummary,asp);\n'''
if 'showHomeUseNative()' not in s:
    if admin_marker not in s: raise SystemExit('admin marker not found')
    s=s.replace(admin_marker,buttons+admin_marker,1)

helper_marker='    private void showProductsAdmin(){'
methods=r'''    private Product findProductByNameNative(String name){
        if(name==null)return null;String n=name.trim();for(Product p:products)if(p.name.equalsIgnoreCase(n))return p;return null;
    }

    private android.widget.AutoCompleteTextView productNameInputNative(){
        android.widget.AutoCompleteTextView x=new android.widget.AutoCompleteTextView(this);x.setHint("הקלד או בחר מוצר");x.setTextSize(18);x.setSingleLine(true);x.setPadding(dp(14),0,dp(14),0);List<String> names=new ArrayList<>();for(Product p:products)names.add(p.name);ArrayAdapter<String> a=new ArrayAdapter<>(this,android.R.layout.simple_dropdown_item_1line,names);x.setAdapter(a);x.setThreshold(1);return x;
    }

    private double[] loadNativeCostAndStock(String productId)throws Exception{
        JSONArray a=requestArray("GET","/rest/v1/products?id=eq."+url(productId)+"&select=average_cost,last_purchase_price,stock_quantity",null,true);if(a.length()==0)throw new Exception("המוצר לא נמצא");JSONObject o=a.getJSONObject(0);double avg=o.optDouble("average_cost",0),last=o.optDouble("last_purchase_price",0);return new double[]{avg>0?avg:last,o.optDouble("stock_quantity",0)};
    }

    private void showHomeUseNative(){
        buildShell("שימוש עצמי",this::showAdminHome,false);
        TextView help=text("רישום מוצרים שנלקחו לשימוש עצמי. השמירה מפחיתה מהמלאי ומחשבת לפי מחיר העלות.",16,false);help.setPadding(0,0,0,dp(12));content.addView(help);
        android.widget.AutoCompleteTextView product=productNameInputNative();content.addView(label("מוצר"));content.addView(product,new LinearLayout.LayoutParams(-1,dp(58)));
        EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);qty.setText("1");content.addView(label("כמות"));content.addView(qty);
        TextView info=text("בחר מוצר כדי לראות מלאי ועלות",16,false);info.setPadding(0,dp(8),0,dp(8));content.addView(info);
        EditText note=input("הערה");content.addView(label("הערה"));content.addView(note);
        Runnable refresh=()->{Product p=findProductByNameNative(product.getText().toString());if(p==null){info.setText("יש לבחור מוצר קיים");return;}io.execute(()->{try{double[] c=loadNativeCostAndStock(p.id);main.post(()->info.setText("מלאי: "+(int)c[1]+"   |   עלות ליחידה: "+String.format(Locale.ROOT,"%.2f",c[0])+" ₪"));}catch(Exception e){main.post(()->info.setText("לא ניתן לטעון עלות כרגע"));}});};
        product.setOnItemClickListener((a,v,pos,id)->refresh.run());product.setOnFocusChangeListener((v,has)->{if(!has)refresh.run();});
        Button save=button("שמור והפחת מהמלאי",green,Color.WHITE);save.setOnClickListener(v->{Product p=findProductByNameNative(product.getText().toString());if(p==null){Toast.makeText(this,"יש לבחור מוצר קיים",Toast.LENGTH_LONG).show();return;}int q;try{q=Integer.parseInt(qty.getText().toString().trim());}catch(Exception e){q=0;}if(q<=0){Toast.makeText(this,"כמות לא תקינה",Toast.LENGTH_LONG).show();return;}final int fq=q;io.execute(()->{try{double[] cs=loadNativeCostAndStock(p.id);double total=cs[0]*fq;if(fq>cs[1]){main.post(()->Toast.makeText(this,"אין מספיק מלאי",Toast.LENGTH_LONG).show());return;}main.post(()->new AlertDialog.Builder(this).setTitle("אישור שימוש עצמי").setMessage("להפחית "+p.name+" × "+fq+" מהמלאי?\nסה״כ לפי עלות: "+String.format(Locale.ROOT,"%.2f",total)+" ₪").setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->saveHomeUseNative(p,fq,note.getText().toString())).show());}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת פרטי המוצר נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});});content.addView(save,new LinearLayout.LayoutParams(-1,dp(60)));
    }

    private void saveHomeUseNative(Product p,int qty,String note){
        io.execute(()->{try{JSONObject item=new JSONObject();item.put("product_id",p.id);item.put("quantity",qty);JSONArray items=new JSONArray();items.put(item);JSONObject body=new JSONObject();body.put("p_items",items);body.put("p_note",note==null||note.trim().isEmpty()?JSONObject.NULL:note.trim());body.put("p_taken_at",new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.ROOT).format(new Date()));requestRaw("POST","/rest/v1/rpc/create_home_withdrawal",body,true);loadData(()->{Toast.makeText(this,"נשמר והמלאי עודכן",Toast.LENGTH_LONG).show();showHomeUseNative();});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת שימוש עצמי נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private void showSpecialSaleNative(){
        buildShell("מכירה מיוחדת",this::showAdminHome,false);
        TextView help=text("למוצר שנמכר במחיר עלות או בהנחה. הזן את המחיר שבו מכרת בפועל.",16,false);help.setPadding(0,0,0,dp(12));content.addView(help);
        android.widget.AutoCompleteTextView product=productNameInputNative();content.addView(label("מוצר"));content.addView(product,new LinearLayout.LayoutParams(-1,dp(58)));
        Spinner type=new Spinner(this);ArrayAdapter<String> ta=new ArrayAdapter<>(this,android.R.layout.simple_spinner_item,new String[]{"מחיר עלות","מחיר בהנחה"});ta.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);type.setAdapter(ta);content.addView(label("סוג מכירה"));content.addView(type,new LinearLayout.LayoutParams(-1,dp(58)));
        EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);qty.setText("1");content.addView(label("כמות"));content.addView(qty);
        EditText price=input("מחיר מכירה ליחידה");price.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);content.addView(label("מחיר מכירה ליחידה"));content.addView(price);
        TextView info=text("בחר מוצר כדי לראות מלאי ועלות",16,false);info.setPadding(0,dp(8),0,dp(8));content.addView(info);
        EditText note=input("הערה");content.addView(label("הערה"));content.addView(note);
        Runnable refresh=()->{Product p=findProductByNameNative(product.getText().toString());if(p==null){info.setText("יש לבחור מוצר קיים");return;}io.execute(()->{try{double[] c=loadNativeCostAndStock(p.id);main.post(()->{info.setText("מלאי: "+(int)c[1]+"   |   עלות: "+String.format(Locale.ROOT,"%.2f",c[0])+" ₪");if(type.getSelectedItemPosition()==0)price.setText(String.format(Locale.ROOT,"%.2f",c[0]));});}catch(Exception e){main.post(()->info.setText("לא ניתן לטעון עלות כרגע"));}});};
        product.setOnItemClickListener((a,v,pos,id)->refresh.run());type.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onItemSelected(android.widget.AdapterView<?> p0,View v,int pos,long id){if(pos==0)refresh.run();}public void onNothingSelected(android.widget.AdapterView<?> p0){}});
        Button save=button("שמור מכירה והפחת מהמלאי",green,Color.WHITE);save.setOnClickListener(v->{Product p=findProductByNameNative(product.getText().toString());if(p==null){Toast.makeText(this,"יש לבחור מוצר קיים",Toast.LENGTH_LONG).show();return;}int q;double sp;try{q=Integer.parseInt(qty.getText().toString().trim());sp=Double.parseDouble(price.getText().toString().trim());}catch(Exception e){Toast.makeText(this,"יש להזין כמות ומחיר תקינים",Toast.LENGTH_LONG).show();return;}if(q<=0||sp<0){Toast.makeText(this,"יש להזין כמות ומחיר תקינים",Toast.LENGTH_LONG).show();return;}String st=type.getSelectedItemPosition()==0?"cost":"discount";String label=type.getSelectedItemPosition()==0?"מחיר עלות":"מחיר בהנחה";final int fq=q;final double fsp=sp;new AlertDialog.Builder(this).setTitle("אישור מכירה מיוחדת").setMessage(p.name+" × "+fq+"\n"+label+"\nסה״כ: "+String.format(Locale.ROOT,"%.2f",fsp*fq)+" ₪\nהמלאי יופחת בהתאם.").setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->saveSpecialSaleNative(p,fq,st,fsp,note.getText().toString())).show();});content.addView(save,new LinearLayout.LayoutParams(-1,dp(60)));
    }

    private void saveSpecialSaleNative(Product p,int qty,String type,double price,String note){
        io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_product_id",p.id);b.put("p_quantity",qty);b.put("p_sale_type",type);b.put("p_unit_sale_price",price);b.put("p_note",note==null||note.trim().isEmpty()?JSONObject.NULL:note.trim());b.put("p_sold_at",new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX",Locale.ROOT).format(new Date()));requestRaw("POST","/rest/v1/rpc/create_manual_product_sale",b,true);loadData(()->{Toast.makeText(this,"המכירה נשמרה והמלאי עודכן",Toast.LENGTH_LONG).show();showSpecialSaleNative();});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת המכירה נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private void showProductActivitySummaryNative(){
        buildShell("סיכום מכירות ומוצרים",this::showAdminHome,false);
        LinearLayout filters=new LinearLayout(this);filters.setOrientation(LinearLayout.HORIZONTAL);EditText from=input("מתאריך YYYY-MM-DD");EditText to=input("עד תאריך YYYY-MM-DD");filters.addView(from,new LinearLayout.LayoutParams(0,dp(58),1));LinearLayout.LayoutParams tp=new LinearLayout.LayoutParams(0,dp(58),1);tp.setMargins(dp(8),0,0,0);filters.addView(to,tp);content.addView(filters);
        LinearLayout results=new LinearLayout(this);results.setOrientation(LinearLayout.VERTICAL);Button load=button("הצג סיכום",blue,Color.WHITE);load.setOnClickListener(v->loadProductActivitySummaryNative(from.getText().toString().trim(),to.getText().toString().trim(),results));content.addView(load,new LinearLayout.LayoutParams(-1,dp(58)));content.addView(results);loadProductActivitySummaryNative("","",results);
    }

    private void loadProductActivitySummaryNative(String from,String to,LinearLayout results){
        results.removeAllViews();results.addView(text("טוען...",16,false));io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_from",from.isEmpty()?JSONObject.NULL:from);b.put("p_to",to.isEmpty()?JSONObject.NULL:to);JSONArray d=requestArray("POST","/rest/v1/rpc/get_product_activity_summary",b,true);long sold=0,home=0;double sales=0,hc=0;for(int i=0;i<d.length();i++){JSONObject x=d.getJSONObject(i);sold+=x.optLong("sold_qty");sales+=x.optDouble("sales_amount");home+=x.optLong("home_qty");hc+=x.optDouble("home_cost");}final long fsold=sold,fhome=home;final double fsales=sales,fhc=hc;main.post(()->{results.removeAllViews();TextView sum=text("נמכר ללקוחות: "+fsold+" יחידות   |   מכירות בפועל: "+String.format(Locale.ROOT,"%.2f",fsales)+" ₪\nשימוש עצמי: "+fhome+" יחידות   |   עלות שימוש עצמי: "+String.format(Locale.ROOT,"%.2f",fhc)+" ₪",18,true);sum.setPadding(0,dp(14),0,dp(14));results.addView(sum);for(int i=0;i<d.length();i++){JSONObject x=d.optJSONObject(i);if(x==null)continue;String row=x.optString("product_name")+"\nנמכר: "+x.optLong("sold_qty")+"   |   מכירות: "+String.format(Locale.ROOT,"%.2f",x.optDouble("sales_amount"))+" ₪   |   שימוש עצמי: "+x.optLong("home_qty")+"   |   עלות שימוש עצמי: "+String.format(Locale.ROOT,"%.2f",x.optDouble("home_cost"))+" ₪   |   סה״כ יצא: "+x.optLong("total_out_qty");TextView t=text(row,16,false);LinearLayout c=card();c.addView(t,new LinearLayout.LayoutParams(-1,-2));results.addView(c);}});}catch(Exception e){main.post(()->{results.removeAllViews();results.addView(text("טעינת הסיכום נכשלה: "+safeMsg(e),16,false));});}});
    }

'''
if 'private void showHomeUseNative()' not in s.split(helper_marker)[0]:
    pass
if 'private Product findProductByNameNative' not in s:
    if helper_marker not in s: raise SystemExit('helper marker not found')
    s=s.replace(helper_marker,methods+helper_marker,1)

p.write_text(s,encoding='utf-8')
print('native home-use, special-sale and product summary applied')

from pathlib import Path

path = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
text = path.read_text(encoding='utf-8')

marker = '        Button logout=button("יציאה מניהול",red,Color.WHITE);'
button = '        Button update=button("בדוק עדכון אפליקציה",green,Color.WHITE);update.setOnClickListener(v->AppUpdater.checkForUpdate(this));LinearLayout.LayoutParams up=new LinearLayout.LayoutParams(-1,dp(60));up.setMargins(0,0,0,dp(12));content.addView(update,up);\n'
if 'בדוק עדכון אפליקציה' not in text:
    if marker not in text:
        raise SystemExit('Admin update button marker not found')
    text = text.replace(marker, button + marker, 1)

old_cat = '        for(Category c:categories){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView t=text(c.name+"   "+("custom".equals(c.imageMode)?"תמונה מותאמת":"תמונות אוטומטיות"),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->categoryDialog(c));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}'
new_cat = '        for(Category c:categories){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);int pc=0;for(Product p:products)if(p.categoryId.equals(c.id))pc++;TextView t=text(c.name+"   ("+pc+" מוצרים)",18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button upc=button("↑",Color.rgb(237,241,247),blue);upc.setOnClickListener(v->moveCategory(c,-1));row.addView(upc,new LinearLayout.LayoutParams(dp(58),dp(52)));Button dnc=button("↓",Color.rgb(237,241,247),blue);dnc.setOnClickListener(v->moveCategory(c,1));row.addView(dnc,new LinearLayout.LayoutParams(dp(58),dp(52)));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->categoryDialog(c));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}'
if old_cat in text:
    text = text.replace(old_cat, new_cat, 1)

old_prod = '                Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->productDialog(p));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);'
new_prod = '                Button upp=button("↑",Color.rgb(237,241,247),blue);upp.setOnClickListener(v->moveProduct(p,-1));row.addView(upp,new LinearLayout.LayoutParams(dp(56),dp(52)));Button dnp=button("↓",Color.rgb(237,241,247),blue);dnp.setOnClickListener(v->moveProduct(p,1));row.addView(dnp,new LinearLayout.LayoutParams(dp(56),dp(52)));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->productDialog(p));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);'
if old_prod in text:
    text = text.replace(old_prod, new_prod, 1)

helper_marker = '    private void showStockAdmin(){'
helpers = '''    private void moveCategory(Category c,int d){int i=categories.indexOf(c),j=i+d;if(i<0||j<0||j>=categories.size())return;Category o=categories.get(j);int a=c.sortOrder,b=o.sortOrder;if(a==b){a=i+1;b=j+1;}final int ca=b,ob=a;io.execute(()->{try{JSONObject x=new JSONObject();x.put("sort_order",ca);requestRaw("PATCH","/rest/v1/categories?id=eq."+url(c.id),x,true);JSONObject y=new JSONObject();y.put("sort_order",ob);requestRaw("PATCH","/rest/v1/categories?id=eq."+url(o.id),y,true);loadData(this::showCategoriesAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שינוי סדר קטגוריות נכשל",Toast.LENGTH_LONG).show());}});}
    private void moveProduct(Product p,int d){List<Product> s=new ArrayList<>();for(Product x:products)if(x.categoryId.equals(p.categoryId))s.add(x);int i=s.indexOf(p),j=i+d;if(i<0||j<0||j>=s.size())return;Product o=s.get(j);int a=p.sortOrder,b=o.sortOrder;if(a==b){a=i+1;b=j+1;}final int pa=b,ob=a;io.execute(()->{try{JSONObject x=new JSONObject();x.put("sort_order",pa);requestRaw("PATCH","/rest/v1/products?id=eq."+url(p.id),x,true);JSONObject y=new JSONObject();y.put("sort_order",ob);requestRaw("PATCH","/rest/v1/products?id=eq."+url(o.id),y,true);loadData(this::showProductsAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שינוי סדר מוצרים נכשל",Toast.LENGTH_LONG).show());}});}

'''
if 'private void moveCategory(Category c,int d)' not in text:
    if helper_marker not in text:
        raise SystemExit('Admin helper marker not found')
    text = text.replace(helper_marker, helpers + helper_marker, 1)

if 'import android.content.Intent;' not in text:
    text = text.replace('import android.app.AlertDialog;\n', 'import android.app.AlertDialog;\nimport android.content.Intent;\nimport android.net.Uri;\n', 1)

state_marker = '    private String adminUserId = "";'
if 'private String pendingImageKind' not in text:
    text = text.replace(state_marker, state_marker + '\n    private String pendingImageKind = "";\n    private String pendingImageId = "";\n    private static final int PICK_IMAGE_REQUEST = 7001;', 1)

prod_marker = '            if(p!=null){\n                Button archive=button("הסר מוצר",red,Color.WHITE);'
if 'בחר תמונת מוצר' not in text:
    prod_repl = '            if(p!=null){\n                Button imageBtn=button("בחר תמונת מוצר",Color.WHITE,blue);box.addView(imageBtn,new LinearLayout.LayoutParams(-1,dp(54)));imageBtn.setOnClickListener(v->{dlg.dismiss();openImagePicker("product",p.id);});\n                Button archive=button("הסר מוצר",red,Color.WHITE);'
    if prod_marker not in text:
        raise SystemExit('Product image marker not found')
    text = text.replace(prod_marker, prod_repl, 1)

cat_marker = '        if(c!=null){name.setText(c.name);mode.setSelection("custom".equals(c.imageMode)?1:0);}'
if 'בחר תמונת קטגוריה' not in text:
    cat_repl = '        if(c!=null){name.setText(c.name);mode.setSelection("custom".equals(c.imageMode)?1:0);Button imageBtn=button("בחר תמונת קטגוריה",Color.WHITE,blue);box.addView(imageBtn,new LinearLayout.LayoutParams(-1,dp(54)));imageBtn.setOnClickListener(v->openImagePicker("category",c.id));}'
    if cat_marker not in text:
        raise SystemExit('Category image marker not found')
    text = text.replace(cat_marker, cat_repl, 1)

if 'private void openImagePicker(String kind,String id)' not in text:
    image_methods = '''    private void openImagePicker(String kind,String id){
        pendingImageKind=kind;pendingImageId=id;
        Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT);pick.addCategory(Intent.CATEGORY_OPENABLE);pick.setType("image/*");startActivityForResult(pick,PICK_IMAGE_REQUEST);
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode!=PICK_IMAGE_REQUEST||resultCode!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();
        Toast.makeText(this,"מעלה תמונה...",Toast.LENGTH_LONG).show();
        io.execute(()->{try{uploadSelectedImage(uri,pendingImageKind,pendingImageId);loadData(()->{Toast.makeText(this,"התמונה עודכנה",Toast.LENGTH_LONG).show();if("category".equals(pendingImageKind))showCategoriesAdmin();else showProductsAdmin();});}catch(Exception e){main.post(()->Toast.makeText(this,"העלאת תמונה נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private void uploadSelectedImage(Uri uri,String kind,String id)throws Exception{
        String mime=getContentResolver().getType(uri);if(mime==null||!mime.startsWith("image/"))mime="image/jpeg";
        String ext=mime.contains("png")?"png":(mime.contains("webp")?"webp":"jpg");
        String objectPath="android/"+kind+"-"+id+"-"+System.currentTimeMillis()+"."+ext;
        HttpURLConnection c=(HttpURLConnection)new URL(BASE+"/storage/v1/object/product-images/"+objectPath).openConnection();
        c.setRequestMethod("POST");c.setConnectTimeout(20000);c.setReadTimeout(30000);c.setDoOutput(true);c.setRequestProperty("apikey",KEY);c.setRequestProperty("Authorization","Bearer "+adminToken);c.setRequestProperty("Content-Type",mime);c.setRequestProperty("x-upsert","true");
        try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=c.getOutputStream()){if(in==null)throw new Exception("לא ניתן לקרוא את התמונה");byte[] buf=new byte[16384];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);}
        int code=c.getResponseCode();if(code<200||code>=300){InputStream er=c.getErrorStream();StringBuilder b=new StringBuilder();if(er!=null){BufferedReader r=new BufferedReader(new InputStreamReader(er));String line;while((line=r.readLine())!=null)b.append(line);r.close();}throw new Exception("HTTP "+code+" "+b);}
        c.disconnect();
        String publicUrl=BASE+"/storage/v1/object/public/product-images/"+objectPath;
        JSONObject body=new JSONObject();body.put("image_url",publicUrl);body.put("image_path",objectPath);
        if("category".equals(kind)){body.put("image_mode","custom");requestRaw("PATCH","/rest/v1/categories?id=eq."+url(id),body,true);}else requestRaw("PATCH","/rest/v1/products?id=eq."+url(id),body,true);
    }

'''
    if helper_marker not in text:
        raise SystemExit('Image helper marker not found')
    text = text.replace(helper_marker, image_methods + helper_marker, 1)

path.write_text(text, encoding='utf-8')

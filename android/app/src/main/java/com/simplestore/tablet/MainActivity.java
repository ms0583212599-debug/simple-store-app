package com.simplestore.tablet;

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String BASE = "https://ksddrcalmszxxcuxoznd.supabase.co";
    private static final String KEY = "sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR";
    private static final String ADMIN_EMAIL = "ms0583212599@gmail.com";
    private static final String CREATE = BASE + "/functions/v1/create-checkout";
    private static final String CALLBACK = BASE + "/functions/v1/nedarim-callback";
    private static final String MOSAD = "7014693";
    private static final String APIVALID = "vbnioH8OQd";

    private final ExecutorService io = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Category> categories = new ArrayList<>();
    private final List<Product> products = new ArrayList<>();
    private final List<Supplier> suppliers = new ArrayList<>();
    private final Map<String,Integer> cart = new HashMap<>();
    private LinearLayout content;
    private Button cartButton;
    private WebView paymentWebView;
    private Button chargeButton;
    private TextView paymentStatus;
    private String saleToken = "";
    private double saleTotal = 0;
    private volatile boolean polling = false;
    private String adminToken = "";
    private final int blue = Color.rgb(34,91,203);

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        showLoading();
        loadData(this::showHome);
    }

    private LinearLayout baseRoot(){
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);root.setBackgroundColor(Color.rgb(246,248,252));return root;
    }
    private void showLoading(){LinearLayout root=baseRoot();TextView t=text("טוען את החנות...",24,true);t.setGravity(Gravity.CENTER);t.setPadding(dp(20),dp(100),dp(20),dp(20));root.addView(t,new LinearLayout.LayoutParams(-1,-1));setContentView(root);}

    private void loadData(Runnable done){
        io.execute(()->{try{
            JSONArray cs=requestArray("GET","/rest/v1/categories?select=*&order=sort_order.asc",null,false);
            JSONArray ps=requestArray("GET","/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc",null,false);
            categories.clear();products.clear();
            for(int i=0;i<cs.length();i++){JSONObject o=cs.getJSONObject(i);categories.add(new Category(o.optString("id"),o.optString("name"),o.optString("image_url"),o.optString("image_mode")));}
            for(int i=0;i<ps.length();i++){JSONObject o=ps.getJSONObject(i);if(!o.optBoolean("is_active",true))continue;products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url")));}
            main.post(done);
        }catch(Exception e){main.post(()->Toast.makeText(this,"שגיאה בטעינת החנות",Toast.LENGTH_LONG).show());}});
    }

    private String requestRaw(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(path.startsWith("http")?path:BASE+path).openConnection();c.setRequestMethod(method);c.setConnectTimeout(15000);c.setReadTimeout(15000);c.setRequestProperty("apikey",KEY);c.setRequestProperty("Content-Type","application/json");c.setRequestProperty("Authorization","Bearer "+(useAdmin&&!adminToken.isEmpty()?adminToken:KEY));
        if(body!=null){c.setDoOutput(true);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
        int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();BufferedReader r=new BufferedReader(new InputStreamReader(in));StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);r.close();if(code<200||code>=300)throw new Exception("HTTP "+code+": "+b);return b.toString();
    }
    private JSONArray requestArray(String method,String path,JSONObject body,boolean useAdmin)throws Exception{String s=requestRaw(method,path,body,useAdmin);return s==null||s.isEmpty()?new JSONArray():new JSONArray(s);}

    private void buildShell(String title,Runnable back,boolean adminButton){
        LinearLayout root=baseRoot();LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(22),dp(14),dp(22),dp(10));
        if(back!=null){Button b=button("‹  חזור",Color.WHITE,blue);b.setOnClickListener(v->back.run());top.addView(b,new LinearLayout.LayoutParams(dp(130),dp(52)));}
        TextView brand=text(title,22,true);brand.setGravity(Gravity.CENTER);top.addView(brand,new LinearLayout.LayoutParams(0,dp(52),1));
        if(adminButton){Button settings=button("⚙",Color.WHITE,blue);settings.setOnClickListener(v->openAdmin());top.addView(settings,new LinearLayout.LayoutParams(dp(70),dp(52)));}
        cartButton=button("סל  0",blue,Color.WHITE);cartButton.setOnClickListener(v->showCart());top.addView(cartButton,new LinearLayout.LayoutParams(dp(150),dp(52)));
        root.addView(top);ScrollView scroll=new ScrollView(this);content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(26),dp(10),dp(26),dp(110));scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);updateCartButton();
    }

    private void showHome(){polling=false;buildShell("מערכת מכירה",null,true);EditText search=input("חיפוש מוצר");content.addView(search,new LinearLayout.LayoutParams(-1,dp(64)));TextView h=text("בחר קטגוריה",28,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(24),0,dp(18));content.addView(h);GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));for(Category c:categories)grid.addView(categoryCard(c),gridParams());search.setOnEditorActionListener((v,a,e)->{String q=search.getText().toString().trim();if(!q.isEmpty())showSearch(q);return true;});}
    private View categoryCard(Category c){LinearLayout card=card();ImageView image=imageView();String img=c.imageUrl;if((img==null||img.isEmpty())||!"custom".equals(c.imageMode)){for(Product p:products)if(p.categoryId.equals(c.id)&&p.imageUrl!=null&&!p.imageUrl.isEmpty()){img=p.imageUrl;break;}}if(img!=null&&!img.isEmpty())loadImage(img,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(145)));TextView name=text(c.name,19,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(8),dp(12),dp(8),dp(14));card.addView(name);card.setOnClickListener(v->showCategory(c));return card;}
    private void showCategory(Category c){buildShell(c.name,this::showHome,true);GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));for(Product p:products)if(p.categoryId.equals(c.id))grid.addView(productCard(p),gridParams());}
    private void showSearch(String q){buildShell("תוצאות חיפוש",this::showHome,true);GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));String s=q.toLowerCase();for(Product p:products)if(p.name.toLowerCase().contains(s))grid.addView(productCard(p),gridParams());}
    private View productCard(Product p){LinearLayout card=card();ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));TextView n=text(p.name,18,true);n.setPadding(dp(10),dp(10),dp(10),0);card.addView(n);TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),22,true);price.setPadding(dp(10),dp(4),dp(10),0);card.addView(price);TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(10),dp(4),dp(10),dp(8));card.addView(stock);Button add=button(p.stock>0?"הוסף לסל":"לא זמין",blue,Color.WHITE);add.setEnabled(p.stock>0);add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();}});LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(50));ab.setMargins(dp(10),0,dp(10),dp(12));card.addView(add,ab);return card;}

    private void showCart(){buildShell("סל קניות",this::showHome,false);double total=0;int count=0;for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q==0)continue;count+=q;total+=q*p.price;LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView n=text(p.name+"  × "+q,19,true);row.addView(n,new LinearLayout.LayoutParams(0,dp(64),1));Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);showCart();});row.addView(minus,new LinearLayout.LayoutParams(dp(54),dp(48)));Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock)cart.put(p.id,x+1);showCart();});row.addView(plus,new LinearLayout.LayoutParams(dp(54),dp(48)));content.addView(row);}TextView t=text(String.format(Locale.US,"סה״כ: %.2f ₪",total),31,true);t.setGravity(Gravity.CENTER);t.setPadding(0,dp(22),0,dp(16));content.addView(t);Button pay=button("מעבר לתשלום",Color.rgb(22,163,74),Color.WHITE);pay.setEnabled(count>0);pay.setOnClickListener(v->startCheckout());content.addView(pay,new LinearLayout.LayoutParams(-1,dp(64)));}

    private void startCheckout(){if(cart.isEmpty())return;io.execute(()->{try{JSONArray items=new JSONArray();for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;JSONObject x=new JSONObject();x.put("product_id",p.id);x.put("unit_price",p.price);x.put("quantity",q);items.put(x);}JSONObject body=new JSONObject();body.put("items",items);JSONObject r=new JSONObject(requestRaw("POST",CREATE,body,false));saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",0);main.post(this::showPayment);}catch(Exception e){main.post(()->Toast.makeText(this,"לא ניתן להתחיל תשלום",Toast.LENGTH_LONG).show());}});}
    private void showPayment(){LinearLayout root=baseRoot();LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(22),dp(12),dp(22),dp(8));Button back=button("‹  חזור",Color.WHITE,blue);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(130),dp(52)));TextView title=text("תשלום",24,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));root.addView(top);paymentStatus=text(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal),25,true);paymentStatus.setGravity(Gravity.CENTER);root.addView(paymentStatus);paymentWebView=new WebView(this);WebSettings s=paymentWebView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");root.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));chargeButton=button("בצע תשלום",Color.rgb(22,163,74),Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());root.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(64)));setContentView(root);String html="<!doctype html><html dir='rtl'><body style='margin:0'><iframe id='frame' src='https://www.matara.pro/nedarimplus/iframe/?Picture=Hide' style='width:100%;height:100vh;border:0'></iframe><script>function p(d){frame.contentWindow.postMessage(d,'*')}window.addEventListener('message',e=>{let d=e.data;if(d&&d.Name==='TransactionResponse')Android.onTransaction(JSON.stringify(d.Value||{}));});</script></body></html>";paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);}
    private void chargeCard(){if(paymentWebView==null)return;chargeButton.setEnabled(false);String js="p({Name:'FinishTransaction2',Value:{Mosad:'"+MOSAD+"',ApiValid:'"+APIVALID+"',PaymentType:'Ragil',Currency:'1',Amount:'"+String.format(Locale.US,"%.2f",saleTotal)+"',Tashlumim:'1',Param1:'"+saleToken+"',CallBack:'"+CALLBACK+"'}})";paymentWebView.evaluateJavascript(js,null);}
    public class PaymentBridge{@JavascriptInterface public void onTransaction(String value){main.post(()->{paymentStatus.setText("בודק תשלום...");startPolling();});}}
    private void startPolling(){polling=true;io.execute(()->{for(int i=0;i<45&&polling;i++){try{JSONObject body=new JSONObject();body.put("p_token",saleToken);JSONArray a=requestArray("POST","/rest/v1/rpc/get_sale_status",body,false);if(a.length()>0&&"paid".equals(a.getJSONObject(0).optString("status"))){polling=false;cart.clear();loadData(()->{Toast.makeText(this,"התשלום בוצע",Toast.LENGTH_LONG).show();showHome();});return;}Thread.sleep(2000);}catch(Exception ignored){}}});}

    private void openAdmin(){if(adminToken.isEmpty())showLogin();else showAdminHome();}
    private void showLogin(){final EditText pass=input("סיסמה");pass.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);new AlertDialog.Builder(this).setTitle("כניסת מנהל").setView(pass).setNegativeButton("ביטול",null).setPositiveButton("כניסה",(d,w)->login(pass.getText().toString())).show();}
    private void login(String password){io.execute(()->{try{JSONObject body=new JSONObject();body.put("email",ADMIN_EMAIL);body.put("password",password);JSONObject r=new JSONObject(requestRaw("POST","/auth/v1/token?grant_type=password",body,false));adminToken=r.optString("access_token");if(adminToken.isEmpty())throw new Exception();main.post(this::showAdminHome);}catch(Exception e){main.post(()->Toast.makeText(this,"סיסמה שגויה",Toast.LENGTH_LONG).show());}});}
    private void showAdminHome(){buildShell("ניהול",this::showHome,false);String[] labels={"מוצרים וקטגוריות","מלאי","ספקים","רכישה חדשה","היסטוריית רכישות","דוחות"};Runnable[] actions={this::showProductsAdmin,this::showStockAdmin,this::showSuppliersAdmin,this::showNewPurchase,this::showPurchaseHistory,this::showReports};for(int i=0;i<labels.length;i++){final int idx=i;Button b=button(labels[idx],Color.WHITE,blue);b.setOnClickListener(v->actions[idx].run());LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(64));p.setMargins(0,0,0,dp(12));content.addView(b,p);}Button logout=button("יציאה מניהול",Color.rgb(220,38,38),Color.WHITE);logout.setOnClickListener(v->{adminToken="";showHome();});content.addView(logout,new LinearLayout.LayoutParams(-1,dp(60)));}

    private void showProductsAdmin(){buildShell("מוצרים וקטגוריות",this::showAdminHome,false);Button add=button("+ הוסף מוצר",blue,Color.WHITE);add.setOnClickListener(v->productDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));for(Product p:products){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView t=text(p.name+"   "+String.format(Locale.US,"%.2f ₪",p.price),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->productDialog(p));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}Button cats=button("ניהול קטגוריות",Color.WHITE,blue);cats.setOnClickListener(v->categoryDialog());content.addView(cats,new LinearLayout.LayoutParams(-1,dp(60)));}
    private void productDialog(Product p){LinearLayout box=baseRoot();EditText name=input("שם מוצר");EditText price=input("מחיר");price.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText stock=input("מלאי");stock.setInputType(InputType.TYPE_CLASS_NUMBER);Spinner cat=new Spinner(this);List<String> names=new ArrayList<>();for(Category c:categories)names.add(c.name);cat.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));box.addView(name);box.addView(price);box.addView(stock);box.addView(cat);if(p!=null){name.setText(p.name);price.setText(String.valueOf(p.price));stock.setText(String.valueOf(p.stock));for(int i=0;i<categories.size();i++)if(categories.get(i).id.equals(p.categoryId))cat.setSelection(i);}new AlertDialog.Builder(this).setTitle(p==null?"מוצר חדש":"עריכת מוצר").setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->{io.execute(()->{try{JSONObject body=new JSONObject();body.put("name",name.getText().toString().trim());body.put("price",Double.parseDouble(price.getText().toString()));body.put("stock_quantity",Integer.parseInt(stock.getText().toString()));body.put("category_id",categories.get(cat.getSelectedItemPosition()).id);body.put("is_active",true);if(p==null)requestRaw("POST","/rest/v1/products",body,true);else requestRaw("PATCH","/rest/v1/products?id=eq."+p.id,body,true);loadData(this::showProductsAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שמירה נכשלה",Toast.LENGTH_LONG).show());}});}).show();}
    private void categoryDialog(){final EditText name=input("שם קטגוריה");new AlertDialog.Builder(this).setTitle("הוסף קטגוריה").setView(name).setNegativeButton("ביטול",null).setPositiveButton("הוסף",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("name",name.getText().toString().trim());b.put("sort_order",categories.size()+1);b.put("image_mode","auto");requestRaw("POST","/rest/v1/categories",b,true);loadData(this::showProductsAdmin);}catch(Exception ignored){}})).show();}
    private void showStockAdmin(){buildShell("מלאי",this::showAdminHome,false);for(Product p:products){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView t=text(p.name+"   מלאי: "+p.stock,18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button adjust=button("עדכון",blue,Color.WHITE);adjust.setOnClickListener(v->stockDialog(p));row.addView(adjust,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}}
    private void stockDialog(Product p){LinearLayout box=baseRoot();EditText qty=input("שינוי כמות (+/-)");qty.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_SIGNED);EditText note=input("הערה");box.addView(qty);box.addView(note);new AlertDialog.Builder(this).setTitle(p.name).setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_product_id",p.id);b.put("p_change_qty",Integer.parseInt(qty.getText().toString()));b.put("p_reason","manual");b.put("p_note",note.getText().toString());requestRaw("POST","/rest/v1/rpc/adjust_stock",b,true);loadData(this::showStockAdmin);}catch(Exception ignored){}})).show();}

    private void loadSuppliers(Runnable done){io.execute(()->{try{JSONArray a=requestArray("GET","/rest/v1/suppliers?select=*&order=name.asc",null,true);suppliers.clear();for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);suppliers.add(new Supplier(o.optString("id"),o.optString("name"),o.optString("phone"),o.optString("email")));}main.post(done);}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת ספקים נכשלה",Toast.LENGTH_LONG).show());}});}
    private void showSuppliersAdmin(){loadSuppliers(()->{buildShell("ספקים",this::showAdminHome,false);Button add=button("+ הוסף ספק",blue,Color.WHITE);add.setOnClickListener(v->supplierDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));for(Supplier s:suppliers){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);TextView t=text(s.name+(s.phone.isEmpty()?"":"   "+s.phone),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->supplierDialog(s));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}});}
    private void supplierDialog(Supplier s){LinearLayout box=baseRoot();EditText name=input("שם ספק");EditText phone=input("טלפון");EditText email=input("מייל");box.addView(name);box.addView(phone);box.addView(email);if(s!=null){name.setText(s.name);phone.setText(s.phone);email.setText(s.email);}new AlertDialog.Builder(this).setTitle(s==null?"ספק חדש":"עריכת ספק").setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("name",name.getText().toString().trim());b.put("phone",phone.getText().toString().trim());b.put("email",email.getText().toString().trim());if(s==null)requestRaw("POST","/rest/v1/suppliers",b,true);else requestRaw("PATCH","/rest/v1/suppliers?id=eq."+s.id,b,true);main.post(this::showSuppliersAdmin);}catch(Exception ignored){}})).show();}

    private void showNewPurchase(){loadSuppliers(()->{buildShell("רכישה חדשה",this::showAdminHome,false);Spinner sup=new Spinner(this);List<String> sn=new ArrayList<>();sn.add("ללא ספק");for(Supplier s:suppliers)sn.add(s.name);sup.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,sn));content.addView(sup);Spinner prod=new Spinner(this);List<String> pn=new ArrayList<>();for(Product p:products)pn.add(p.name);prod.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,pn));content.addView(prod);EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);EditText cost=input("מחיר קנייה ליחידה");cost.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText sale=input("מחיר מכירה");sale.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);content.addView(qty);content.addView(cost);content.addView(sale);Button save=button("שמור רכישה",blue,Color.WHITE);save.setOnClickListener(v->io.execute(()->{try{JSONArray items=new JSONArray();JSONObject it=new JSONObject();Product p=products.get(prod.getSelectedItemPosition());it.put("product_id",p.id);it.put("quantity",Integer.parseInt(qty.getText().toString()));it.put("unit_cost",Double.parseDouble(cost.getText().toString()));it.put("sale_price",Double.parseDouble(sale.getText().toString()));items.put(it);JSONObject b=new JSONObject();b.put("p_supplier_id",sup.getSelectedItemPosition()==0?JSONObject.NULL:suppliers.get(sup.getSelectedItemPosition()-1).id);b.put("p_purchase_date",new java.text.SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new java.util.Date()));b.put("p_invoice_number",JSONObject.NULL);b.put("p_notes",JSONObject.NULL);b.put("p_items",items);requestRaw("POST","/rest/v1/rpc/create_purchase",b,true);loadData(()->{Toast.makeText(this,"הרכישה נשמרה",Toast.LENGTH_LONG).show();showAdminHome();});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת רכישה נכשלה",Toast.LENGTH_LONG).show());}}));content.addView(save,new LinearLayout.LayoutParams(-1,dp(62)));});}

    private void showPurchaseHistory(){buildShell("היסטוריית רכישות",this::showAdminHome,false);io.execute(()->{try{JSONArray a=requestArray("GET","/rest/v1/purchases?select=*&order=purchase_date.desc,created_at.desc&limit=100",null,true);main.post(()->{try{for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);LinearLayout row=card();TextView t=text(o.optString("purchase_date")+"   "+String.format(Locale.US,"%.2f ₪",o.optDouble("total_cost",0)),18,true);t.setPadding(dp(14),dp(14),dp(14),dp(14));row.addView(t);content.addView(row);}}catch(Exception ignored){}});}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת היסטוריה נכשלה",Toast.LENGTH_LONG).show());}});}

    private void showReports(){buildShell("דוחות",this::showAdminHome,false);Button purchases=button("דוח קניות",blue,Color.WHITE);purchases.setOnClickListener(v->loadPurchaseReport());content.addView(purchases,new LinearLayout.LayoutParams(-1,dp(60)));Button inventory=button("היסטוריית התאמות מלאי",Color.WHITE,blue);inventory.setOnClickListener(v->loadInventoryReport());content.addView(inventory,new LinearLayout.LayoutParams(-1,dp(60)));}
    private void loadPurchaseReport(){io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_from",JSONObject.NULL);b.put("p_to",JSONObject.NULL);b.put("p_supplier_id",JSONObject.NULL);JSONArray a=requestArray("POST","/rest/v1/rpc/get_purchase_report",b,true);main.post(()->{content.removeAllViews();try{JSONObject d=a.length()>0?a.getJSONObject(0):new JSONObject();JSONObject s=d.optJSONObject("summary");if(s==null)s=new JSONObject();TextView t=text("סה״כ קניות: "+String.format(Locale.US,"%.2f ₪",s.optDouble("total_cost",0))+"\nמספר רכישות: "+s.optInt("purchase_count",0)+"\nיחידות: "+s.optInt("total_units",0),24,true);t.setPadding(dp(20),dp(20),dp(20),dp(20));content.addView(t);}catch(Exception ignored){}});}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת דוח נכשלה",Toast.LENGTH_LONG).show());}});}
    private void loadInventoryReport(){io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_limit",100);JSONArray a=requestArray("POST","/rest/v1/rpc/get_inventory_history",b,true);main.post(()->{content.removeAllViews();try{for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);TextView t=text(o.optString("product_name")+"   "+o.optInt("change_qty")+"   "+o.optString("reason"),18,true);t.setPadding(dp(12),dp(12),dp(12),dp(12));content.addView(t);}}catch(Exception ignored){}});}catch(Exception ignored){}});}

    private void updateCartButton(){if(cartButton==null)return;int n=0;for(int q:cart.values())n+=q;cartButton.setText("סל  "+n);}
    private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setBackground(roundRect(Color.WHITE,Color.rgb(225,230,238),1,18));v.setElevation(dp(3));v.setPadding(dp(4),dp(4),dp(4),dp(4));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(6),0,dp(6));v.setLayoutParams(lp);return v;}
    private GridLayout.LayoutParams gridParams(){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.height=dp(285);p.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);p.setMargins(dp(8),dp(8),dp(8),dp(8));return p;}
    private ImageView imageView(){ImageView i=new ImageView(this);i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setPadding(dp(12),dp(12),dp(12),dp(8));return i;}
    private void loadImage(String url,ImageView image){io.execute(()->{try(InputStream in=new URL(url).openStream()){Bitmap b=BitmapFactory.decodeStream(in);main.post(()->image.setImageBitmap(b));}catch(Exception ignored){}});}
    private TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(Color.rgb(27,39,59));t.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);if(bold)t.setTypeface(t.getTypeface(),1);return t;}
    private EditText input(String hint){EditText e=new EditText(this);e.setHint(hint);e.setTextSize(18);e.setSingleLine(true);e.setPadding(dp(16),0,dp(16),0);e.setBackground(roundRect(Color.WHITE,Color.rgb(200,208,220),1,14));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(58));p.setMargins(0,dp(6),0,dp(6));e.setLayoutParams(p);return e;}
    private Button button(String s,int bg,int fg){Button b=new Button(this);b.setText(s);b.setTextSize(16);b.setTextColor(fg);b.setAllCaps(false);b.setTypeface(b.getTypeface(),1);b.setBackground(roundRect(bg,bg,0,14));return b;}
    private android.graphics.drawable.GradientDrawable roundRect(int fill,int stroke,int strokeDp,int radius){android.graphics.drawable.GradientDrawable g=new android.graphics.drawable.GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));if(strokeDp>0)g.setStroke(dp(strokeDp),stroke);return g;}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}

    static class Category{String id,name,imageUrl,imageMode;Category(String i,String n,String u,String m){id=i;name=n;imageUrl=u;imageMode=m;}}
    static class Product{String id,categoryId,name,imageUrl;double price;int stock;Product(String i,String c,String n,double p,int s,String u){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;}}
    static class Supplier{String id,name,phone,email;Supplier(String i,String n,String p,String e){id=i;name=n;phone=p;email=e;}}
}

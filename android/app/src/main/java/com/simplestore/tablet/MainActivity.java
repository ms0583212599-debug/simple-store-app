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
import android.widget.Button;
import android.widget.EditText;
import android.widget.GridLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.ArrayAdapter;
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
import java.net.URLEncoder;
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
        LinearLayout root=new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        root.setBackgroundColor(Color.rgb(246,248,252));
        return root;
    }

    private void showLoading(){
        LinearLayout root=baseRoot();
        TextView t=text("טוען את החנות...",24,true);t.setGravity(Gravity.CENTER);t.setPadding(dp(20),dp(100),dp(20),dp(20));
        root.addView(t,new LinearLayout.LayoutParams(-1,-1));setContentView(root);
    }

    private void loadData(Runnable done){
        io.execute(()->{
            try{
                JSONArray cs=requestArray("GET","/rest/v1/categories?select=*&order=sort_order.asc",null,false);
                JSONArray ps=requestArray("GET","/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc",null,false);
                categories.clear();products.clear();
                for(int i=0;i<cs.length();i++){
                    JSONObject o=cs.getJSONObject(i);
                    categories.add(new Category(o.optString("id"),o.optString("name"),o.optString("image_url"),o.optString("image_mode"),o.optInt("sort_order",0)));
                }
                for(int i=0;i<ps.length();i++){
                    JSONObject o=ps.getJSONObject(i);
                    if(!o.optBoolean("is_active",true))continue;
                    products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3)));
                }
                main.post(done);
            }catch(Exception e){main.post(()->Toast.makeText(this,"שגיאה בטעינת החנות",Toast.LENGTH_LONG).show());}
        });
    }

    private String requestRaw(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(path.startsWith("http")?path:BASE+path).openConnection();
        c.setRequestMethod(method);c.setConnectTimeout(15000);c.setReadTimeout(15000);
        c.setRequestProperty("apikey",KEY);c.setRequestProperty("Content-Type","application/json");
        c.setRequestProperty("Authorization","Bearer "+(useAdmin&&!adminToken.isEmpty()?adminToken:KEY));
        if(body!=null){c.setDoOutput(true);byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);try(OutputStream out=c.getOutputStream()){out.write(bytes);}}
        int code=c.getResponseCode();InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
        BufferedReader r=new BufferedReader(new InputStreamReader(in));StringBuilder b=new StringBuilder();String line;while((line=r.readLine())!=null)b.append(line);r.close();
        if(code<200||code>=300)throw new Exception("HTTP "+code+": "+b);
        return b.toString();
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

    private void showHome(){
        polling=false;buildShell("מערכת מכירה",null,true);
        EditText search=input("חיפוש מוצר");content.addView(search,new LinearLayout.LayoutParams(-1,dp(64)));
        TextView h=text("בחר קטגוריה",28,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(24),0,dp(18));content.addView(h);
        GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(Category c:categories)grid.addView(categoryCard(c),gridParams());
        search.setOnEditorActionListener((v,a,e)->{String q=search.getText().toString().trim();if(!q.isEmpty())showSearch(q);return true;});
    }

    private View categoryCard(Category c){
        LinearLayout card=card();ImageView image=imageView();String img=c.imageUrl;
        if((img==null||img.isEmpty())||!"custom".equals(c.imageMode)){for(Product p:products)if(p.categoryId.equals(c.id)&&p.imageUrl!=null&&!p.imageUrl.isEmpty()){img=p.imageUrl;break;}}
        if(img!=null&&!img.isEmpty())loadImage(img,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(145)));
        TextView name=text(c.name,19,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(8),dp(12),dp(8),dp(14));card.addView(name);card.setOnClickListener(v->showCategory(c));return card;
    }

    private void showCategory(Category c){buildShell(c.name,this::showHome,true);GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));for(Product p:products)if(p.categoryId.equals(c.id))grid.addView(productCard(p),gridParams());}
    private void showSearch(String q){buildShell("תוצאות חיפוש",this::showHome,true);GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));String s=q.toLowerCase();for(Product p:products)if(p.name.toLowerCase().contains(s))grid.addView(productCard(p),gridParams());}

    private View productCard(Product p){
        LinearLayout card=card();ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));
        TextView n=text(p.name,18,true);n.setPadding(dp(10),dp(10),dp(10),0);card.addView(n);TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),22,true);price.setPadding(dp(10),dp(4),dp(10),0);card.addView(price);
        TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(10),dp(4),dp(10),dp(8));card.addView(stock);
        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",blue,Color.WHITE);add.setEnabled(p.stock>0);add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(50));ab.setMargins(dp(10),0,dp(10),dp(12));card.addView(add,ab);return card;
    }

    private void showCart(){
        buildShell("סל קניות",this::showHome,false);double total=0;int count=0;
        for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q==0)continue;count+=q;total+=q*p.price;LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView n=text(p.name+"  × "+q,19,true);row.addView(n,new LinearLayout.LayoutParams(0,dp(64),1));Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);showCart();});row.addView(minus,new LinearLayout.LayoutParams(dp(54),dp(48)));Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock)cart.put(p.id,x+1);showCart();});row.addView(plus,new LinearLayout.LayoutParams(dp(54),dp(48)));content.addView(row);}
        TextView t=text(String.format(Locale.US,"סה״כ: %.2f ₪",total),31,true);t.setGravity(Gravity.CENTER);t.setPadding(0,dp(22),0,dp(16));content.addView(t);Button pay=button("מעבר לתשלום",Color.rgb(22,163,74),Color.WHITE);pay.setEnabled(count>0);pay.setOnClickListener(v->startCheckout());content.addView(pay,new LinearLayout.LayoutParams(-1,dp(64)));
    }

    private void startCheckout(){
        if(cart.isEmpty())return;Toast.makeText(this,"מכין תשלום...",Toast.LENGTH_SHORT).show();io.execute(()->{try{JSONArray items=new JSONArray();for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;JSONObject x=new JSONObject();x.put("product_id",p.id);x.put("unit_price",p.price);x.put("quantity",q);items.put(x);}JSONObject body=new JSONObject();body.put("items",items);JSONObject r=new JSONObject(requestRaw("POST",CREATE,body,false));saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",0);if(saleToken.isEmpty()||saleTotal<=0)throw new Exception("Invalid checkout response");main.post(this::showPayment);}catch(Exception e){main.post(()->Toast.makeText(this,"לא ניתן להתחיל תשלום",Toast.LENGTH_LONG).show());}});
    }

    private void showPayment(){
        LinearLayout root=baseRoot();LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(22),dp(12),dp(22),dp(8));Button back=button("‹  חזור",Color.WHITE,blue);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(130),dp(52)));TextView title=text("תשלום",24,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));root.addView(top);
        paymentStatus=text(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal),25,true);paymentStatus.setGravity(Gravity.CENTER);paymentStatus.setPadding(dp(10),dp(8),dp(10),dp(12));root.addView(paymentStatus);
        paymentWebView=new WebView(this);WebSettings s=paymentWebView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");root.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));
        chargeButton=button("בצע תשלום",Color.rgb(22,163,74),Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(64));cp.setMargins(dp(26),dp(10),dp(26),dp(18));root.addView(chargeButton,cp);setContentView(root);
        String html="<!doctype html><html dir='rtl'><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>html,body{margin:0;background:#f6f8fc;height:100%}iframe{border:0;width:100%;height:100%;min-height:430px}</style></head><body><iframe id='frame' src='https://www.matara.pro/nedarimplus/iframe/?Picture=Hide'></iframe><script>function p(d){document.getElementById('frame').contentWindow.postMessage(d,'*')}window.addEventListener('message',function(e){var d=e.data;if(!d||!d.Name)return;if(d.Name==='Height')document.getElementById('frame').style.height=(parseInt(d.Value||430)+15)+'px';if(d.Name==='TransactionResponse')Android.onTransaction(JSON.stringify(d.Value||{}));});document.getElementById('frame').onload=function(){p({Name:'GetHeight'})};</script></body></html>";paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

    private void chargeCard(){if(paymentWebView==null||saleToken.isEmpty())return;chargeButton.setEnabled(false);paymentStatus.setText("מבצע תשלום...");String js="p({Name:'FinishTransaction2',Value:{Mosad:'"+MOSAD+"',ApiValid:'"+APIVALID+"',PaymentType:'Ragil',Currency:'1',Amount:'"+String.format(Locale.US,"%.2f",saleTotal)+"',Tashlumim:'1',Param1:'"+saleToken+"',CallBack:'"+CALLBACK+"'}})";paymentWebView.evaluateJavascript(js,null);}

    public class PaymentBridge{
        @JavascriptInterface public void onTransaction(String json){main.post(()->{try{JSONObject d=new JSONObject(json);if("Error".equalsIgnoreCase(d.optString("Status"))){paymentStatus.setText(d.optString("Message","שגיאה בתשלום"));chargeButton.setEnabled(true);}else{paymentStatus.setText("התשלום נקלט, ממתין לאישור...");polling=true;pollSale();}}catch(Exception e){paymentStatus.setText("לא התקבלה תשובת תשלום תקינה");chargeButton.setEnabled(true);}});}
    }
    private void pollSale(){if(!polling)return;io.execute(()->{try{JSONObject body=new JSONObject();body.put("p_token",saleToken);JSONArray a=requestArray("POST","/rest/v1/rpc/get_sale_status",body,false);JSONObject row=a.length()>0?a.getJSONObject(0):null;if(row!=null&&"paid".equals(row.optString("status"))){polling=false;cart.clear();loadData(()->{Toast.makeText(this,"✓ התשלום בוצע והמלאי עודכן",Toast.LENGTH_LONG).show();showHome();});return;}}catch(Exception ignored){}main.postDelayed(this::pollSale,2000);});}

    private void openAdmin(){if(adminToken.isEmpty())showAdminLogin();else showAdminHome();}
    private void showAdminLogin(){
        buildShell("כניסת מנהל",this::showHome,false);TextView info=text("הזן את סיסמת הניהול",22,true);info.setGravity(Gravity.CENTER);info.setPadding(0,dp(35),0,dp(20));content.addView(info);EditText password=input("סיסמה");password.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);content.addView(password,new LinearLayout.LayoutParams(-1,dp(64)));Button login=button("כניסה",blue,Color.WHITE);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,dp(62));lp.setMargins(0,dp(16),0,0);content.addView(login,lp);login.setOnClickListener(v->adminLogin(password.getText().toString()));
    }
    private void adminLogin(String password){if(password.isEmpty())return;Toast.makeText(this,"מתחבר...",Toast.LENGTH_SHORT).show();io.execute(()->{try{JSONObject body=new JSONObject();body.put("email",ADMIN_EMAIL);body.put("password",password);JSONObject r=new JSONObject(requestRaw("POST","/auth/v1/token?grant_type=password",body,false));adminToken=r.optString("access_token");String userId=r.optJSONObject("user")!=null?r.optJSONObject("user").optString("id"):"";if(adminToken.isEmpty()||userId.isEmpty())throw new Exception("login");JSONArray adm=requestArray("GET","/rest/v1/store_admins?user_id=eq."+URLEncoder.encode(userId,"UTF-8")+"&select=user_id",null,true);if(adm.length()==0){adminToken="";throw new Exception("permission");}main.post(this::showAdminHome);}catch(Exception e){adminToken="";main.post(()->Toast.makeText(this,"סיסמה שגויה",Toast.LENGTH_LONG).show());}});}

    private void showAdminHome(){
        buildShell("ניהול",this::showHome,false);TextView h=text("ניהול החנות",28,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(10),0,dp(20));content.addView(h);
        Button productsBtn=button("מוצרים ומחירים",blue,Color.WHITE);productsBtn.setOnClickListener(v->showAdminProducts());content.addView(productsBtn,new LinearLayout.LayoutParams(-1,dp(64)));
        Button categoriesBtn=button("קטגוריות",Color.rgb(51,65,85),Color.WHITE);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(64));p.setMargins(0,dp(12),0,0);categoriesBtn.setOnClickListener(v->showAdminCategories());content.addView(categoriesBtn,p);
        Button stockBtn=button("התאמת מלאי",Color.rgb(22,163,74),Color.WHITE);LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,dp(64));sp.setMargins(0,dp(12),0,0);stockBtn.setOnClickListener(v->showStockAdjust());content.addView(stockBtn,sp);
        Button logout=button("יציאה מניהול",Color.rgb(220,38,38),Color.WHITE);LinearLayout.LayoutParams lo=new LinearLayout.LayoutParams(-1,dp(58));lo.setMargins(0,dp(30),0,0);logout.setOnClickListener(v->{adminToken="";showHome();});content.addView(logout,lo);
    }

    private void showAdminProducts(){
        buildShell("מוצרים",this::showAdminHome,false);Button add=button("+ מוצר חדש",Color.rgb(22,163,74),Color.WHITE);add.setOnClickListener(v->showProductDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(60)));
        for(Product p:products){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView info=text(p.name+"\n"+String.format(Locale.US,"%.2f ₪",p.price)+"  | מלאי "+p.stock,17,true);row.addView(info,new LinearLayout.LayoutParams(0,dp(76),1));Button edit=button("עריכה",blue,Color.WHITE);edit.setOnClickListener(v->showProductDialog(p));row.addView(edit,new LinearLayout.LayoutParams(dp(120),dp(52)));LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.setMargins(0,dp(8),0,0);content.addView(row,rp);}
    }

    private void showProductDialog(Product existing){
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(26),dp(8),dp(26),0);box.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        EditText name=input("שם מוצר");EditText price=input("מחיר מכירה");price.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText stock=input("מלאי");stock.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_SIGNED);EditText low=input("התראת מלאי");low.setInputType(InputType.TYPE_CLASS_NUMBER);
        Spinner cat=new Spinner(this);List<String> names=new ArrayList<>();for(Category c:categories)names.add(c.name);cat.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));
        box.addView(name,new LinearLayout.LayoutParams(-1,dp(58)));box.addView(cat,new LinearLayout.LayoutParams(-1,dp(58)));box.addView(price,new LinearLayout.LayoutParams(-1,dp(58)));box.addView(stock,new LinearLayout.LayoutParams(-1,dp(58)));box.addView(low,new LinearLayout.LayoutParams(-1,dp(58)));
        if(existing!=null){name.setText(existing.name);price.setText(String.valueOf(existing.price));stock.setText(String.valueOf(existing.stock));low.setText(String.valueOf(existing.lowStock));for(int i=0;i<categories.size();i++)if(categories.get(i).id.equals(existing.categoryId))cat.setSelection(i);}
        AlertDialog d=new AlertDialog.Builder(this).setTitle(existing==null?"מוצר חדש":"עריכת מוצר").setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",null).create();d.setOnShowListener(x->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String n=name.getText().toString().trim();if(n.isEmpty()||categories.isEmpty())return;double pr=parseDouble(price.getText().toString());int st=parseInt(stock.getText().toString());int lw=Math.max(0,parseInt(low.getText().toString()));Category c=categories.get(cat.getSelectedItemPosition());saveProduct(existing,n,c.id,pr,st,lw,d);}));d.show();
    }

    private void saveProduct(Product existing,String name,String categoryId,double price,int stock,int low,AlertDialog dialog){
        io.execute(()->{try{JSONObject body=new JSONObject();body.put("name",name);body.put("category_id",categoryId);body.put("price",price);body.put("stock_quantity",stock);body.put("low_stock_threshold",low);body.put("is_active",true);if(existing==null){int next=1;for(Product p:products)if(p.categoryId.equals(categoryId))next++;body.put("sort_order",next);body.put("image_url","");body.put("image_path","");requestRaw("POST","/rest/v1/products",body,true);}else requestRaw("PATCH","/rest/v1/products?id=eq."+existing.id,body,true);main.post(()->{dialog.dismiss();loadData(this::showAdminProducts);});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת המוצר נכשלה",Toast.LENGTH_LONG).show());}});
    }

    private void showAdminCategories(){
        buildShell("קטגוריות",this::showAdminHome,false);Button add=button("+ קטגוריה חדשה",Color.rgb(22,163,74),Color.WHITE);add.setOnClickListener(v->showCategoryDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(60)));
        for(Category c:categories){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView name=text(c.name,19,true);row.addView(name,new LinearLayout.LayoutParams(0,dp(68),1));Button edit=button("עריכה",blue,Color.WHITE);edit.setOnClickListener(v->showCategoryDialog(c));row.addView(edit,new LinearLayout.LayoutParams(dp(120),dp(50)));LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(-1,-2);rp.setMargins(0,dp(8),0,0);content.addView(row,rp);}
    }
    private void showCategoryDialog(Category existing){
        EditText name=input("שם קטגוריה");if(existing!=null)name.setText(existing.name);AlertDialog d=new AlertDialog.Builder(this).setTitle(existing==null?"קטגוריה חדשה":"עריכת קטגוריה").setView(name).setNegativeButton("ביטול",null).setPositiveButton("שמור",null).create();d.setOnShowListener(x->d.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String n=name.getText().toString().trim();if(n.isEmpty())return;io.execute(()->{try{JSONObject b=new JSONObject();b.put("name",n);if(existing==null){b.put("sort_order",categories.size()+1);b.put("image_mode","products");b.put("image_url","");requestRaw("POST","/rest/v1/categories",b,true);}else requestRaw("PATCH","/rest/v1/categories?id=eq."+existing.id,b,true);main.post(()->{d.dismiss();loadData(this::showAdminCategories);});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת הקטגוריה נכשלה",Toast.LENGTH_LONG).show());}});}));d.show();
    }

    private void showStockAdjust(){
        buildShell("התאמת מלאי",this::showAdminHome,false);List<String> productNames=new ArrayList<>();for(Product p:products)productNames.add(p.name+" ("+p.stock+")");Spinner product=new Spinner(this);product.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,productNames));content.addView(product,new LinearLayout.LayoutParams(-1,dp(62)));EditText qty=input("שינוי כמות, לדוגמה 5 או ‎-2");qty.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_SIGNED);LinearLayout.LayoutParams qp=new LinearLayout.LayoutParams(-1,dp(64));qp.setMargins(0,dp(12),0,0);content.addView(qty,qp);EditText note=input("הערה");LinearLayout.LayoutParams np=new LinearLayout.LayoutParams(-1,dp(64));np.setMargins(0,dp(12),0,0);content.addView(note,np);Button save=button("עדכן מלאי",Color.rgb(22,163,74),Color.WHITE);LinearLayout.LayoutParams sv=new LinearLayout.LayoutParams(-1,dp(62));sv.setMargins(0,dp(16),0,0);content.addView(save,sv);save.setOnClickListener(v->{if(products.isEmpty())return;int change=parseInt(qty.getText().toString());if(change==0){Toast.makeText(this,"הזן שינוי כמות",Toast.LENGTH_SHORT).show();return;}Product p=products.get(product.getSelectedItemPosition());adjustStock(p,change,note.getText().toString().trim());});
    }
    private void adjustStock(Product p,int change,String note){io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_product_id",p.id);b.put("p_change_qty",change);b.put("p_reason","manual");if(note.isEmpty())b.put("p_note",JSONObject.NULL);else b.put("p_note",note);requestRaw("POST","/rest/v1/rpc/adjust_stock",b,true);main.post(()->loadData(this::showStockAdjust));}catch(Exception e){main.post(()->Toast.makeText(this,"עדכון המלאי נכשל",Toast.LENGTH_LONG).show());}});}

    private void updateCartButton(){if(cartButton==null)return;int n=0;for(int q:cart.values())n+=q;cartButton.setText("סל  "+n);}
    private EditText input(String hint){EditText e=new EditText(this);e.setHint(hint);e.setTextSize(18);e.setSingleLine(true);e.setPadding(dp(18),0,dp(18),0);e.setBackground(roundRect(Color.WHITE,Color.rgb(190,200,215),1,14));return e;}
    private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setBackground(roundRect(Color.WHITE,Color.rgb(225,230,238),1,18));v.setElevation(dp(3));v.setPadding(dp(10),dp(8),dp(10),dp(8));return v;}
    private GridLayout.LayoutParams gridParams(){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.height=dp(285);p.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);p.setMargins(dp(8),dp(8),dp(8),dp(8));return p;}
    private ImageView imageView(){ImageView i=new ImageView(this);i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setPadding(dp(12),dp(12),dp(12),dp(8));return i;}
    private void loadImage(String url,ImageView image){io.execute(()->{try(InputStream in=new URL(url).openStream()){Bitmap b=BitmapFactory.decodeStream(in);main.post(()->image.setImageBitmap(b));}catch(Exception ignored){}});}
    private TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(Color.rgb(27,39,59));t.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);if(bold)t.setTypeface(t.getTypeface(),1);return t;}
    private Button button(String s,int bg,int fg){Button b=new Button(this);b.setText(s);b.setTextSize(16);b.setTextColor(fg);b.setAllCaps(false);b.setTypeface(b.getTypeface(),1);b.setBackground(roundRect(bg,bg,0,14));return b;}
    private android.graphics.drawable.GradientDrawable roundRect(int fill,int stroke,int strokeDp,int radius){android.graphics.drawable.GradientDrawable g=new android.graphics.drawable.GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));if(strokeDp>0)g.setStroke(dp(strokeDp),stroke);return g;}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
    private int parseInt(String s){try{return Integer.parseInt(s.trim());}catch(Exception e){return 0;}}
    private double parseDouble(String s){try{return Double.parseDouble(s.trim());}catch(Exception e){return 0;}}

    static class Category{String id,name,imageUrl,imageMode;int sort;Category(String i,String n,String u,String m,int s){id=i;name=n;imageUrl=u;imageMode=m;sort=s;}}
    static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock;Product(String i,String c,String n,double p,int s,String u,int l){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;}}
}

package com.simplestore.tablet;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String BASE = "https://ksddrcalmszxxcuxoznd.supabase.co";
    private static final String KEY = "sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR";
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
    private boolean polling = false;
    private final int blue = Color.rgb(34,91,203);

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        showLoading();
        loadData();
    }

    private void showLoading(){
        LinearLayout root = baseRoot();
        TextView t = text("טוען את החנות...",24,true); t.setGravity(Gravity.CENTER); t.setPadding(20,100,20,20);
        root.addView(t,new LinearLayout.LayoutParams(-1,-1));
        setContentView(root);
    }

    private LinearLayout baseRoot(){
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL); root.setBackgroundColor(Color.rgb(246,248,252));
        return root;
    }

    private void loadData(){
        io.execute(() -> {
            try{
                JSONArray cs=get("/rest/v1/categories?select=*&order=sort_order.asc");
                JSONArray ps=get("/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc");
                categories.clear(); products.clear();
                for(int i=0;i<cs.length();i++){JSONObject o=cs.getJSONObject(i); categories.add(new Category(o.optString("id"),o.optString("name"),o.optString("image_url"),o.optString("image_mode")));}
                for(int i=0;i<ps.length();i++){JSONObject o=ps.getJSONObject(i); if(!o.optBoolean("is_active",true))continue; products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url")));}
                main.post(this::showHome);
            }catch(Exception e){main.post(()->{Toast.makeText(this,"שגיאה בטעינת החנות",Toast.LENGTH_LONG).show(); showLoading();});}
        });
    }

    private JSONArray get(String path)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(BASE+path).openConnection(); c.setRequestProperty("apikey",KEY); c.setRequestProperty("Authorization","Bearer "+KEY); c.setConnectTimeout(12000); c.setReadTimeout(12000);
        BufferedReader r=new BufferedReader(new InputStreamReader(c.getInputStream())); StringBuilder b=new StringBuilder(); String line; while((line=r.readLine())!=null)b.append(line); r.close(); return new JSONArray(b.toString());
    }

    private String post(String url, JSONObject body, boolean auth)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(url).openConnection();
        c.setRequestMethod("POST"); c.setDoOutput(true); c.setConnectTimeout(15000); c.setReadTimeout(15000);
        c.setRequestProperty("apikey",KEY); c.setRequestProperty("Content-Type","application/json");
        if(auth)c.setRequestProperty("Authorization","Bearer "+KEY);
        byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
        try(OutputStream out=c.getOutputStream()){out.write(bytes);}
        int code=c.getResponseCode(); InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
        BufferedReader r=new BufferedReader(new InputStreamReader(in)); StringBuilder b=new StringBuilder(); String line; while((line=r.readLine())!=null)b.append(line); r.close();
        if(code<200||code>=300)throw new Exception("HTTP "+code+": "+b);
        return b.toString();
    }

    private void buildShell(String title, Runnable back){
        LinearLayout root=baseRoot();
        LinearLayout top=new LinearLayout(this); top.setGravity(Gravity.CENTER_VERTICAL); top.setPadding(dp(22),dp(14),dp(22),dp(10));
        if(back!=null){Button b=button("‹  חזור",Color.WHITE,blue); b.setOnClickListener(v->back.run()); top.addView(b,new LinearLayout.LayoutParams(dp(130),dp(52)));}
        TextView brand=text(title,22,true); brand.setGravity(Gravity.CENTER); LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(0,dp(52),1); top.addView(brand,bp);
        cartButton=button("סל  0",blue,Color.WHITE); cartButton.setOnClickListener(v->showCart()); top.addView(cartButton,new LinearLayout.LayoutParams(dp(150),dp(52)));
        root.addView(top);
        ScrollView scroll=new ScrollView(this); content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); content.setPadding(dp(26),dp(10),dp(26),dp(110)); scroll.addView(content); root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root); updateCartButton();
    }

    private void showHome(){
        polling=false;
        buildShell("מערכת מכירה",null);
        EditText search=new EditText(this); search.setHint("חיפוש מוצר"); search.setTextSize(19); search.setSingleLine(true); search.setPadding(dp(20),0,dp(20),0); search.setBackground(roundRect(Color.WHITE,blue,2,18));
        content.addView(search,new LinearLayout.LayoutParams(-1,dp(64)));
        TextView h=text("בחר קטגוריה",28,true); h.setGravity(Gravity.CENTER); h.setPadding(0,dp(24),0,dp(18)); content.addView(h);
        GridLayout grid=new GridLayout(this); grid.setColumnCount(3); grid.setUseDefaultMargins(true); content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(Category c:categories)grid.addView(categoryCard(c),gridParams());
        search.setOnEditorActionListener((v,a,e)->{String q=search.getText().toString().trim(); if(!q.isEmpty())showSearch(q); return true;});
    }

    private View categoryCard(Category c){
        LinearLayout card=card();
        ImageView image=imageView(); String img=c.imageUrl; if((img==null||img.isEmpty())||!"custom".equals(c.imageMode)){for(Product p:products)if(p.categoryId.equals(c.id)&&p.imageUrl!=null&&!p.imageUrl.isEmpty()){img=p.imageUrl;break;}}
        if(img!=null&&!img.isEmpty())loadImage(img,image);
        card.addView(image,new LinearLayout.LayoutParams(-1,dp(145)));
        TextView name=text(c.name,19,true); name.setGravity(Gravity.CENTER); name.setPadding(dp(8),dp(12),dp(8),dp(14)); card.addView(name);
        card.setOnClickListener(v->showCategory(c)); return card;
    }

    private void showCategory(Category c){
        buildShell(c.name,this::showHome); GridLayout grid=new GridLayout(this); grid.setColumnCount(3); grid.setUseDefaultMargins(true); content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(Product p:products)if(p.categoryId.equals(c.id))grid.addView(productCard(p),gridParams());
    }

    private void showSearch(String q){
        buildShell("תוצאות חיפוש",this::showHome); GridLayout grid=new GridLayout(this); grid.setColumnCount(3); grid.setUseDefaultMargins(true); content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        String s=q.toLowerCase(); for(Product p:products)if(p.name.toLowerCase().contains(s))grid.addView(productCard(p),gridParams());
    }

    private View productCard(Product p){
        LinearLayout card=card(); ImageView image=imageView(); if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image); card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));
        TextView n=text(p.name,18,true); n.setPadding(dp(10),dp(10),dp(10),0); card.addView(n);
        TextView price=text(String.format("%.2f ₪",p.price),22,true); price.setTextColor(Color.rgb(22,34,54)); price.setPadding(dp(10),dp(4),dp(10),0); card.addView(price);
        TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true); stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED); stock.setPadding(dp(10),dp(4),dp(10),dp(8)); card.addView(stock);
        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",blue,Color.WHITE); add.setEnabled(p.stock>0); add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0); if(now<p.stock){cart.put(p.id,now+1); updateCartButton(); Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}}); LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(50)); ab.setMargins(dp(10),0,dp(10),dp(12)); card.addView(add,ab); return card;
    }

    private void showCart(){
        buildShell("סל קניות",this::showHome); double total=0; int count=0;
        for(Product p:products){int q=cart.getOrDefault(p.id,0); if(q==0)continue; count+=q; total+=q*p.price; LinearLayout row=card(); row.setOrientation(LinearLayout.HORIZONTAL); row.setGravity(Gravity.CENTER_VERTICAL); TextView n=text(p.name+"  × "+q,19,true); row.addView(n,new LinearLayout.LayoutParams(0,dp(64),1)); Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY); minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);showCart();}); row.addView(minus,new LinearLayout.LayoutParams(dp(54),dp(48))); Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY); plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock)cart.put(p.id,x+1);showCart();}); row.addView(plus,new LinearLayout.LayoutParams(dp(54),dp(48))); content.addView(row);}
        TextView t=text(String.format("סה״כ: %.2f ₪",total),31,true); t.setGravity(Gravity.CENTER); t.setPadding(0,dp(22),0,dp(16)); content.addView(t);
        Button pay=button("מעבר לתשלום",Color.rgb(22,163,74),Color.WHITE); pay.setEnabled(count>0); pay.setOnClickListener(v->startCheckout()); content.addView(pay,new LinearLayout.LayoutParams(-1,dp(64)));
    }

    private void startCheckout(){
        if(cart.isEmpty())return;
        Toast.makeText(this,"מכין תשלום...",Toast.LENGTH_SHORT).show();
        io.execute(()->{
            try{
                JSONArray items=new JSONArray();
                for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;JSONObject x=new JSONObject();x.put("product_id",p.id);x.put("unit_price",p.price);x.put("quantity",q);items.put(x);}
                JSONObject body=new JSONObject();body.put("items",items);
                JSONObject r=new JSONObject(post(CREATE,body,false));
                saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",0);
                if(saleToken.isEmpty()||saleTotal<=0)throw new Exception("Invalid checkout response");
                main.post(this::showPayment);
            }catch(Exception e){main.post(()->Toast.makeText(this,"לא ניתן להתחיל תשלום",Toast.LENGTH_LONG).show());}
        });
    }

    private void showPayment(){
        LinearLayout root=baseRoot();
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(22),dp(12),dp(22),dp(8));
        Button back=button("‹  חזור",Color.WHITE,blue);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(130),dp(52)));
        TextView title=text("תשלום",24,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));
        root.addView(top);
        paymentStatus=text(String.format("לתשלום: %.2f ₪",saleTotal),25,true);paymentStatus.setGravity(Gravity.CENTER);paymentStatus.setPadding(dp(10),dp(8),dp(10),dp(12));root.addView(paymentStatus);
        paymentWebView=new WebView(this);WebSettings s=paymentWebView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");
        root.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));
        chargeButton=button("בצע תשלום",Color.rgb(22,163,74),Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(-1,dp(64));cp.setMargins(dp(26),dp(10),dp(26),dp(18));root.addView(chargeButton,cp);
        setContentView(root);
        String html="<!doctype html><html dir='rtl'><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>html,body{margin:0;background:#f6f8fc;height:100%;}iframe{border:0;width:100%;height:100%;min-height:430px}</style></head><body><iframe id='frame' src='https://www.matara.pro/nedarimplus/iframe/?Picture=Hide'></iframe><script>function p(d){document.getElementById('frame').contentWindow.postMessage(d,'*')}window.addEventListener('message',function(e){var d=e.data;if(!d||!d.Name)return;if(d.Name==='Height'){document.getElementById('frame').style.height=(parseInt(d.Value||430)+15)+'px'}if(d.Name==='TransactionResponse'){Android.onTransaction(JSON.stringify(d.Value||{}));}});document.getElementById('frame').onload=function(){p({Name:'GetHeight'})};</script></body></html>";
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

    private void chargeCard(){
        if(paymentWebView==null||saleToken.isEmpty())return;
        chargeButton.setEnabled(false);paymentStatus.setText("מבצע תשלום...");
        String js="p({Name:'FinishTransaction2',Value:{Mosad:'"+MOSAD+"',ApiValid:'"+APIVALID+"',PaymentType:'Ragil',Currency:'1',Amount:'"+String.format(java.util.Locale.US,"%.2f",saleTotal)+"',Tashlumim:'1',Param1:'"+saleToken+"',CallBack:'"+CALLBACK+"'}})";
        paymentWebView.evaluateJavascript(js,null);
        main.postDelayed(()->{if(chargeButton!=null)chargeButton.setEnabled(true);},5000);
    }

    public class PaymentBridge{
        @JavascriptInterface public void onTransaction(String json){
            main.post(()->{
                try{
                    JSONObject v=new JSONObject(json);
                    if("Error".equalsIgnoreCase(v.optString("Status"))){paymentStatus.setText(v.optString("Message","שגיאה בתשלום"));chargeButton.setEnabled(true);return;}
                    paymentStatus.setText("התשלום נקלט, מאמת... ");chargeButton.setEnabled(false);startPoll();
                }catch(Exception e){paymentStatus.setText("התשלום נקלט, מאמת...");startPoll();}
            });
        }
    }

    private void startPoll(){
        if(polling)return;polling=true;checkSaleStatus(0);
    }

    private void checkSaleStatus(int attempt){
        if(!polling)return;
        io.execute(()->{
            try{
                JSONObject body=new JSONObject();body.put("p_token",saleToken);
                String raw=post(BASE+"/rest/v1/rpc/get_sale_status",body,true);
                JSONArray a=new JSONArray(raw);JSONObject row=a.length()>0?a.getJSONObject(0):new JSONObject();
                if("paid".equalsIgnoreCase(row.optString("status"))){
                    polling=false;
                    main.post(()->{paymentStatus.setText("✓ התשלום בוצע והמלאי עודכן");chargeButton.setText("סיום וחזרה לחנות");chargeButton.setEnabled(true);chargeButton.setOnClickListener(v->finishPaidSale());});
                    loadDataQuiet();return;
                }
            }catch(Exception ignored){}
            if(attempt<90)main.postDelayed(()->checkSaleStatus(attempt+1),2000);else{polling=false;main.post(()->{paymentStatus.setText("התשלום עדיין בבדיקה. ניתן לנסות שוב בעוד רגע.");chargeButton.setEnabled(true);});}
        });
    }

    private void loadDataQuiet(){
        io.execute(()->{try{JSONArray ps=get("/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc");products.clear();for(int i=0;i<ps.length();i++){JSONObject o=ps.getJSONObject(i);if(!o.optBoolean("is_active",true))continue;products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url")));}}catch(Exception ignored){}});
    }

    private void finishPaidSale(){cart.clear();saleToken="";saleTotal=0;showHome();}

    private void updateCartButton(){if(cartButton==null)return;int n=0;for(int q:cart.values())n+=q;cartButton.setText("סל  "+n);}
    private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setBackground(roundRect(Color.WHITE,Color.rgb(225,230,238),1,18));v.setElevation(dp(3));v.setPadding(dp(4),dp(4),dp(4),dp(4));return v;}
    private GridLayout.LayoutParams gridParams(){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.height=dp(285);p.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);p.setMargins(dp(8),dp(8),dp(8),dp(8));return p;}
    private ImageView imageView(){ImageView i=new ImageView(this);i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setPadding(dp(12),dp(12),dp(12),dp(8));return i;}
    private void loadImage(String url,ImageView image){io.execute(()->{try(InputStream in=new URL(url).openStream()){Bitmap b=BitmapFactory.decodeStream(in);main.post(()->image.setImageBitmap(b));}catch(Exception ignored){}});}
    private TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(Color.rgb(27,39,59));t.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);if(bold)t.setTypeface(t.getTypeface(),1);return t;}
    private Button button(String s,int bg,int fg){Button b=new Button(this);b.setText(s);b.setTextSize(16);b.setTextColor(fg);b.setAllCaps(false);b.setTypeface(b.getTypeface(),1);b.setBackground(roundRect(bg,bg,0,14));return b;}
    private android.graphics.drawable.GradientDrawable roundRect(int fill,int stroke,int strokeDp,int radius){android.graphics.drawable.GradientDrawable g=new android.graphics.drawable.GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));if(strokeDp>0)g.setStroke(dp(strokeDp),stroke);return g;}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}
    static class Category{String id,name,imageUrl,imageMode;Category(String i,String n,String u,String m){id=i;name=n;imageUrl=u;imageMode=m;}}
    static class Product{String id,categoryId,name,imageUrl;double price;int stock;Product(String i,String c,String n,double p,int s,String u){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;}}
}

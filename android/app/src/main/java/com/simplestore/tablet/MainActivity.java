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
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
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
    private String adminUserId = "";
    private String paymentMosad = "7014693";
    private String paymentApiValid = "vbnioH8OQd";
    private String paymentGroupe = "";
    private OfflineStore offline;
    private volatile boolean syncPromptVisible = false;
    private final Map<String,EditText> inventoryCountInputs = new HashMap<>();
    private final int blue = Color.rgb(34,91,203);
    private final int green = Color.rgb(22,163,74);
    private final int red = Color.rgb(220,38,38);

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        offline = new OfflineStore(this);
        android.content.SharedPreferences auth=getSharedPreferences("simple_store_auth",MODE_PRIVATE);
        adminToken=auth.getString("token","");
        adminUserId=auth.getString("user_id","");
        offline.watchConnection(()->main.post(this::offerPendingSync));
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
        TextView t=text("טוען את החנות...",24,true);
        t.setGravity(Gravity.CENTER);
        t.setPadding(dp(20),dp(100),dp(20),dp(20));
        root.addView(t,new LinearLayout.LayoutParams(-1,-1));
        setContentView(root);
    }

    private void loadData(Runnable done){
        io.execute(()->{
            JSONArray cs=null,ps=null;boolean cached=false;
            try{
                if(!offline.isOnline())throw new Exception("offline");
                cs=requestArray("GET","/rest/v1/categories?select=*&order=sort_order.asc",null,false);
                ps=requestArray("GET","/rest/v1/products?select=*&order=category_id.asc,sort_order.asc,created_at.asc",null,false);
                try{JSONArray pay=requestArray("POST","/rest/v1/rpc/get_payment_settings_public",new JSONObject(),false);if(pay.length()>0){JSONObject x=pay.getJSONObject(0);paymentMosad=x.optString("mosad",paymentMosad);paymentApiValid=x.optString("api_valid",paymentApiValid);paymentGroupe=x.optString("groupe","");}}catch(Exception ignored){}
                offline.saveCatalog(cs,ps);
            }catch(Exception networkError){
                cs=offline.categories();ps=offline.products();cached=true;
            }
            try{
                if(cs.length()==0&&ps.length()==0)throw new Exception("אין עדיין נתונים שמורים במכשיר");
                parseCatalog(cs,ps);
                boolean usedCache=cached;
                main.post(()->{if(usedCache)Toast.makeText(this,"עובד ללא אינטרנט · השינויים יישמרו במכשיר",Toast.LENGTH_LONG).show();done.run();});
            }catch(Exception e){main.post(()->Toast.makeText(this,"שגיאה בטעינת החנות: "+safeMsg(e),Toast.LENGTH_LONG).show());}
        });
    }

    private void parseCatalog(JSONArray cs,JSONArray ps)throws Exception{
        categories.clear();products.clear();
        for(int i=0;i<cs.length();i++){JSONObject o=cs.getJSONObject(i);categories.add(new Category(o.optString("id"),o.optString("name"),o.optString("image_url"),o.optString("image_mode"),o.optInt("sort_order",0)));}
        for(int i=0;i<ps.length();i++){JSONObject o=ps.getJSONObject(i);if(!o.optBoolean("is_active",true))continue;products.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0)));}
    }

    private String requestOrQueue(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        if(!"GET".equals(method)&&!offline.isOnline()){
            JSONObject saved=offline.enqueue(method,path,body,useAdmin);
            main.post(()->Toast.makeText(this,"נשמר במכשיר · ממתין לסנכרון",Toast.LENGTH_LONG).show());
            return saved.toString();
        }
        return requestRaw(method,path,body,useAdmin);
    }

    private void offerPendingSync(){
        if(offline==null||!offline.isOnline()||offline.pendingCount()==0||syncPromptVisible)return;
        syncPromptVisible=true;
        int count=offline.pendingCount();
        new AlertDialog.Builder(this).setTitle("האינטרנט חזר")
                .setMessage("נמצאו "+count+" שינויים שנשמרו במכשיר. להעלות אותם לענן עכשיו?")
                .setNegativeButton("לא עכשיו",(d,w)->syncPromptVisible=false)
                .setPositiveButton("סנכרן עכשיו",(d,w)->{syncPromptVisible=false;syncPendingOperations();}).show();
    }

    private void syncPendingOperations(){
        io.execute(()->{
            JSONArray queue=offline.pending(),remaining=new JSONArray();int completed=0;
            for(int i=0;i<queue.length();i++){
                JSONObject op=queue.optJSONObject(i);if(op==null)continue;
                try{
                    requestRaw(op.optString("method"),op.optString("path"),op.optJSONObject("body"),op.optBoolean("admin",true));
                    completed++;
                }catch(Exception e){
                    for(int j=i;j<queue.length();j++)remaining.put(queue.opt(j));
                    break;
                }
            }
            offline.replacePending(remaining);
            int synced=completed,left=remaining.length();
            main.post(()->loadData(()->{
                Toast.makeText(this,left==0?"הסנכרון הושלם: "+synced+" שינויים הועלו":"הועלו "+synced+" שינויים, "+left+" עדיין ממתינים",Toast.LENGTH_LONG).show();
                showAdminHome();
            }));
        });
    }

    private String requestRaw(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        HttpURLConnection c=(HttpURLConnection)new URL(path.startsWith("http")?path:BASE+path).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(15000);c.setReadTimeout(15000);
        c.setRequestProperty("apikey",KEY);
        c.setRequestProperty("Content-Type","application/json");
        c.setRequestProperty("Authorization","Bearer "+(useAdmin&&!adminToken.isEmpty()?adminToken:KEY));
        if(body!=null){
            c.setDoOutput(true);
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            try(OutputStream out=c.getOutputStream()){out.write(bytes);}
        }
        int code=c.getResponseCode();
        InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();
        BufferedReader r=new BufferedReader(new InputStreamReader(in));
        StringBuilder b=new StringBuilder();String line;
        while((line=r.readLine())!=null)b.append(line);
        r.close();
        if(code<200||code>=300)throw new Exception("HTTP "+code+": "+b);
        return b.toString();
    }

    private JSONArray requestArray(String method,String path,JSONObject body,boolean useAdmin)throws Exception{
        String s=requestRaw(method,path,body,useAdmin);
        return s==null||s.isEmpty()?new JSONArray():new JSONArray(s);
    }

    private void buildShell(String title,Runnable back,boolean adminButton){
        LinearLayout root=baseRoot();
        int pending=offline==null?0:offline.pendingCount();
        if((offline!=null&&!offline.isOnline())||pending>0){
            String status=!offline.isOnline()?"אין אינטרנט":"מחובר";
            if(pending>0)status+=" · "+pending+" שינויים ממתינים לסנכרון";
            TextView offlineStatus=text(status,14,true);offlineStatus.setTextColor(pending>0?red:blue);offlineStatus.setPadding(dp(16),dp(7),dp(16),dp(7));root.addView(offlineStatus);
        }
        LinearLayout top=new LinearLayout(this);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.setPadding(dp(22),dp(14),dp(22),dp(10));
        if(back!=null){
            Button b=button("‹  חזור",Color.WHITE,blue);
            b.setOnClickListener(v->back.run());
            top.addView(b,new LinearLayout.LayoutParams(dp(130),dp(52)));
        }
        TextView brand=text(title,22,true);brand.setGravity(Gravity.CENTER);
        top.addView(brand,new LinearLayout.LayoutParams(0,dp(52),1));
        if(adminButton){
            Button settings=button("⚙",Color.WHITE,blue);
            settings.setOnClickListener(v->openAdmin());
            top.addView(settings,new LinearLayout.LayoutParams(dp(70),dp(52)));
        }
        cartButton=button("סל  0",blue,Color.WHITE);
        cartButton.setOnClickListener(v->showCart());
        top.addView(cartButton,new LinearLayout.LayoutParams(dp(150),dp(52)));
        root.addView(top);
        ScrollView scroll=new ScrollView(this);
        content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(dp(26),dp(10),dp(26),dp(110));
        scroll.addView(content);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);updateCartButton();
    }

    private void showHome(){
        polling=false;
        buildShell("מערכת מכירה",null,true);
        LinearLayout searchRow=new LinearLayout(this);searchRow.setGravity(Gravity.CENTER_VERTICAL);
        EditText search=input("שם מוצר או קטגוריה");
        Button searchBtn=button("חיפוש",blue,Color.WHITE);
        searchRow.addView(search,new LinearLayout.LayoutParams(0,dp(64),1));
        LinearLayout.LayoutParams sb=new LinearLayout.LayoutParams(dp(120),dp(58));sb.setMargins(dp(10),dp(6),0,dp(6));searchRow.addView(searchBtn,sb);
        content.addView(searchRow);
        TextView h=text("בחר קטגוריה",28,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(24),0,dp(18));content.addView(h);
        GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(Category c:categories)grid.addView(categoryCard(c),gridParams());
        Runnable doSearch=()->{String q=search.getText().toString().trim();if(!q.isEmpty())showSearch(q);};
        searchBtn.setOnClickListener(v->doSearch.run());
        search.setOnEditorActionListener((v,a,e)->{doSearch.run();return true;});
    }

    private View categoryCard(Category c){
        LinearLayout card=card();
        if("custom".equals(c.imageMode)&&c.imageUrl!=null&&!c.imageUrl.isEmpty()){
            ImageView image=imageView();loadImage(c.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));
        }else{
            GridLayout collage=new GridLayout(this);collage.setColumnCount(2);collage.setRowCount(2);
            int shown=0;
            for(Product p:products){
                if(!p.categoryId.equals(c.id)||p.imageUrl==null||p.imageUrl.isEmpty())continue;
                ImageView iv=imageView();loadImage(p.imageUrl,iv);
                GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=0;gp.height=dp(72);gp.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);gp.setMargins(dp(2),dp(2),dp(2),dp(2));collage.addView(iv,gp);
                if(++shown==4)break;
            }
            while(shown<4){View empty=new View(this);GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=0;gp.height=dp(72);gp.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);gp.setMargins(dp(2),dp(2),dp(2),dp(2));collage.addView(empty,gp);shown++;}
            card.addView(collage,new LinearLayout.LayoutParams(-1,dp(150)));
        }
        TextView name=text(c.name,19,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(8),dp(12),dp(8),dp(14));card.addView(name);
        card.setOnClickListener(v->showCategory(c));
        return card;
    }

    private void showCategory(Category c){
        buildShell(c.name,this::showHome,true);
        GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        for(Product p:products)if(p.categoryId.equals(c.id))grid.addView(productCard(p),gridParams());
    }

    private void showSearch(String q){
        buildShell("תוצאות חיפוש",this::showHome,true);
        String s=q.toLowerCase(Locale.ROOT);
        List<String> matchingCats=new ArrayList<>();
        for(Category c:categories)if(c.name.toLowerCase(Locale.ROOT).contains(s))matchingCats.add(c.id);
        GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        int found=0;
        for(Product p:products){
            if(p.name.toLowerCase(Locale.ROOT).contains(s)||matchingCats.contains(p.categoryId)){grid.addView(productCard(p),gridParams());found++;}
        }
        if(found==0){TextView no=text("לא נמצאו מוצרים",22,true);no.setGravity(Gravity.CENTER);no.setPadding(0,dp(60),0,0);content.addView(no);}
    }

    private View productCard(Product p){
        LinearLayout card=card();
        ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));
        TextView n=text(p.name,18,true);n.setPadding(dp(10),dp(10),dp(10),0);card.addView(n);
        TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),22,true);price.setPadding(dp(10),dp(4),dp(10),0);card.addView(price);
        TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(10),dp(4),dp(10),dp(8));card.addView(stock);
        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",blue,Color.WHITE);add.setEnabled(p.stock>0);
        add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});
        LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(50));ab.setMargins(dp(10),0,dp(10),dp(12));card.addView(add,ab);
        return card;
    }

    private void showCart(){
        buildShell("סל קניות",this::showHome,false);
        double total=0;int count=0;
        for(Product p:products){
            int q=cart.getOrDefault(p.id,0);if(q==0)continue;
            count+=q;total+=q*p.price;
            LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);
            TextView n=text(p.name+"\n"+String.format(Locale.US,"%.2f ₪",q*p.price),18,true);row.addView(n,new LinearLayout.LayoutParams(0,dp(72),1));
            Button minus=button("−",Color.rgb(237,241,247),Color.DKGRAY);minus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0)-1;if(x<=0)cart.remove(p.id);else cart.put(p.id,x);showCart();});row.addView(minus,new LinearLayout.LayoutParams(dp(54),dp(48)));
            TextView qty=text(String.valueOf(q),18,true);qty.setGravity(Gravity.CENTER);row.addView(qty,new LinearLayout.LayoutParams(dp(46),dp(48)));
            Button plus=button("+",Color.rgb(237,241,247),Color.DKGRAY);plus.setOnClickListener(v->{int x=cart.getOrDefault(p.id,0);if(x<p.stock)cart.put(p.id,x+1);showCart();});row.addView(plus,new LinearLayout.LayoutParams(dp(54),dp(48)));
            Button remove=button("הסר",red,Color.WHITE);remove.setOnClickListener(v->{cart.remove(p.id);showCart();});LinearLayout.LayoutParams rp=new LinearLayout.LayoutParams(dp(82),dp(48));rp.setMargins(dp(8),0,0,0);row.addView(remove,rp);
            content.addView(row);
        }
        if(count==0){TextView empty=text("הסל ריק",23,true);empty.setGravity(Gravity.CENTER);empty.setPadding(0,dp(50),0,dp(30));content.addView(empty);}
        TextView t=text(String.format(Locale.US,"סה״כ: %.2f ₪",total),31,true);t.setGravity(Gravity.CENTER);t.setPadding(0,dp(22),0,dp(16));content.addView(t);
        if(count>0){
            Button clear=button("רוקן סל",Color.WHITE,red);clear.setOnClickListener(v->new AlertDialog.Builder(this).setMessage("לרוקן את הסל?").setNegativeButton("לא",null).setPositiveButton("כן",(d,w)->{cart.clear();showCart();}).show());content.addView(clear,new LinearLayout.LayoutParams(-1,dp(56)));
        }
        Button pay=button("מעבר לתשלום",green,Color.WHITE);pay.setEnabled(count>0);pay.setOnClickListener(v->startCheckout());LinearLayout.LayoutParams pp=new LinearLayout.LayoutParams(-1,dp(64));pp.setMargins(0,dp(10),0,0);content.addView(pay,pp);
    }

    private void startCheckout(){
        if(cart.isEmpty())return;
        io.execute(()->{try{
            JSONArray items=new JSONArray();
            for(Product p:products){int q=cart.getOrDefault(p.id,0);if(q<=0)continue;JSONObject x=new JSONObject();x.put("product_id",p.id);x.put("unit_price",p.price);x.put("quantity",q);items.put(x);}
            JSONObject body=new JSONObject();body.put("items",items);
            JSONObject r=new JSONObject(requestRaw("POST",CREATE,body,false));saleToken=r.optString("external_token");saleTotal=r.optDouble("total_amount",0);
            main.post(this::showPayment);
        }catch(Exception e){main.post(()->Toast.makeText(this,"לא ניתן להתחיל תשלום: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private void showPayment(){
        LinearLayout root=baseRoot();LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(22),dp(12),dp(22),dp(8));
        Button back=button("‹  חזור",Color.WHITE,blue);back.setOnClickListener(v->showCart());top.addView(back,new LinearLayout.LayoutParams(dp(130),dp(52)));
        TextView title=text("תשלום",24,true);title.setGravity(Gravity.CENTER);top.addView(title,new LinearLayout.LayoutParams(0,dp(52),1));root.addView(top);
        paymentStatus=text(String.format(Locale.US,"לתשלום: %.2f ₪",saleTotal),25,true);paymentStatus.setGravity(Gravity.CENTER);root.addView(paymentStatus);
        paymentWebView=new WebView(this);WebSettings s=paymentWebView.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);paymentWebView.setWebChromeClient(new WebChromeClient());paymentWebView.setWebViewClient(new WebViewClient());paymentWebView.addJavascriptInterface(new PaymentBridge(),"Android");root.addView(paymentWebView,new LinearLayout.LayoutParams(-1,0,1));
        chargeButton=button("בצע תשלום",green,Color.WHITE);chargeButton.setOnClickListener(v->chargeCard());root.addView(chargeButton,new LinearLayout.LayoutParams(-1,dp(64)));setContentView(root);
        String html="<!doctype html><html dir='rtl'><body style='margin:0'><iframe id='frame' src='https://www.matara.pro/nedarimplus/iframe/?Picture=Hide' style='width:100%;height:100vh;border:0'></iframe><script>function p(d){frame.contentWindow.postMessage(d,'*')}window.addEventListener('message',e=>{let d=e.data;if(d&&d.Name==='TransactionResponse')Android.onTransaction(JSON.stringify(d.Value||{}));});</script></body></html>";
        paymentWebView.loadDataWithBaseURL("https://www.matara.pro/",html,"text/html","UTF-8",null);
    }

    private void chargeCard(){
        if(paymentWebView==null)return;chargeButton.setEnabled(false);
        String js="p({Name:'FinishTransaction2',Value:{Mosad:'"+MOSAD+"',ApiValid:'"+APIVALID+"',PaymentType:'Ragil',Currency:'1',Amount:'"+String.format(Locale.US,"%.2f",saleTotal)+"',Tashlumim:'1',Param1:'"+saleToken+"',CallBack:'"+CALLBACK+"'}})";
        paymentWebView.evaluateJavascript(js,null);
    }

    public class PaymentBridge{@JavascriptInterface public void onTransaction(String value){main.post(()->{paymentStatus.setText("בודק תשלום...");startPolling();});}}

    private void startPolling(){
        polling=true;
        io.execute(()->{for(int i=0;i<45&&polling;i++){try{
            JSONObject body=new JSONObject();body.put("p_token",saleToken);
            JSONArray a=requestArray("POST","/rest/v1/rpc/get_sale_status",body,false);
            if(a.length()>0&&"paid".equals(a.getJSONObject(0).optString("status"))){polling=false;cart.clear();loadData(()->{Toast.makeText(this,"התשלום בוצע",Toast.LENGTH_LONG).show();showHome();});return;}
            Thread.sleep(2000);
        }catch(Exception ignored){}}});
    }

    private void openAdmin(){if(adminToken.isEmpty())showLogin();else if(!offline.isOnline())showAdminHome();else verifyAdmin(this::showAdminHome);}

    private void showLogin(){
        final EditText pass=input("סיסמה");pass.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        new AlertDialog.Builder(this).setTitle("כניסת מנהל").setView(pass).setNegativeButton("ביטול",null).setPositiveButton("כניסה",(d,w)->login(pass.getText().toString())).show();
    }

    private void login(String password){
        io.execute(()->{try{
            JSONObject body=new JSONObject();body.put("email",ADMIN_EMAIL);body.put("password",password);
            JSONObject r=new JSONObject(requestRaw("POST","/auth/v1/token?grant_type=password",body,false));
            String token=r.optString("access_token");JSONObject user=r.optJSONObject("user");String uid=user==null?"":user.optString("id");
            if(token.isEmpty()||uid.isEmpty())throw new Exception("login failed");
            adminToken=token;adminUserId=uid;getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().putString("token",token).putString("user_id",uid).apply();
            verifyAdmin(this::showAdminHome);
        }catch(Exception e){adminToken="";adminUserId="";main.post(()->Toast.makeText(this,"סיסמה שגויה",Toast.LENGTH_LONG).show());}});
    }

    private void verifyAdmin(Runnable done){
        io.execute(()->{try{
            if(adminUserId.isEmpty()){
                JSONObject u=new JSONObject(requestRaw("GET","/auth/v1/user",null,true));adminUserId=u.optString("id");
            }
            JSONArray a=requestArray("GET","/rest/v1/store_admins?user_id=eq."+url(adminUserId)+"&select=user_id",null,true);
            if(a.length()==0)throw new Exception("no admin permission");
            main.post(done);
        }catch(Exception e){adminToken="";adminUserId="";main.post(()->Toast.makeText(this,"אין הרשאת מנהל",Toast.LENGTH_LONG).show());}});
    }

    private void showAdminHome(){
        buildShell("ניהול",this::showHome,false);
        String[] labels={"מוצרים וקטגוריות","מלאי","ספירת מלאי","ספקים","רכישה חדשה","היסטוריית רכישות","דוחות"};
        Runnable[] actions={this::showProductsAdmin,this::showStockAdmin,this::showInventoryCount,this::showSuppliersAdmin,this::showNewPurchase,this::showPurchaseHistory,this::showReports};
        for(int i=0;i<labels.length;i++){final int idx=i;Button b=button(labels[idx],Color.WHITE,blue);b.setOnClickListener(v->actions[idx].run());LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(64));p.setMargins(0,0,0,dp(12));content.addView(b,p);}
        Button logout=button("יציאה מניהול",red,Color.WHITE);logout.setOnClickListener(v->{adminToken="";adminUserId="";getSharedPreferences("simple_store_auth",MODE_PRIVATE).edit().clear().apply();showHome();});content.addView(logout,new LinearLayout.LayoutParams(-1,dp(60)));
    }

    private void showProductsAdmin(){
        buildShell("מוצרים וקטגוריות",this::showAdminHome,false);
        LinearLayout actions=new LinearLayout(this);actions.setOrientation(LinearLayout.HORIZONTAL);
        Button add=button("+ הוסף מוצר",blue,Color.WHITE);add.setOnClickListener(v->productDialog(null));actions.addView(add,new LinearLayout.LayoutParams(0,dp(58),1));
        Button cats=button("ניהול קטגוריות",Color.WHITE,blue);cats.setOnClickListener(v->showCategoriesAdmin());LinearLayout.LayoutParams cp=new LinearLayout.LayoutParams(0,dp(58),1);cp.setMargins(dp(10),0,0,0);actions.addView(cats,cp);content.addView(actions);
        for(Category c:categories){
            TextView head=text(c.name,21,true);head.setPadding(0,dp(18),0,dp(8));content.addView(head);
            for(Product p:products){if(!p.categoryId.equals(c.id))continue;
                LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);
                TextView t=text(p.name+"   "+String.format(Locale.US,"%.2f ₪",p.price)+"   מלאי "+p.stock,18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));
                Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->productDialog(p));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);
            }
        }
    }

    private void productDialog(Product p){
        ScrollView sc=new ScrollView(this);LinearLayout box=baseRoot();box.setPadding(dp(12),dp(6),dp(12),dp(6));sc.addView(box);
        EditText name=input("שם מוצר");EditText price=input("מחיר");price.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);
        EditText stock=input("מלאי");stock.setInputType(InputType.TYPE_CLASS_NUMBER);EditText low=input("סף מלאי נמוך");low.setInputType(InputType.TYPE_CLASS_NUMBER);
        Spinner cat=new Spinner(this);List<String> names=new ArrayList<>();for(Category c:categories)names.add(c.name);cat.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));
        box.addView(name);box.addView(price);box.addView(stock);box.addView(low);box.addView(cat);
        if(p!=null){name.setText(p.name);price.setText(String.valueOf(p.price));stock.setText(String.valueOf(p.stock));low.setText(String.valueOf(p.lowStock));for(int i=0;i<categories.size();i++)if(categories.get(i).id.equals(p.categoryId))cat.setSelection(i);}
        AlertDialog dlg=new AlertDialog.Builder(this).setTitle(p==null?"מוצר חדש":"עריכת מוצר").setView(sc).setNegativeButton("ביטול",null).setPositiveButton("שמור",null).create();
        dlg.setOnShowListener(x->{
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                if(name.getText().toString().trim().isEmpty()||categories.isEmpty()){Toast.makeText(this,"חסר שם מוצר או קטגוריה",Toast.LENGTH_LONG).show();return;}
                io.execute(()->{try{
                    JSONObject body=new JSONObject();body.put("name",name.getText().toString().trim());body.put("price",num(price,0));body.put("stock_quantity",intNum(stock,0));body.put("low_stock_threshold",intNum(low,3));body.put("category_id",categories.get(cat.getSelectedItemPosition()).id);body.put("is_active",true);
                    if(p==null){int next=1;for(Product x2:products)if(x2.categoryId.equals(categories.get(cat.getSelectedItemPosition()).id))next=Math.max(next,x2.sortOrder+1);body.put("sort_order",next);body.put("image_url","");body.put("image_path","");requestOrQueue("POST","/rest/v1/products",body,true);}else requestOrQueue("PATCH","/rest/v1/products?id=eq."+url(p.id),body,true);
                    loadData(()->{dlg.dismiss();showProductsAdmin();});
                }catch(Exception e){main.post(()->Toast.makeText(this,"שמירה נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
            });
            if(p!=null){
                Button archive=button("הסר מוצר",red,Color.WHITE);box.addView(archive,new LinearLayout.LayoutParams(-1,dp(54)));
                archive.setOnClickListener(v->new AlertDialog.Builder(this).setMessage("להסיר את המוצר "+p.name+"?").setNegativeButton("לא",null).setPositiveButton("כן",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_product_id",p.id);requestOrQueue("POST","/rest/v1/rpc/archive_product",b,true);cart.remove(p.id);loadData(()->{dlg.dismiss();showProductsAdmin();});}catch(Exception e){main.post(()->Toast.makeText(this,"הסרת המוצר נכשלה",Toast.LENGTH_LONG).show());}})).show());
            }
        });
        dlg.show();
    }

    private void showCategoriesAdmin(){
        buildShell("ניהול קטגוריות",this::showProductsAdmin,false);
        Button add=button("+ הוסף קטגוריה",blue,Color.WHITE);add.setOnClickListener(v->categoryDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        for(Category c:categories){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView t=text(c.name+"   "+("custom".equals(c.imageMode)?"תמונה מותאמת":"תמונות אוטומטיות"),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->categoryDialog(c));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}
    }

    private void categoryDialog(Category c){
        LinearLayout box=baseRoot();EditText name=input("שם קטגוריה");Spinner mode=new Spinner(this);String[] modes={"תמונות אוטומטיות","תמונה מותאמת קיימת"};mode.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,modes));box.addView(name);box.addView(mode);
        if(c!=null){name.setText(c.name);mode.setSelection("custom".equals(c.imageMode)?1:0);}
        new AlertDialog.Builder(this).setTitle(c==null?"קטגוריה חדשה":"עריכת קטגוריה").setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("name",name.getText().toString().trim());b.put("image_mode",mode.getSelectedItemPosition()==1?"custom":"auto");if(mode.getSelectedItemPosition()==0){b.put("image_url",JSONObject.NULL);b.put("image_path",JSONObject.NULL);}if(c==null){int next=1;for(Category x:categories)next=Math.max(next,x.sortOrder+1);b.put("sort_order",next);requestOrQueue("POST","/rest/v1/categories",b,true);}else requestOrQueue("PATCH","/rest/v1/categories?id=eq."+url(c.id),b,true);loadData(this::showCategoriesAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת קטגוריה נכשלה",Toast.LENGTH_LONG).show());}})).show();
    }

    private List<Product> inventoryCountProducts(){
        List<Product> result=new ArrayList<>(products);
        String ids=getSharedPreferences("inventory_count",MODE_PRIVATE).getString("new_ids","");
        try{JSONArray raw=offline.products();for(int i=0;i<raw.length();i++){JSONObject o=raw.getJSONObject(i);if(ids.contains(o.optString("id"))&&findProduct(o.optString("id"))==null)result.add(new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),o.optInt("low_stock_threshold",3),o.optInt("sort_order",0)));}}catch(Exception ignored){}
        return result;
    }

    private void showInventoryCount(){
        buildShell("ספירת מלאי",this::showAdminHome,false);
        TextView help=text("הזן רק כמה יחידות יש כרגע. הטיוטה נשמרת אוטומטית במכשיר.",16,false);help.setPadding(0,0,0,dp(12));content.addView(help);
        Button add=button("+ מוצר שלא קיים",green,Color.WHITE);add.setOnClickListener(v->addInventoryCountProduct());content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        inventoryCountInputs.clear();
        android.content.SharedPreferences draft=getSharedPreferences("inventory_count",MODE_PRIVATE);
        for(Product p:inventoryCountProducts()){
            LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);
            Category cat=null;for(Category x:categories)if(x.id.equals(p.categoryId)){cat=x;break;}
            TextView name=text(p.name+"\n"+(cat==null?"":cat.name)+" · נוכחי: "+p.stock,17,true);row.addView(name,new LinearLayout.LayoutParams(0,dp(72),1));
            EditText qty=input("כמה יש?");qty.setInputType(InputType.TYPE_CLASS_NUMBER);if(draft.contains("qty_"+p.id))qty.setText(String.valueOf(draft.getInt("qty_"+p.id,0)));
            qty.addTextChangedListener(new SimpleWatcher(()->{String value=qty.getText().toString().trim();android.content.SharedPreferences.Editor e=draft.edit();if(value.isEmpty())e.remove("qty_"+p.id);else e.putInt("qty_"+p.id,Math.max(0,intNum(qty,0)));e.apply();}));
            inventoryCountInputs.put(p.id,qty);row.addView(qty,new LinearLayout.LayoutParams(dp(150),dp(58)));content.addView(row);
        }
        Button finish=button("סיום ספירה ועדכון מלאי הלקוחות",blue,Color.WHITE);finish.setOnClickListener(v->confirmInventoryCount());LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,dp(64));fp.setMargins(0,dp(14),0,dp(10));content.addView(finish,fp);
    }

    private void addInventoryCountProduct(){
        EditText name=input("שם המוצר");
        new AlertDialog.Builder(this).setTitle("מוצר חדש").setView(name).setNegativeButton("ביטול",null).setPositiveButton("המשך",(d,w)->{
            String productName=name.getText().toString().trim();if(productName.isEmpty())return;
            Spinner category=new Spinner(this);category.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,categories.stream().map(x->x.name).toArray(String[]::new)));
            new AlertDialog.Builder(this).setTitle("לאיזו קטגוריה להכניס?").setView(category).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d2,w2)->io.execute(()->{try{
                String id=java.util.UUID.randomUUID().toString();Category cat=categories.get(category.getSelectedItemPosition());int next=1;for(Product p:products)if(p.categoryId.equals(cat.id))next=Math.max(next,p.sortOrder+1);
                JSONObject body=new JSONObject();body.put("id",id);body.put("category_id",cat.id);body.put("name",productName);body.put("price",0);body.put("stock_quantity",0);body.put("low_stock_threshold",3);body.put("sort_order",next);body.put("image_url","");body.put("image_path","");body.put("is_active",false);
                requestOrQueue("POST","/rest/v1/products",body,true);
                android.content.SharedPreferences prefs=getSharedPreferences("inventory_count",MODE_PRIVATE);String ids=prefs.getString("new_ids","");prefs.edit().putString("new_ids",ids+","+id+",").apply();
                loadData(this::showInventoryCount);
            }catch(Exception e){main.post(()->Toast.makeText(this,"שמירת המוצר נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}})).show();
        }).show();
    }

    private void confirmInventoryCount(){
        boolean any=false;for(EditText e:inventoryCountInputs.values())if(!e.getText().toString().trim().isEmpty()){any=true;break;}if(!any){Toast.makeText(this,"עדיין לא הוזנו כמויות",Toast.LENGTH_LONG).show();return;}
        new AlertDialog.Builder(this).setTitle("מוצרים שלא נספרו").setMessage("לאפס ל־0 את כל המוצרים שלא הוזנה עבורם כמות?")
                .setNegativeButton("לעדכן רק שנספרו",(d,w)->applyInventoryCount(false))
                .setPositiveButton("כן, לאפס",(d,w)->applyInventoryCount(true)).show();
    }

    private void applyInventoryCount(boolean zeroMissing){
        new AlertDialog.Builder(this).setTitle("סיום ספירה").setMessage("לעדכן עכשיו את מלאי הלקוחות לפי הספירה?").setNegativeButton("ביטול",null).setPositiveButton("עדכן",(d,w)->io.execute(()->{try{
            for(Product p:inventoryCountProducts()){
                EditText input=inventoryCountInputs.get(p.id);String value=input==null?"":input.getText().toString().trim();if(value.isEmpty()&&!zeroMissing)continue;
                JSONObject body=new JSONObject();body.put("stock_quantity",value.isEmpty()?0:Math.max(0,Integer.parseInt(value)));
                requestOrQueue("PATCH","/rest/v1/products?id=eq."+url(p.id),body,true);
            }
            getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear().apply();
            loadData(()->{Toast.makeText(this,offline.isOnline()?"הספירה נשמרה ומלאי הלקוחות עודכן":"הספירה נשמרה במכשיר וממתינה לסנכרון",Toast.LENGTH_LONG).show();showInventoryCount();});
        }catch(Exception e){main.post(()->Toast.makeText(this,"עדכון הספירה נכשל: "+safeMsg(e),Toast.LENGTH_LONG).show());}})).show();
    }

    private void showStockAdmin(){
        buildShell("מלאי",this::showAdminHome,false);
        for(Product p:products){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);TextView t=text(p.name+"   מלאי: "+p.stock+(p.stock<=p.lowStock?"   ⚠ נמוך":""),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(64),1));Button adjust=button("עדכון",blue,Color.WHITE);adjust.setOnClickListener(v->stockDialog(p));row.addView(adjust,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}
        Button history=button("היסטוריית התאמות מלאי",Color.WHITE,blue);history.setOnClickListener(v->loadInventoryReport());content.addView(history,new LinearLayout.LayoutParams(-1,dp(58)));
    }

    private void stockDialog(Product p){
        LinearLayout box=baseRoot();Spinner direction=new Spinner(this);direction.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"הוספה","הפחתה"}));EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);Spinner reason=new Spinner(this);reason.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"manual","count","damage","other"}));EditText note=input("הערה");box.addView(direction);box.addView(qty);box.addView(reason);box.addView(note);
        new AlertDialog.Builder(this).setTitle(p.name+" · מלאי "+p.stock).setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->io.execute(()->{try{int amount=Integer.parseInt(qty.getText().toString());int change=direction.getSelectedItemPosition()==0?amount:-amount;if(change<0&&amount>p.stock)throw new Exception("אין מספיק מלאי להפחתה");JSONObject b=new JSONObject();b.put("p_product_id",p.id);b.put("p_change_qty",change);b.put("p_reason",String.valueOf(reason.getSelectedItem()));b.put("p_note",note.getText().toString().trim().isEmpty()?JSONObject.NULL:note.getText().toString().trim());requestOrQueue("POST","/rest/v1/rpc/adjust_stock",b,true);loadData(this::showStockAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"עדכון מלאי נכשל: "+safeMsg(e),Toast.LENGTH_LONG).show());}})).show();
    }

    private void loadSuppliers(Runnable done){
        io.execute(()->{try{JSONArray a;if(offline.isOnline()){try{a=requestArray("GET","/rest/v1/suppliers?select=*&order=name.asc",null,true);offline.saveSuppliers(a);}catch(Exception e){a=offline.suppliers();}}else a=offline.suppliers();suppliers.clear();for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);suppliers.add(new Supplier(o.optString("id"),o.optString("name"),o.optString("phone"),o.optString("email"),o.optString("payment_terms"),o.optString("notes")));}main.post(done);}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת ספקים נכשלה",Toast.LENGTH_LONG).show());}});
    }

    private void showSuppliersAdmin(){
        loadSuppliers(()->{buildShell("ספקים",this::showAdminHome,false);Button add=button("+ הוסף ספק",blue,Color.WHITE);add.setOnClickListener(v->supplierDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));for(Supplier s:suppliers){LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);TextView t=text(s.name+(s.phone.isEmpty()?"":"   "+s.phone)+(s.terms.isEmpty()?"":"\nתנאי תשלום: "+s.terms),18,true);row.addView(t,new LinearLayout.LayoutParams(0,dp(76),1));Button e=button("עריכה",blue,Color.WHITE);e.setOnClickListener(v->supplierDialog(s));row.addView(e,new LinearLayout.LayoutParams(dp(110),dp(52)));content.addView(row);}});
    }

    private void supplierDialog(Supplier s){
        ScrollView sc=new ScrollView(this);LinearLayout box=baseRoot();sc.addView(box);EditText name=input("שם ספק");EditText phone=input("טלפון");EditText email=input("מייל");EditText terms=input("תנאי תשלום");EditText notes=input("הערות");box.addView(name);box.addView(phone);box.addView(email);box.addView(terms);box.addView(notes);if(s!=null){name.setText(s.name);phone.setText(s.phone);email.setText(s.email);terms.setText(s.terms);notes.setText(s.notes);}
        AlertDialog dlg=new AlertDialog.Builder(this).setTitle(s==null?"ספק חדש":"עריכת ספק").setView(sc).setNegativeButton("ביטול",null).setPositiveButton("שמור",null).create();
        dlg.setOnShowListener(x->{dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{if(name.getText().toString().trim().isEmpty()){Toast.makeText(this,"הזן שם ספק",Toast.LENGTH_LONG).show();return;}io.execute(()->{try{JSONObject b=new JSONObject();b.put("name",name.getText().toString().trim());putNullable(b,"phone",phone.getText().toString().trim());putNullable(b,"email",email.getText().toString().trim());putNullable(b,"payment_terms",terms.getText().toString().trim());putNullable(b,"notes",notes.getText().toString().trim());if(s==null)requestOrQueue("POST","/rest/v1/suppliers",b,true);else requestOrQueue("PATCH","/rest/v1/suppliers?id=eq."+url(s.id),b,true);main.post(()->{dlg.dismiss();showSuppliersAdmin();});}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת ספק נכשלה",Toast.LENGTH_LONG).show());}});});if(s!=null){Button del=button("מחיקת ספק",red,Color.WHITE);box.addView(del,new LinearLayout.LayoutParams(-1,dp(54)));del.setOnClickListener(v->new AlertDialog.Builder(this).setMessage("למחוק ספק?").setNegativeButton("לא",null).setPositiveButton("כן",(d,w)->io.execute(()->{try{requestOrQueue("DELETE","/rest/v1/suppliers?id=eq."+url(s.id),null,true);main.post(()->{dlg.dismiss();showSuppliersAdmin();});}catch(Exception e){main.post(()->Toast.makeText(this,"מחיקת ספק נכשלה",Toast.LENGTH_LONG).show());}})).show());}});
        dlg.show();
    }

    private void showNewPurchase(){
        loadSuppliers(()->{
            buildShell("רכישה חדשה",this::showAdminHome,false);
            Spinner sup=supplierSpinner();content.addView(label("ספק"));content.addView(sup);
            EditText date=input("תאריך YYYY-MM-DD");date.setText(today());EditText invoice=input("מספר חשבונית");EditText notes=input("הערות");content.addView(date);content.addView(invoice);content.addView(notes);
            TextView linesTitle=text("פריטי רכישה",22,true);linesTitle.setPadding(0,dp(16),0,dp(6));content.addView(linesTitle);
            LinearLayout lines=new LinearLayout(this);lines.setOrientation(LinearLayout.VERTICAL);content.addView(lines);
            List<PurchaseLine> lineModels=new ArrayList<>();
            Runnable addLine=()->addPurchaseLine(lines,lineModels,null);
            addLine.run();
            Button addRow=button("+ הוסף שורה",Color.WHITE,blue);addRow.setOnClickListener(v->addLine.run());content.addView(addRow,new LinearLayout.LayoutParams(-1,dp(56)));
            TextView total=text("סה״כ רכישה: 0.00 ₪",24,true);total.setGravity(Gravity.CENTER);total.setPadding(0,dp(16),0,dp(8));content.addView(total);
            Runnable updateTotal=()->{double t=0;for(PurchaseLine l:lineModels)t+=l.quantity()*l.cost();total.setText(String.format(Locale.US,"סה״כ רכישה: %.2f ₪",t));};
            for(PurchaseLine l:lineModels)l.onChange=updateTotal;
            Button save=button("שמור רכישה",blue,Color.WHITE);save.setOnClickListener(v->savePurchase(sup,date,invoice,notes,lineModels));LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,dp(62));sp.setMargins(0,dp(10),0,0);content.addView(save,sp);
        });
    }

    private void addPurchaseLine(LinearLayout holder,List<PurchaseLine> models,PurchaseItem seed){
        LinearLayout box=card();
        Spinner prod=productSpinner();EditText qty=input("כמות");qty.setInputType(InputType.TYPE_CLASS_NUMBER);EditText cost=input("מחיר קנייה ליחידה");cost.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText sale=input("מחיר מכירה");sale.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);
        box.addView(prod);box.addView(qty);box.addView(cost);box.addView(sale);
        PurchaseLine line=new PurchaseLine(box,prod,qty,cost,sale);models.add(line);
        if(seed!=null){for(int i=0;i<products.size();i++)if(products.get(i).id.equals(seed.productId))prod.setSelection(i);qty.setText(String.valueOf(seed.quantity));cost.setText(String.valueOf(seed.unitCost));sale.setText(String.valueOf(seed.salePrice));}
        Button remove=button("הסר שורה",red,Color.WHITE);remove.setOnClickListener(v->{models.remove(line);holder.removeView(box);if(line.onChange!=null)line.onChange.run();});box.addView(remove,new LinearLayout.LayoutParams(-1,dp(48)));
        android.text.TextWatcher watcher=new SimpleWatcher(()->{if(line.onChange!=null)line.onChange.run();});qty.addTextChangedListener(watcher);cost.addTextChangedListener(watcher);
        holder.addView(box);
    }

    private void savePurchase(Spinner sup,EditText date,EditText invoice,EditText notes,List<PurchaseLine> lines){
        io.execute(()->{try{
            JSONArray items=new JSONArray();
            for(PurchaseLine l:lines){if(l.quantity()<1)continue;JSONObject it=new JSONObject();Product p=products.get(l.product.getSelectedItemPosition());it.put("product_id",p.id);it.put("quantity",l.quantity());it.put("unit_cost",l.cost());it.put("sale_price",l.sale());items.put(it);}
            if(items.length()==0)throw new Exception("אין שורות תקינות");
            JSONObject b=new JSONObject();b.put("p_supplier_id",sup.getSelectedItemPosition()==0?JSONObject.NULL:suppliers.get(sup.getSelectedItemPosition()-1).id);b.put("p_purchase_date",date.getText().toString().trim().isEmpty()?today():date.getText().toString().trim());putNullable(b,"p_invoice_number",invoice.getText().toString().trim());putNullable(b,"p_notes",notes.getText().toString().trim());b.put("p_items",items);
            requestOrQueue("POST","/rest/v1/rpc/create_purchase",b,true);
            loadData(()->{Toast.makeText(this,"הרכישה נשמרה",Toast.LENGTH_LONG).show();showPurchaseHistory();});
        }catch(Exception e){main.post(()->Toast.makeText(this,"שמירת רכישה נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private void showPurchaseHistory(){
        buildShell("היסטוריית רכישות",this::showAdminHome,false);
        loadSuppliers(()->io.execute(()->{try{
            JSONArray purchases=requestArray("GET","/rest/v1/purchases?select=*&order=purchase_date.desc,created_at.desc&limit=100",null,true);
            JSONArray items=requestArray("GET","/rest/v1/purchase_items?select=*&order=created_at.asc",null,true);
            main.post(()->renderPurchaseHistory(purchases,items));
        }catch(Exception e){main.post(()->Toast.makeText(this,"טעינת היסטוריה נכשלה",Toast.LENGTH_LONG).show());}}));
    }

    private void renderPurchaseHistory(JSONArray purchases,JSONArray items){
        try{
            if(purchases.length()==0){content.addView(text("אין עדיין רכישות",22,true));return;}
            for(int i=0;i<purchases.length();i++){
                JSONObject p=purchases.getJSONObject(i);String id=p.optString("id");Supplier s=findSupplier(p.optString("supplier_id"));
                LinearLayout card=card();
                TextView head=text(p.optString("purchase_date")+" · "+(s==null?"ללא ספק":s.name)+"\n"+String.format(Locale.US,"%.2f ₪",p.optDouble("total_cost",0)),19,true);head.setPadding(dp(12),dp(10),dp(12),dp(8));card.addView(head);
                LinearLayout actions=new LinearLayout(this);Button details=button("פרטים",Color.WHITE,blue);details.setOnClickListener(v->showPurchaseDetails(p,items));actions.addView(details,new LinearLayout.LayoutParams(0,dp(50),1));Button edit=button("עריכה",blue,Color.WHITE);edit.setOnClickListener(v->editPurchase(p,items));LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(0,dp(50),1);ep.setMargins(dp(8),0,0,0);actions.addView(edit,ep);Button del=button("מחיקה",red,Color.WHITE);del.setOnClickListener(v->deletePurchase(id));LinearLayout.LayoutParams dp2=new LinearLayout.LayoutParams(0,dp(50),1);dp2.setMargins(dp(8),0,0,0);actions.addView(del,dp2);card.addView(actions);content.addView(card);
            }
        }catch(Exception e){Toast.makeText(this,"שגיאה בהצגת היסטוריה",Toast.LENGTH_LONG).show();}
    }

    private void showPurchaseDetails(JSONObject p,JSONArray allItems){
        LinearLayout box=baseRoot();box.setPadding(dp(14),dp(8),dp(14),dp(8));
        try{for(int i=0;i<allItems.length();i++){JSONObject x=allItems.getJSONObject(i);if(!p.optString("id").equals(x.optString("purchase_id")))continue;Product pr=findProduct(x.optString("product_id"));String name=pr==null?"מוצר":pr.name;TextView t=text(name+" · "+x.optInt("quantity")+" × "+String.format(Locale.US,"%.2f ₪",x.optDouble("unit_cost",0))+" = "+String.format(Locale.US,"%.2f ₪",x.optDouble("line_total",x.optInt("quantity")*x.optDouble("unit_cost",0))),17,true);t.setPadding(0,dp(7),0,dp(7));box.addView(t);}}catch(Exception ignored){}
        String extra="";if(!p.optString("invoice_number").isEmpty())extra+="\nחשבונית: "+p.optString("invoice_number");if(!p.optString("notes").isEmpty())extra+="\nהערות: "+p.optString("notes");if(!extra.isEmpty())box.addView(text(extra.trim(),16,false));
        new AlertDialog.Builder(this).setTitle("פרטי רכישה").setView(box).setPositiveButton("סגור",null).show();
    }

    private void editPurchase(JSONObject p,JSONArray allItems){
        ScrollView sc=new ScrollView(this);LinearLayout box=baseRoot();box.setPadding(dp(12),dp(6),dp(12),dp(6));sc.addView(box);Spinner sup=supplierSpinner();for(int i=0;i<suppliers.size();i++)if(suppliers.get(i).id.equals(p.optString("supplier_id")))sup.setSelection(i+1);EditText date=input("תאריך");date.setText(p.optString("purchase_date"));EditText invoice=input("מספר חשבונית");invoice.setText(p.optString("invoice_number"));EditText notes=input("הערות");notes.setText(p.optString("notes"));box.addView(sup);box.addView(date);box.addView(invoice);box.addView(notes);
        LinearLayout holder=new LinearLayout(this);holder.setOrientation(LinearLayout.VERTICAL);box.addView(holder);List<PurchaseLine> lines=new ArrayList<>();
        try{for(int i=0;i<allItems.length();i++){JSONObject x=allItems.getJSONObject(i);if(!p.optString("id").equals(x.optString("purchase_id")))continue;addPurchaseLine(holder,lines,new PurchaseItem(x.optString("product_id"),x.optInt("quantity"),x.optDouble("unit_cost",0),x.optDouble("sale_price",0)));}}catch(Exception ignored){}
        Button add=button("+ הוסף שורה",Color.WHITE,blue);add.setOnClickListener(v->addPurchaseLine(holder,lines,null));box.addView(add,new LinearLayout.LayoutParams(-1,dp(52)));
        AlertDialog dlg=new AlertDialog.Builder(this).setTitle("עריכת רכישה").setView(sc).setNegativeButton("ביטול",null).setPositiveButton("שמור",null).create();dlg.setOnShowListener(x->dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->io.execute(()->{try{JSONArray arr=new JSONArray();for(PurchaseLine l:lines){if(l.quantity()<1)continue;JSONObject it=new JSONObject();Product pr=products.get(l.product.getSelectedItemPosition());it.put("product_id",pr.id);it.put("quantity",l.quantity());it.put("unit_cost",l.cost());it.put("sale_price",l.sale());arr.put(it);}JSONObject b=new JSONObject();b.put("p_purchase_id",p.optString("id"));b.put("p_supplier_id",sup.getSelectedItemPosition()==0?JSONObject.NULL:suppliers.get(sup.getSelectedItemPosition()-1).id);b.put("p_purchase_date",date.getText().toString().trim());putNullable(b,"p_invoice_number",invoice.getText().toString().trim());putNullable(b,"p_notes",notes.getText().toString().trim());b.put("p_items",arr);requestOrQueue("POST","/rest/v1/rpc/update_purchase",b,true);loadData(()->{dlg.dismiss();showPurchaseHistory();});}catch(Exception e){main.post(()->Toast.makeText(this,"עריכת רכישה נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}})));dlg.show();
    }

    private void deletePurchase(String id){
        new AlertDialog.Builder(this).setMessage("למחוק רכישה?").setNegativeButton("לא",null).setPositiveButton("כן",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_purchase_id",id);requestOrQueue("POST","/rest/v1/rpc/delete_purchase",b,true);loadData(this::showPurchaseHistory);}catch(Exception e){main.post(()->Toast.makeText(this,"מחיקת רכישה נכשלה",Toast.LENGTH_LONG).show());}})).show();
    }

    private void showReports(){
        buildShell("דוחות",this::showAdminHome,false);
        Button purchases=button("דוח קניות",blue,Color.WHITE);purchases.setOnClickListener(v->showPurchaseReportFilters());content.addView(purchases,new LinearLayout.LayoutParams(-1,dp(60)));
        Button inventory=button("היסטוריית התאמות מלאי",Color.WHITE,blue);inventory.setOnClickListener(v->loadInventoryReport());content.addView(inventory,new LinearLayout.LayoutParams(-1,dp(60)));
    }

    private void showPurchaseReportFilters(){
        loadSuppliers(()->{
            buildShell("דוח קניות",this::showReports,false);EditText from=input("מתאריך YYYY-MM-DD");EditText to=input("עד תאריך YYYY-MM-DD");Spinner sup=supplierSpinner();content.addView(from);content.addView(to);content.addView(sup);Button run=button("הצג דוח",blue,Color.WHITE);run.setOnClickListener(v->loadPurchaseReport(from.getText().toString().trim(),to.getText().toString().trim(),sup));content.addView(run,new LinearLayout.LayoutParams(-1,dp(58)));
        });
    }

    private void loadPurchaseReport(String from,String to,Spinner sup){
        io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_from",from.isEmpty()?JSONObject.NULL:from);b.put("p_to",to.isEmpty()?JSONObject.NULL:to);b.put("p_supplier_id",sup.getSelectedItemPosition()==0?JSONObject.NULL:suppliers.get(sup.getSelectedItemPosition()-1).id);JSONArray a=requestArray("POST","/rest/v1/rpc/get_purchase_report",b,true);main.post(()->{try{content.removeAllViews();JSONObject d=a.length()>0?a.getJSONObject(0):new JSONObject();JSONObject s=d.optJSONObject("summary");if(s==null)s=new JSONObject();TextView t=text("סה״כ קניות: "+String.format(Locale.US,"%.2f ₪",s.optDouble("total_cost",0))+"\nמספר רכישות: "+s.optInt("purchase_count",0)+"\nיחידות: "+s.optInt("total_units",0),24,true);t.setPadding(dp(20),dp(20),dp(20),dp(20));content.addView(t);JSONArray rows=d.optJSONArray("rows");if(rows==null)rows=d.optJSONArray("items");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);TextView x=text(r.optString("purchase_date")+"   "+r.optString("supplier_name")+"   "+String.format(Locale.US,"%.2f ₪",r.optDouble("total_cost",0)),17,true);x.setPadding(dp(12),dp(9),dp(12),dp(9));content.addView(x);}}catch(Exception ignored){}});}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת דוח נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private void loadInventoryReport(){
        buildShell("היסטוריית מלאי",this::showReports,false);
        io.execute(()->{try{JSONObject b=new JSONObject();b.put("p_limit",100);JSONArray a=requestArray("POST","/rest/v1/rpc/get_inventory_history",b,true);main.post(()->{try{if(a.length()==0){content.addView(text("אין עדיין התאמות מלאי",21,true));return;}for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);String sign=o.optInt("change_qty")>0?"+":"";TextView t=text(o.optString("product_name")+"   "+sign+o.optInt("change_qty")+"\n"+o.optString("reason")+(o.optString("note").isEmpty()?"":" — "+o.optString("note"))+"\n"+o.optString("created_at"),17,true);t.setPadding(dp(12),dp(12),dp(12),dp(12));content.addView(t);}}catch(Exception ignored){}});}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת היסטוריית מלאי נכשלה",Toast.LENGTH_LONG).show());}});
    }

    private Spinner supplierSpinner(){Spinner sup=new Spinner(this);List<String> names=new ArrayList<>();names.add("ללא ספק");for(Supplier s:suppliers)names.add(s.name);sup.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));return sup;}
    private Spinner productSpinner(){Spinner prod=new Spinner(this);List<String> names=new ArrayList<>();for(Product p:products)names.add(p.name);prod.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,names));return prod;}
    private Product findProduct(String id){for(Product p:products)if(p.id.equals(id))return p;return null;}
    private Supplier findSupplier(String id){for(Supplier s:suppliers)if(s.id.equals(id))return s;return null;}
    private String today(){return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date());}
    private String url(String s){try{return URLEncoder.encode(s,"UTF-8");}catch(Exception e){return s;}}
    private void putNullable(JSONObject o,String key,String value)throws Exception{o.put(key,value==null||value.isEmpty()?JSONObject.NULL:value);}
    private double num(EditText e,double def){try{return Double.parseDouble(e.getText().toString().trim());}catch(Exception x){return def;}}
    private int intNum(EditText e,int def){try{return Integer.parseInt(e.getText().toString().trim());}catch(Exception x){return def;}}
    private String safeMsg(Exception e){String m=e.getMessage();return m==null?"שגיאה לא ידועה":(m.length()>140?m.substring(0,140):m);}
    private TextView label(String s){TextView t=text(s,16,true);t.setPadding(0,dp(8),0,dp(4));return t;}

    private void updateCartButton(){if(cartButton==null)return;int n=0;for(int q:cart.values())n+=q;cartButton.setText("סל  "+n);}
    private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setBackground(roundRect(Color.WHITE,Color.rgb(225,230,238),1,18));v.setElevation(dp(3));v.setPadding(dp(8),dp(8),dp(8),dp(8));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.setMargins(0,dp(6),0,dp(6));v.setLayoutParams(lp);return v;}
    private GridLayout.LayoutParams gridParams(){GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=0;p.height=dp(305);p.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);p.setMargins(dp(8),dp(8),dp(8),dp(8));return p;}
    private ImageView imageView(){ImageView i=new ImageView(this);i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setPadding(dp(8),dp(8),dp(8),dp(6));return i;}
    private void loadImage(String url,ImageView image){io.execute(()->{try(InputStream in=new URL(url).openStream()){Bitmap b=BitmapFactory.decodeStream(in);main.post(()->image.setImageBitmap(b));}catch(Exception ignored){}});}
    private TextView text(String s,int size,boolean bold){TextView t=new TextView(this);t.setText(s);t.setTextSize(size);t.setTextColor(Color.rgb(27,39,59));t.setGravity(Gravity.CENTER_VERTICAL|Gravity.RIGHT);if(bold)t.setTypeface(t.getTypeface(),1);return t;}
    private EditText input(String hint){EditText e=new EditText(this);e.setHint(hint);e.setTextSize(18);e.setSingleLine(true);e.setPadding(dp(16),0,dp(16),0);e.setBackground(roundRect(Color.WHITE,Color.rgb(200,208,220),1,14));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(58));p.setMargins(0,dp(6),0,dp(6));e.setLayoutParams(p);return e;}
    private Button button(String s,int bg,int fg){Button b=new Button(this);b.setText(s);b.setTextSize(16);b.setTextColor(fg);b.setAllCaps(false);b.setTypeface(b.getTypeface(),1);b.setBackground(roundRect(bg,bg,0,14));return b;}
    private android.graphics.drawable.GradientDrawable roundRect(int fill,int stroke,int strokeDp,int radius){android.graphics.drawable.GradientDrawable g=new android.graphics.drawable.GradientDrawable();g.setColor(fill);g.setCornerRadius(dp(radius));if(strokeDp>0)g.setStroke(dp(strokeDp),stroke);return g;}
    private int dp(int v){return (int)(v*getResources().getDisplayMetrics().density+.5f);}

    static class Category{String id,name,imageUrl,imageMode;int sortOrder;Category(String i,String n,String u,String m,int s){id=i;name=n;imageUrl=u;imageMode=m;sortOrder=s;}}
    static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;Product(String i,String c,String n,double p,int s,String u,int l,int so){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;}}
    static class Supplier{String id,name,phone,email,terms,notes;Supplier(String i,String n,String p,String e,String t,String no){id=i;name=n;phone=p;email=e;terms=t;notes=no;}}
    static class PurchaseItem{String productId;int quantity;double unitCost,salePrice;PurchaseItem(String p,int q,double c,double s){productId=p;quantity=q;unitCost=c;salePrice=s;}}
    static class PurchaseLine{LinearLayout root;Spinner product;EditText qty,cost,sale;Runnable onChange;PurchaseLine(LinearLayout r,Spinner p,EditText q,EditText c,EditText s){root=r;product=p;qty=q;cost=c;sale=s;}int quantity(){try{return Integer.parseInt(qty.getText().toString().trim());}catch(Exception e){return 0;}}double cost(){try{return Double.parseDouble(cost.getText().toString().trim());}catch(Exception e){return 0;}}double sale(){try{return Double.parseDouble(sale.getText().toString().trim());}catch(Exception e){return 0;}}}
    static class SimpleWatcher implements android.text.TextWatcher{Runnable r;SimpleWatcher(Runnable x){r=x;}public void beforeTextChanged(CharSequence s,int st,int c,int a){}public void onTextChanged(CharSequence s,int st,int b,int c){r.run();}public void afterTextChanged(android.text.Editable e){}}
}

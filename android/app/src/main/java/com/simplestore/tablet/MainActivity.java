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
import android.view.ViewGroup;
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
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final String BASE = "https://ksddrcalmszxxcuxoznd.supabase.co";
    private static final String KEY = "sb_publishable_inaup5n4YRD3AHJadjP9Xw_9JLqxAjR";
    private final ExecutorService io = Executors.newFixedThreadPool(4);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Category> categories = new ArrayList<>();
    private final List<Product> products = new ArrayList<>();
    private final Map<String,Integer> cart = new HashMap<>();
    private LinearLayout content;
    private Button cartButton;
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
        Button pay=button("מעבר לתשלום",Color.rgb(22,163,74),Color.WHITE); pay.setEnabled(count>0); pay.setOnClickListener(v->Toast.makeText(this,"מסך התשלום יחובר בשלב הבא",Toast.LENGTH_LONG).show()); content.addView(pay,new LinearLayout.LayoutParams(-1,dp(64)));
    }

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

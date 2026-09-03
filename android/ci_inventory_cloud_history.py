from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

old='''        android.content.SharedPreferences history=getSharedPreferences("inventory_count_history",MODE_PRIVATE);
        String historyIndex=history.getString("index","");
        if(!historyIndex.isEmpty()){
            Button historyButton=button("היסטוריית ספירות מלאי",Color.WHITE,blue);
            historyButton.setOnClickListener(v->showInventoryCountHistory());
            LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(58));hp.setMargins(0,dp(8),0,0);content.addView(historyButton,hp);
        }'''
new='''        Button historyButton=button("היסטוריית ספירות מלאי",Color.WHITE,blue);
        historyButton.setOnClickListener(v->showInventoryCountCloudHistory());
        LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(58));hp.setMargins(0,dp(8),0,0);content.addView(historyButton,hp);'''
if old not in s: raise SystemExit('history button marker not found')
s=s.replace(old,new,1)

insert='''    private void addInventoryCountProduct(){'''
methods=r'''    private void showInventoryCountCloudHistory(){
        buildShell("היסטוריית ספירות מלאי",this::showInventoryCount,false);
        TextView loading=text("טוען ספירות שמורות...",18,true);loading.setGravity(Gravity.CENTER);content.addView(loading);
        io.execute(()->{
            try{
                JSONArray rows=requestArray("POST","/rest/v1/rpc/get_inventory_count_history",new JSONObject(),false);
                main.post(()->renderInventoryCountCloudHistory(rows));
            }catch(Exception e){main.post(()->{content.removeAllViews();TextView err=text("לא ניתן לטעון את היסטוריית הספירות כרגע",18,true);err.setGravity(Gravity.CENTER);content.addView(err);});}
        });
    }

    private void renderInventoryCountCloudHistory(JSONArray rows){
        content.removeAllViews();
        if(rows==null||rows.length()==0){content.addView(text("אין עדיין ספירות שמורות",20,true));return;}
        for(int i=0;i<rows.length();i++){
            JSONObject saved=rows.optJSONObject(i);if(saved==null)continue;
            String id=saved.optString("id","");JSONArray items=saved.optJSONArray("items");int amount=items==null?0:items.length();
            String raw=saved.optString("counted_at","");String date=raw;
            try{java.text.SimpleDateFormat in=new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX",Locale.US);java.util.Date d=in.parse(raw);if(d!=null)date=new java.text.SimpleDateFormat("dd/MM/yyyy  HH:mm",new Locale("he","IL")).format(d);}catch(Exception ignored){if(raw.length()>=16)date=raw.substring(0,10)+"  "+raw.substring(11,16);}
            String source=saved.optString("source","");String label="manual_snapshot".equals(source)?"\nצילום מלאי חד־פעמי":"";
            LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);
            TextView info=text(date+"\n"+amount+" מוצרים בספירה"+label,16,true);row.addView(info,new LinearLayout.LayoutParams(0,dp(88),1));
            Button open=button("פתח / ערוך",blue,Color.WHITE);final JSONObject selected=saved;open.setOnClickListener(v->openCloudInventoryCount(selected));row.addView(open,new LinearLayout.LayoutParams(dp(150),dp(54)));content.addView(row);
        }
    }

    private void openCloudInventoryCount(JSONObject saved){
        JSONArray items=saved.optJSONArray("items");if(items==null)return;
        new AlertDialog.Builder(this).setTitle("פתיחת ספירה לעריכה").setMessage("הכמויות מהספירה ייטענו למסך הספירה. המלאי לא ישתנה עד שתסיים ותאשר עדכון.").setNegativeButton("ביטול",null).setPositiveButton("פתח",(d,w)->{
            android.content.SharedPreferences.Editor e=getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear();
            for(int i=0;i<items.length();i++){JSONObject x=items.optJSONObject(i);if(x==null)continue;String productId=x.optString("product_id","");if(!productId.isEmpty())e.putInt("qty_"+productId,Math.max(0,x.optInt("counted_quantity",0)));}e.apply();showInventoryCount();
        }).show();
    }

'''
if insert not in s: raise SystemExit('method insertion marker not found')
s=s.replace(insert,methods+insert,1)
p.write_text(s,encoding='utf-8')
print('cloud inventory count history added to Android')

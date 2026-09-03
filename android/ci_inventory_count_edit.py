from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

anchor='''        Button add=button("+ מוצר שלא קיים",green,Color.WHITE);add.setOnClickListener(v->addInventoryCountProduct());content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        inventoryCountInputs.clear();'''
replacement='''        Button add=button("+ מוצר שלא קיים",green,Color.WHITE);add.setOnClickListener(v->addInventoryCountProduct());content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        android.content.SharedPreferences history=getSharedPreferences("inventory_count_history",MODE_PRIVATE);
        String historyIndex=history.getString("index","");
        if(!historyIndex.isEmpty()){
            Button historyButton=button("היסטוריית ספירות מלאי",Color.WHITE,blue);
            historyButton.setOnClickListener(v->showInventoryCountHistory());
            LinearLayout.LayoutParams hp=new LinearLayout.LayoutParams(-1,dp(58));hp.setMargins(0,dp(8),0,0);content.addView(historyButton,hp);
        }
        inventoryCountInputs.clear();'''
if anchor not in s: raise SystemExit('inventory count add-button anchor not found')
s=s.replace(anchor,replacement,1)

anchor2='''            getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear().apply();
            loadData(()->{Toast.makeText(this,offline.isOnline()?"הספירה נשמרה ומלאי הלקוחות עודכן":"הספירה נשמרה במכשיר וממתינה לסנכרון",Toast.LENGTH_LONG).show();showInventoryCount();});'''
replacement2='''            android.content.SharedPreferences history=getSharedPreferences("inventory_count_history",MODE_PRIVATE);
            long savedAt=System.currentTimeMillis();String countId=String.valueOf(savedAt);
            org.json.JSONObject savedCount=new org.json.JSONObject();savedCount.put("saved_at",savedAt);savedCount.put("zero_missing",zeroMissing);
            org.json.JSONObject savedItems=new org.json.JSONObject();
            for(Product p:inventoryCountProducts()){
                EditText input=inventoryCountInputs.get(p.id);String value=input==null?"":input.getText().toString().trim();
                if(!value.isEmpty())savedItems.put(p.id,Math.max(0,Integer.parseInt(value)));else if(zeroMissing)savedItems.put(p.id,0);
            }
            savedCount.put("items",savedItems);
            String oldIndex=history.getString("index","");
            history.edit().putString("count_"+countId,savedCount.toString()).putString("index",countId+(oldIndex.isEmpty()?"":","+oldIndex)).apply();
            getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear().apply();
            loadData(()->{Toast.makeText(this,offline.isOnline()?"הספירה נשמרה ומלאי הלקוחות עודכן":"הספירה נשמרה במכשיר וממתינה לסנכרון",Toast.LENGTH_LONG).show();showInventoryCount();});'''
if anchor2 not in s: raise SystemExit('inventory count finalize anchor not found')
s=s.replace(anchor2,replacement2,1)

insert_before='''    private void addInventoryCountProduct(){'''
methods='''    private void showInventoryCountHistory(){
        buildShell("היסטוריית ספירות מלאי",this::showInventoryCount,false);
        android.content.SharedPreferences history=getSharedPreferences("inventory_count_history",MODE_PRIVATE);
        String index=history.getString("index","");
        if(index.isEmpty()){content.addView(text("אין עדיין ספירות שמורות",20,true));return;}
        for(String id:index.split(",")){
            if(id.trim().isEmpty())continue;
            try{
                org.json.JSONObject saved=new org.json.JSONObject(history.getString("count_"+id,"{}"));
                long when=saved.optLong("saved_at",Long.parseLong(id));org.json.JSONObject items=saved.optJSONObject("items");int amount=items==null?0:items.length();
                String date=new java.text.SimpleDateFormat("dd/MM/yyyy  HH:mm",new java.util.Locale("he","IL")).format(new java.util.Date(when));
                LinearLayout row=card();row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER_VERTICAL);
                TextView info=text(date+"\\n"+amount+" מוצרים בספירה",17,true);row.addView(info,new LinearLayout.LayoutParams(0,dp(72),1));
                Button open=button("פתח / ערוך",blue,Color.WHITE);final String selected=id;open.setOnClickListener(v->openSavedInventoryCount(selected));row.addView(open,new LinearLayout.LayoutParams(dp(150),dp(54)));content.addView(row);
            }catch(Exception ignored){}
        }
    }

    private void openSavedInventoryCount(String id){
        android.content.SharedPreferences history=getSharedPreferences("inventory_count_history",MODE_PRIVATE);
        try{
            org.json.JSONObject saved=new org.json.JSONObject(history.getString("count_"+id,"{}"));org.json.JSONObject items=saved.optJSONObject("items");if(items==null)return;
            new AlertDialog.Builder(this).setTitle("פתיחת ספירה לעריכה").setMessage("הכמויות מהספירה ייטענו למסך הספירה. המלאי עצמו לא ישתנה עד שתסיים ותאשר עדכון.").setNegativeButton("ביטול",null).setPositiveButton("פתח",(d,w)->{
                android.content.SharedPreferences.Editor e=getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear();
                java.util.Iterator<String> keys=items.keys();while(keys.hasNext()){String productId=keys.next();e.putInt("qty_"+productId,items.optInt(productId,0));}e.apply();showInventoryCount();
            }).show();
        }catch(Exception e){Toast.makeText(this,"לא ניתן לפתוח את הספירה",Toast.LENGTH_LONG).show();}
    }

'''
if insert_before not in s: raise SystemExit('inventory method insertion point not found')
s=s.replace(insert_before,methods+insert_before,1)
p.write_text(s,encoding='utf-8')
print('dated editable inventory count history added')

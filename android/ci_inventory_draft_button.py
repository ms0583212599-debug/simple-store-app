from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
old='''        Button finish=button("סיום ספירה ועדכון מלאי הלקוחות",blue,Color.WHITE);finish.setOnClickListener(v->confirmInventoryCount());LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,dp(64));fp.setMargins(0,dp(14),0,dp(10));content.addView(finish,fp);
    }'''
new='''        TextView draftStatus=text("הטיוטה נשמרת אוטומטית בכל שינוי. אפשר לצאת ולחזור ולהמשיך מאותה נקודה.",15,false);draftStatus.setPadding(0,dp(12),0,dp(8));content.addView(draftStatus);
        Button saveDraft=button("שמור כטיוטה והמשך אחר כך",Color.WHITE,blue);saveDraft.setOnClickListener(v->{android.content.SharedPreferences draftNow=getSharedPreferences("inventory_count",MODE_PRIVATE);int counted=0;for(Product p:inventoryCountProducts())if(draftNow.contains("qty_"+p.id))counted++;Toast.makeText(this,"הטיוטה נשמרה · "+counted+" מוצרים נספרו. אפשר לחזור ולהמשיך אחר כך.",Toast.LENGTH_LONG).show();showAdminHome();});LinearLayout.LayoutParams dp1=new LinearLayout.LayoutParams(-1,dp(60));dp1.setMargins(0,dp(8),0,dp(10));content.addView(saveDraft,dp1);
        Button finish=button("סיום ספירה ועדכון מלאי הלקוחות",blue,Color.WHITE);finish.setOnClickListener(v->confirmInventoryCount());LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(-1,dp(64));fp.setMargins(0,dp(4),0,dp(10));content.addView(finish,fp);
    }'''
if old not in s: raise SystemExit('inventory finish block not found')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('explicit inventory draft save added')

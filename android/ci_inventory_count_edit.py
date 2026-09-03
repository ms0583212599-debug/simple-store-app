from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Add an explicit edit-last-count button to the inventory count screen.
anchor='''        Button add=button("+ מוצר שלא קיים",green,Color.WHITE);add.setOnClickListener(v->addInventoryCountProduct());content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        inventoryCountInputs.clear();'''
replacement='''        Button add=button("+ מוצר שלא קיים",green,Color.WHITE);add.setOnClickListener(v->addInventoryCountProduct());content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        android.content.SharedPreferences lastCount=getSharedPreferences("inventory_count_last",MODE_PRIVATE);
        if(lastCount.getBoolean("has_count",false)){
            Button editLast=button("עריכת ספירת מלאי אחרונה",Color.WHITE,blue);
            editLast.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("עריכת ספירה אחרונה").setMessage("לטעון את הכמויות מהספירה האחרונה ולערוך אותן? הטעינה לא תשנה את המלאי עד שתלחץ סיום ועדכון.").setNegativeButton("ביטול",null).setPositiveButton("טען לעריכה",(d,w)->{
                android.content.SharedPreferences.Editor draftEdit=getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear();
                for(Product p:inventoryCountProducts())if(lastCount.contains("qty_"+p.id))draftEdit.putInt("qty_"+p.id,lastCount.getInt("qty_"+p.id,0));
                draftEdit.apply();showInventoryCount();
            }).show());
            LinearLayout.LayoutParams ep=new LinearLayout.LayoutParams(-1,dp(58));ep.setMargins(0,dp(8),0,0);content.addView(editLast,ep);
        }
        inventoryCountInputs.clear();'''
if anchor not in s: raise SystemExit('inventory count add-button anchor not found')
s=s.replace(anchor,replacement,1)

# Preserve every finalized count before clearing the working draft.
anchor2='''            getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear().apply();
            loadData(()->{Toast.makeText(this,offline.isOnline()?"הספירה נשמרה ומלאי הלקוחות עודכן":"הספירה נשמרה במכשיר וממתינה לסנכרון",Toast.LENGTH_LONG).show();showInventoryCount();});'''
replacement2='''            android.content.SharedPreferences.Editor last=getSharedPreferences("inventory_count_last",MODE_PRIVATE).edit().clear();
            last.putBoolean("has_count",true);last.putLong("saved_at",System.currentTimeMillis());
            for(Product p:inventoryCountProducts()){
                EditText input=inventoryCountInputs.get(p.id);String value=input==null?"":input.getText().toString().trim();
                if(!value.isEmpty())last.putInt("qty_"+p.id,Math.max(0,Integer.parseInt(value)));else if(zeroMissing)last.putInt("qty_"+p.id,0);
            }
            last.apply();
            getSharedPreferences("inventory_count",MODE_PRIVATE).edit().clear().apply();
            loadData(()->{Toast.makeText(this,offline.isOnline()?"הספירה נשמרה ומלאי הלקוחות עודכן":"הספירה נשמרה במכשיר וממתינה לסנכרון",Toast.LENGTH_LONG).show();showInventoryCount();});'''
if anchor2 not in s: raise SystemExit('inventory count finalize anchor not found')
s=s.replace(anchor2,replacement2,1)

p.write_text(s,encoding='utf-8')
print('editable finalized inventory count added')

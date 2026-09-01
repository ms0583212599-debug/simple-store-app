from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
if 'private boolean customerAdminMode=false;' not in s:
    s=s.replace('    private String adminUserId = "";','    private String adminUserId = "";\n    private boolean customerAdminMode=false;',1)

# Add entry button in native admin home.
marker='        for(int i=0;i<labels.length;i++){final int idx=i;Button b=button(labels[idx],Color.WHITE,blue);b.setOnClickListener(v->actions[idx].run());LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(64));p.setMargins(0,0,0,dp(12));content.addView(b,p);}'
if marker not in s: raise SystemExit('admin menu marker not found')
if 'מצב ניהול במסך לקוחות' not in s:
    s=s.replace(marker,marker+'\n        Button customerMode=button("מצב ניהול במסך לקוחות",blue,Color.WHITE);customerMode.setOnClickListener(v->{customerAdminMode=true;showHome();});LinearLayout.LayoutParams cmp=new LinearLayout.LayoutParams(-1,dp(64));cmp.setMargins(0,dp(4),0,dp(12));content.addView(customerMode,cmp);',1)

# Show a clear exit control on the customer home while the mode is active.
home='        buildShell("מערכת מכירה",null,true);'
if home not in s: raise SystemExit('home marker not found')
replacement='        buildShell("מערכת מכירה",null,true);\n        if(customerAdminMode){Button exitMode=button("מצב ניהול פעיל — יציאה",Color.rgb(23,37,84),Color.WHITE);exitMode.setOnClickListener(v->{customerAdminMode=false;showHome();});LinearLayout.LayoutParams emp=new LinearLayout.LayoutParams(-1,dp(56));emp.setMargins(0,0,0,dp(10));content.addView(exitMode,emp);}'
s=s.replace(home,replacement,1)

# In customer-management mode, the product card becomes an edit action instead of add-to-cart.
old='        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",blue,Color.WHITE);add.setEnabled(p.stock>0);\n        add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});'
new='        Button add=button(customerAdminMode?"✎ עריכת מוצר":(p.stock>0?"הוסף לסל":"לא זמין"),blue,Color.WHITE);add.setEnabled(customerAdminMode||p.stock>0);\n        add.setOnClickListener(v->{if(customerAdminMode){productDialog(p);return;}int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});\n        if(customerAdminMode)card.setOnClickListener(v->productDialog(p));'
if old not in s: raise SystemExit('product card marker not found')
s=s.replace(old,new,1)

# Return to the customer screen after saving/archiving if edit was opened from customer mode.
s=s.replace('loadData(()->{dlg.dismiss();showProductsAdmin();});','loadData(()->{dlg.dismiss();if(customerAdminMode)showHome();else showProductsAdmin();});')

# Leaving admin session also leaves customer management mode.
s=s.replace('logout.setOnClickListener(v->{adminToken="";adminUserId="";showHome();});','logout.setOnClickListener(v->{adminToken="";adminUserId="";customerAdminMode=false;showHome();});',1)

p.write_text(s,encoding='utf-8')
print('customer admin mode applied')

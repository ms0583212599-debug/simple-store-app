from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(text, signature, replacement):
    start=text.find(signature)
    if start<0: raise SystemExit(signature+' marker not found')
    brace=text.find('{',start); depth=0; i=brace; instr=False; esc=False
    while i<len(text):
        ch=text[i]
        if instr:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=='"': instr=False
        else:
            if ch=='"': instr=True
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return text[:start]+replacement+text[i+1:]
        i+=1
    raise SystemExit(signature+' closing brace not found')

home=r'''    private void showHome(){
        polling=false;buildShell("מערכת מכירה",null,true);
        LinearLayout searchOuter=new LinearLayout(this);searchOuter.setGravity(Gravity.CENTER_HORIZONTAL);searchOuter.setPadding(dp(12),dp(4),dp(12),dp(5));content.addView(searchOuter,new LinearLayout.LayoutParams(-1,-2));
        LinearLayout searchBox=new LinearLayout(this);searchBox.setOrientation(LinearLayout.VERTICAL);searchBox.setGravity(Gravity.CENTER);searchOuter.addView(searchBox,new LinearLayout.LayoutParams(-1,-2));
        TextView searchTitle=text("חיפוש קטגוריה / מוצר",16,true);searchTitle.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);searchTitle.setTextColor(Color.rgb(72,78,84));LinearLayout.LayoutParams stp=new LinearLayout.LayoutParams(-1,dp(30));stp.setMargins(dp(2),0,dp(2),dp(3));searchBox.addView(searchTitle,stp);
        LinearLayout field=new LinearLayout(this);field.setGravity(Gravity.CENTER_VERTICAL);field.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);field.setBackground(roundRect(Color.WHITE,Color.rgb(188,194,199),1,2));
        Button clear=button("×",Color.WHITE,Color.rgb(82,88,94));clear.setTextSize(21);clear.setPadding(0,0,0,dp(2));field.addView(clear,new LinearLayout.LayoutParams(dp(44),dp(48)));
        EditText search=input("");search.setHint("");search.setBackgroundColor(Color.TRANSPARENT);search.setTextSize(17);search.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);search.setPadding(dp(6),0,dp(10),0);field.addView(search,new LinearLayout.LayoutParams(0,dp(48),1));searchBox.addView(field,new LinearLayout.LayoutParams(-1,dp(48)));
        Button searchBtn=button("חיפוש",Color.rgb(119,125,130),Color.WHITE);searchBtn.setTextSize(16);LinearLayout.LayoutParams bp=new LinearLayout.LayoutParams(dp(190),dp(42));bp.gravity=Gravity.CENTER_HORIZONTAL;bp.setMargins(0,dp(5),0,0);searchBox.addView(searchBtn,bp);
        LinearLayout resultsOuter=new LinearLayout(this);resultsOuter.setGravity(Gravity.CENTER_HORIZONTAL);resultsOuter.setPadding(dp(12),dp(3),dp(12),dp(8));content.addView(resultsOuter,new LinearLayout.LayoutParams(-1,-2));
        GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);resultsOuter.addView(grid,new LinearLayout.LayoutParams(-1,-2));
        Runnable render=()->{String q=search.getText().toString().trim().toLowerCase(Locale.ROOT);grid.removeAllViews();for(Category c:categories){boolean catMatch=q.isEmpty()||c.name.toLowerCase(Locale.ROOT).contains(q);if(catMatch){View cv=categoryCard(c);GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=GridLayout.LayoutParams.MATCH_PARENT;gp.height=dp(68);gp.setMargins(0,dp(2),0,dp(2));grid.addView(cv,gp);}}if(!q.isEmpty())for(Product p:products){if(!p.showToCustomers)continue;if(p.name.toLowerCase(Locale.ROOT).contains(q)){View pv=productCard(p);GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=GridLayout.LayoutParams.MATCH_PARENT;gp.height=dp(74);gp.setMargins(0,dp(2),0,dp(2));grid.addView(pv,gp);}}};
        render.run();search.addTextChangedListener(new SimpleWatcher(render));searchBtn.setOnClickListener(v->render.run());clear.setOnClickListener(v->{search.setText("");search.requestFocus();});search.setOnEditorActionListener((v,a,e)->{render.run();return true;});refreshMiniCart();
    }'''
s=replace_method(s,'    private void showHome()',home)

product=r'''    private View productCard(Product p){
        LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(5),dp(3),dp(5),dp(3));card.setBackground(roundRect(Color.WHITE,Color.rgb(202,207,211),1,2));
        LinearLayout actionCol=new LinearLayout(this);actionCol.setOrientation(LinearLayout.VERTICAL);actionCol.setGravity(Gravity.CENTER);actionCol.setPadding(0,0,dp(4),0);
        Button add=button(customerAdminMode?"✎ עריכת מוצר":(p.stock>0?"הוסף לסל":"לא זמין"),customerAdminMode?blue:(p.stock>0?Color.rgb(43,119,139):Color.rgb(145,151,157)),Color.WHITE);add.setTextSize(12);add.setPadding(dp(3),0,dp(3),0);add.setEnabled(customerAdminMode||p.stock>0);add.setOnClickListener(v->{if(customerAdminMode){productDialog(p);return;}int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();refreshMiniCart();}});actionCol.addView(add,new LinearLayout.LayoutParams(dp(118),dp(31)));card.addView(actionCol,new LinearLayout.LayoutParams(dp(126),-1));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);info.setPadding(dp(4),0,dp(7),0);TextView n=text(p.name,16,true);n.setTextColor(Color.rgb(148,48,61));n.setGravity(Gravity.RIGHT);info.addView(n);TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),14,true);price.setTextColor(Color.rgb(57,71,82));price.setGravity(Gravity.RIGHT);info.addView(price);TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",10,false);stock.setTextColor(p.stock>0?Color.rgb(105,113,120):Color.rgb(185,46,46));stock.setGravity(Gravity.RIGHT);info.addView(stock);card.addView(info,new LinearLayout.LayoutParams(0,-1,1));ImageView image=imageView();image.setPadding(dp(2),dp(2),dp(2),dp(2));if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(dp(76),dp(66)));if(customerAdminMode)card.setOnClickListener(v->productDialog(p));return card;
    }'''
s=replace_method(s,'    private View productCard(Product p)',product)

category=r'''    private View categoryCard(Category c){
        LinearLayout card=new LinearLayout(this);card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(5),dp(3),dp(5),dp(3));card.setBackground(roundRect(Color.WHITE,Color.rgb(202,207,211),1,2));
        TextView arrow=text("‹",22,false);arrow.setGravity(Gravity.CENTER);arrow.setTextColor(Color.rgb(92,99,105));card.addView(arrow,new LinearLayout.LayoutParams(dp(34),-1));
        TextView name=text(c.name,17,true);name.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);name.setTextColor(Color.rgb(62,72,82));name.setPadding(dp(5),0,dp(8),0);card.addView(name,new LinearLayout.LayoutParams(0,-1,1));
        ImageView image=imageView();image.setPadding(dp(2),dp(2),dp(2),dp(2));String imageUrl="";for(Product p:products){if(!p.showToCustomers||!p.categoryId.equals(c.id)||p.imageUrl==null||p.imageUrl.isEmpty())continue;imageUrl=p.imageUrl;break;}if(!imageUrl.isEmpty())loadImage(imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(dp(76),dp(60)));card.setOnClickListener(v->showCategory(c));return card;
    }'''
s=replace_method(s,'    private View categoryCard(Category c)',category)

p.write_text(s,encoding='utf-8')
print('Responsive Nedarim search styling applied')

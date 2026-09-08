from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(text, signature, replacement):
    start=text.find(signature)
    if start<0: raise SystemExit(signature+' marker not found')
    brace=text.find('{',start)
    if brace<0: raise SystemExit(signature+' opening brace not found')
    depth=0;i=brace;in_str=False;esc=False
    while i<len(text):
        ch=text[i]
        if in_str:
            if esc: esc=False
            elif ch=='\\': esc=True
            elif ch=='"': in_str=False
        else:
            if ch=='"': in_str=True
            elif ch=='{': depth+=1
            elif ch=='}':
                depth-=1
                if depth==0:return text[:start]+replacement+text[i+1:]
        i+=1
    raise SystemExit(signature+' closing brace not found')

s=s.replace('GridLayout grid=new GridLayout(this);grid.setColumnCount(6);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));','GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));')
s=s.replace('GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));','GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));')
s=s.replace('Button searchBtn=button("חיפוש",blue,Color.WHITE);','Button searchBtn=button("חיפוש",Color.rgb(118,126,134),Color.WHITE);',1)
s=s.replace('TextView h=text("בחר קטגוריה",28,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(24),0,dp(18));content.addView(h);','TextView h=text("בחר קטגוריה",24,true);h.setTextColor(Color.rgb(62,72,82));h.setGravity(Gravity.CENTER);h.setPadding(0,dp(16),0,dp(8));content.addView(h);',1)

category=r'''    private View categoryCard(Category c){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(8),dp(5),dp(8),dp(5));
        LinearLayout actionCol=new LinearLayout(this);actionCol.setOrientation(LinearLayout.VERTICAL);actionCol.setGravity(Gravity.BOTTOM|Gravity.LEFT);actionCol.setPadding(0,0,dp(8),0);
        Button open=button("מעבר לקטגוריה",Color.rgb(43,119,139),Color.WHITE);open.setTextSize(14);open.setAllCaps(false);open.setOnClickListener(v->showCategory(c));actionCol.addView(open,new LinearLayout.LayoutParams(dp(154),dp(34)));
        card.addView(actionCol,new LinearLayout.LayoutParams(dp(166),dp(84)));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);info.setPadding(dp(8),0,dp(10),0);
        TextView name=text(c.name,20,true);name.setTextColor(Color.rgb(148,48,61));name.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);info.addView(name,new LinearLayout.LayoutParams(-1,-1));card.addView(info,new LinearLayout.LayoutParams(0,dp(84),1));
        ImageView image=imageView();image.setPadding(dp(3),dp(3),dp(3),dp(3));if("custom".equals(c.imageMode)&&c.imageUrl!=null&&!c.imageUrl.isEmpty())loadImage(c.imageUrl,image);else{for(Product p:products){if(p.categoryId.equals(c.id)&&p.imageUrl!=null&&!p.imageUrl.isEmpty()){loadImage(p.imageUrl,image);break;}}}
        LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(dp(108),dp(84));ip.setMargins(dp(6),0,0,0);card.addView(image,ip);card.setOnClickListener(v->showCategory(c));return card;
    }'''
s=replace_method(s,'    private View categoryCard(Category c)',category)

product=r'''    private View productCard(Product p){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(8),dp(5),dp(8),dp(5));
        LinearLayout actionCol=new LinearLayout(this);actionCol.setOrientation(LinearLayout.VERTICAL);actionCol.setGravity(Gravity.BOTTOM|Gravity.LEFT);actionCol.setPadding(0,0,dp(8),0);
        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",Color.rgb(43,119,139),Color.WHITE);add.setTextSize(14);add.setAllCaps(false);add.setEnabled(p.stock>0);add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});actionCol.addView(add,new LinearLayout.LayoutParams(dp(154),dp(34)));card.addView(actionCol,new LinearLayout.LayoutParams(dp(166),dp(88)));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);info.setPadding(dp(8),0,dp(10),0);
        TextView n=text(p.name,19,true);n.setTextColor(Color.rgb(148,48,61));n.setGravity(Gravity.RIGHT);info.addView(n);TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),16,true);price.setTextColor(Color.rgb(57,71,82));price.setGravity(Gravity.RIGHT);price.setPadding(0,dp(2),0,0);info.addView(price);TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",12,false);stock.setTextColor(p.stock>0?Color.rgb(105,113,120):Color.rgb(185,46,46));stock.setGravity(Gravity.RIGHT);info.addView(stock);card.addView(info,new LinearLayout.LayoutParams(0,dp(88),1));
        ImageView image=imageView();image.setPadding(dp(3),dp(3),dp(3),dp(3));if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(dp(108),dp(88));ip.setMargins(dp(6),0,0,0);card.addView(image,ip);return card;
    }'''
s=replace_method(s,'    private View productCard(Product p)',product)

new_grid=r'''    private GridLayout.LayoutParams gridParams(){
        GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=GridLayout.LayoutParams.MATCH_PARENT;p.height=dp(108);p.columnSpec=GridLayout.spec(0,1f);p.setMargins(dp(3),dp(3),dp(3),dp(3));return p;
    }'''
s=replace_method(s,'    private GridLayout.LayoutParams gridParams()',new_grid)

old='LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setBackgroundColor(Color.WHITE);c.setPadding(dp(8),dp(8),dp(8),dp(8));return c;'
if old in s:
    s=s.replace(old,'LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();bg.setColor(Color.WHITE);bg.setCornerRadius(dp(4));bg.setStroke(dp(1),Color.rgb(176,184,190));c.setBackground(bg);c.setPadding(dp(5),dp(5),dp(5),dp(5));return c;',1)

p.write_text(s,encoding='utf-8')
print('Nedarim storefront cards compacted to 108dp rows')

from pathlib import Path
import re

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(text, signature, replacement):
    start=text.find(signature)
    if start<0: raise SystemExit(signature+' marker not found')
    brace=text.find('{',start)
    if brace<0: raise SystemExit(signature+' opening brace not found')
    depth=0
    i=brace
    in_str=False
    esc=False
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
                if depth==0:
                    return text[:start]+replacement+text[i+1:]
        i+=1
    raise SystemExit(signature+' closing brace not found')

# Customer storefront only: convert category/product grids into one wide card per row.
s=s.replace('GridLayout grid=new GridLayout(this);grid.setColumnCount(6);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));', 'GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));')
s=s.replace('GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));', 'GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));')

# Nedarim reference layout, forced explicitly:
# RIGHT = image, CENTER = text/details, LEFT-BOTTOM = action button.
# Keep the card container LTR so the physical positions are deterministic;
# the Hebrew text itself remains RTL/right-aligned.
category=r'''    private View categoryCard(Category c){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(12),dp(10),dp(12),dp(10));

        LinearLayout actionCol=new LinearLayout(this);actionCol.setOrientation(LinearLayout.VERTICAL);actionCol.setGravity(Gravity.BOTTOM|Gravity.LEFT);
        Button open=button("מעבר לקטגוריה",Color.rgb(31,111,132),Color.WHITE);open.setOnClickListener(v->showCategory(c));actionCol.addView(open,new LinearLayout.LayoutParams(dp(190),dp(46)));
        card.addView(actionCol,new LinearLayout.LayoutParams(dp(200),dp(105)));

        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);info.setPadding(dp(16),0,dp(16),0);
        TextView name=text(c.name,22,true);name.setTextColor(Color.rgb(156,49,60));name.setGravity(Gravity.RIGHT|Gravity.CENTER_VERTICAL);info.addView(name,new LinearLayout.LayoutParams(-1,-1));
        card.addView(info,new LinearLayout.LayoutParams(0,dp(105),1));

        ImageView image=imageView();
        if("custom".equals(c.imageMode)&&c.imageUrl!=null&&!c.imageUrl.isEmpty())loadImage(c.imageUrl,image);
        else{for(Product p:products){if(p.categoryId.equals(c.id)&&p.imageUrl!=null&&!p.imageUrl.isEmpty()){loadImage(p.imageUrl,image);break;}}}
        card.addView(image,new LinearLayout.LayoutParams(dp(145),dp(105)));

        card.setOnClickListener(v->showCategory(c));return card;
    }'''
s=replace_method(s,'    private View categoryCard(Category c)',category)

product=r'''    private View productCard(Product p){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setLayoutDirection(View.LAYOUT_DIRECTION_LTR);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(12),dp(10),dp(12),dp(10));

        LinearLayout actionCol=new LinearLayout(this);actionCol.setOrientation(LinearLayout.VERTICAL);actionCol.setGravity(Gravity.BOTTOM|Gravity.LEFT);
        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",Color.rgb(31,111,132),Color.WHITE);add.setEnabled(p.stock>0);add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});actionCol.addView(add,new LinearLayout.LayoutParams(dp(190),dp(46)));
        card.addView(actionCol,new LinearLayout.LayoutParams(dp(200),dp(112)));

        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);info.setPadding(dp(16),0,dp(16),0);
        TextView n=text(p.name,21,true);n.setTextColor(Color.rgb(156,49,60));n.setGravity(Gravity.RIGHT);info.addView(n);
        TextView price=text(String.format(Locale.US,"מחיר: %.2f ₪",p.price),17,true);price.setTextColor(Color.rgb(55,76,93));price.setGravity(Gravity.RIGHT);info.addView(price);
        TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.rgb(55,76,93):Color.RED);stock.setGravity(Gravity.RIGHT);info.addView(stock);
        card.addView(info,new LinearLayout.LayoutParams(0,dp(112),1));

        ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(dp(145),dp(112)));
        return card;
    }'''
s=replace_method(s,'    private View productCard(Product p)',product)

new_grid=r'''    private GridLayout.LayoutParams gridParams(){
        GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=GridLayout.LayoutParams.MATCH_PARENT;p.height=dp(142);p.columnSpec=GridLayout.spec(0,1f);p.setMargins(dp(4),dp(6),dp(4),dp(6));return p;
    }'''
s=replace_method(s,'    private GridLayout.LayoutParams gridParams()',new_grid)

old='LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setBackgroundColor(Color.WHITE);c.setPadding(dp(8),dp(8),dp(8),dp(8));return c;'
if old in s:
    new='LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();bg.setColor(Color.rgb(250,250,247));bg.setCornerRadius(dp(5));bg.setStroke(dp(1),Color.rgb(91,125,136));c.setBackground(bg);c.setPadding(dp(8),dp(8),dp(8),dp(8));return c;'
    s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('Nedarim reference card alignment applied: image right, text center, action left-bottom')

from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Customer storefront only: convert category/product grids into one wide card per row.
s=s.replace('GridLayout grid=new GridLayout(this);grid.setColumnCount(6);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));', 'GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));')
s=s.replace('GridLayout grid=new GridLayout(this);grid.setColumnCount(3);grid.setUseDefaultMargins(true);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));', 'GridLayout grid=new GridLayout(this);grid.setColumnCount(1);grid.setUseDefaultMargins(false);content.addView(grid,new LinearLayout.LayoutParams(-1,-2));')

# Replace customer category card with Nedarim-like horizontal list card: image right, text beside it.
a=s.index('    private View categoryCard(Category c){')
b=s.index('    private void showCategory(Category c){',a)
category=r'''    private View categoryCard(Category c){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(12),dp(10),dp(12),dp(10));
        ImageView image=imageView();
        if("custom".equals(c.imageMode)&&c.imageUrl!=null&&!c.imageUrl.isEmpty())loadImage(c.imageUrl,image);
        else{for(Product p:products){if(p.categoryId.equals(c.id)&&p.imageUrl!=null&&!p.imageUrl.isEmpty()){loadImage(p.imageUrl,image);break;}}}
        card.addView(image,new LinearLayout.LayoutParams(dp(145),dp(105)));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setGravity(Gravity.CENTER_VERTICAL);info.setPadding(dp(18),0,dp(8),0);
        TextView name=text(c.name,22,true);name.setTextColor(Color.rgb(156,49,60));name.setGravity(Gravity.RIGHT);info.addView(name,new LinearLayout.LayoutParams(-1,0,1));
        Button open=button("מעבר לקטגוריה",Color.rgb(31,111,132),Color.WHITE);open.setOnClickListener(v->showCategory(c));LinearLayout.LayoutParams op=new LinearLayout.LayoutParams(dp(190),dp(46));op.gravity=Gravity.LEFT;info.addView(open,op);
        card.addView(info,new LinearLayout.LayoutParams(0,dp(105),1));card.setOnClickListener(v->showCategory(c));return card;
    }

'''
s=s[:a]+category+s[b:]

# Replace product card: image right, product details across card, add-to-cart lower left.
a=s.index('    private View productCard(Product p){')
b=s.index('    private void showCart(){',a)
product=r'''    private View productCard(Product p){
        LinearLayout card=card();card.setOrientation(LinearLayout.HORIZONTAL);card.setGravity(Gravity.CENTER_VERTICAL);card.setPadding(dp(12),dp(10),dp(12),dp(10));
        ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(dp(145),dp(112)));
        LinearLayout info=new LinearLayout(this);info.setOrientation(LinearLayout.VERTICAL);info.setPadding(dp(18),0,dp(8),0);
        TextView n=text(p.name,21,true);n.setTextColor(Color.rgb(156,49,60));n.setGravity(Gravity.RIGHT);info.addView(n,new LinearLayout.LayoutParams(-1,0,1));
        TextView price=text(String.format(Locale.US,"מחיר: %.2f ₪",p.price),17,true);price.setTextColor(Color.rgb(55,76,93));price.setGravity(Gravity.RIGHT);info.addView(price);
        TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.rgb(55,76,93):Color.RED);stock.setGravity(Gravity.RIGHT);info.addView(stock);
        Button add=button(p.stock>0?"הוסף לסל":"לא זמין",Color.rgb(31,111,132),Color.WHITE);add.setEnabled(p.stock>0);add.setOnClickListener(v->{int now=cart.getOrDefault(p.id,0);if(now<p.stock){cart.put(p.id,now+1);updateCartButton();Toast.makeText(this,"נוסף לסל",Toast.LENGTH_SHORT).show();}});LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(dp(190),dp(46));ab.gravity=Gravity.LEFT;ab.setMargins(0,dp(5),0,0);info.addView(add,ab);
        card.addView(info,new LinearLayout.LayoutParams(0,dp(112),1));return card;
    }

'''
s=s[:a]+product+s[b:]

# Wide list cards with Nedarim-like pale background/border and vertical spacing.
marker='    private GridLayout.LayoutParams gridParams(){'
a=s.index(marker)
b=s.index('    private LinearLayout card(){',a)
old=s[a:b]
new=r'''    private GridLayout.LayoutParams gridParams(){
        GridLayout.LayoutParams p=new GridLayout.LayoutParams();p.width=GridLayout.LayoutParams.MATCH_PARENT;p.height=dp(142);p.columnSpec=GridLayout.spec(0,1f);p.setMargins(dp(4),dp(6),dp(4),dp(6));return p;
    }

'''
s=s[:a]+new+s[b:]

# Restyle the shared card surface to the pale outlined kiosk appearance without changing behavior.
old='LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);c.setBackgroundColor(Color.WHITE);c.setPadding(dp(8),dp(8),dp(8),dp(8));return c;'
if old in s:
    new='LinearLayout c=new LinearLayout(this);c.setOrientation(LinearLayout.VERTICAL);android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();bg.setColor(Color.rgb(250,250,247));bg.setCornerRadius(dp(5));bg.setStroke(dp(1),Color.rgb(91,125,136));c.setBackground(bg);c.setPadding(dp(8),dp(8),dp(8),dp(8));return c;'
    s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('Nedarim-style customer storefront enabled')

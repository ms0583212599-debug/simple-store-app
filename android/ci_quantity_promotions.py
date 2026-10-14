from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java');s=p.read_text()
assert 'double price;int stock' in s
s=s.replace('double price;int stock','double price,promotionPrice;boolean promotionEnabled;int promotionQuantity;int stock',1)
s=s.replace('JSONArray ex=o.optJSONArray("additional_category_ids");','pr.promotionEnabled=o.optBoolean("promotion_enabled",false);pr.promotionQuantity=o.optInt("promotion_quantity",0);pr.promotionPrice=o.optDouble("promotion_price",0);JSONArray ex=o.optJSONArray("additional_category_ids");',1)
s=s.replace('q*p.price','quantityPrice(p,q)').replace('p.price*q','quantityPrice(p,q)')
s=s.replace('TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),14,true);','TextView price=text(String.format(Locale.US,"%.2f ₪",p.price)+(hasQuantityPromotion(p)?"\\n"+quantityPromotionLabel(p):""),14,true);',1)
s=s.replace('productCard(p),gridParams()', 'productCard(p),promotionGridParams(p)')
s=s.replace('productCard(p),new LinearLayout.LayoutParams(-1,dp(74))','productCard(p),new LinearLayout.LayoutParams(-1,dp(hasQuantityPromotion(p)?110:74))')
s=s.replace('gp.height=dp(74);gp.setMargins(0,dp(2),0,dp(2));grid.addView(pv,gp);','gp.height=dp(hasQuantityPromotion(p)?110:74);gp.setMargins(0,dp(2),0,dp(2));grid.addView(pv,gp);')
a=s.index('    private void productDialog(');b=s.index('\n    private ',a+10);part=s[a:b]
part=part.replace('box.addView(name);box.addView(price);','''android.widget.CheckBox promotion=new android.widget.CheckBox(this);promotion.setText("הפעל מבצע כמות");promotion.setChecked(p!=null&&p.promotionEnabled);EditText promotionQty=input("כמות למבצע, למשל 2 או 3");promotionQty.setInputType(InputType.TYPE_CLASS_NUMBER);promotionQty.setText(String.valueOf(p!=null&&p.promotionQuantity>=2?p.promotionQuantity:2));EditText promotionAmount=input("מחיר כולל לכמות הזאת");promotionAmount.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);if(p!=null&&p.promotionPrice>0)promotionAmount.setText(String.valueOf(p.promotionPrice));box.addView(name);box.addView(price);box.addView(promotion);box.addView(promotionQty);box.addView(promotionAmount);box.addView(text("כל קבוצה מלאה במחיר המבצע; יחידות נוספות במחיר הרגיל",14,false));''',1)
part=part.replace('                io.execute(()->{try{','''                final boolean promoEnabled=promotion.isChecked();final int promoQty=intNum(promotionQty,0);final double promoAmount=num(promotionAmount,0),regular=num(price,0);
                if(promoEnabled&&(promoQty<2||promoQty>9999||!Double.isFinite(promoAmount)||Math.round(promoAmount*100)<=0||Math.round(promoAmount*100)>=Math.round(regular*100)*promoQty)){Toast.makeText(this,"יש להזין כמות של 2 ומעלה ומחיר מבצע נמוך מהמחיר הרגיל לאותה כמות",Toast.LENGTH_LONG).show();return;}
                io.execute(()->{try{''',1)
part=part.replace('JSONObject body=new JSONObject();','JSONObject body=new JSONObject();body.put("promotion_enabled",promoEnabled);body.put("promotion_quantity",promoQty>=2&&promoQty<=9999?promoQty:JSONObject.NULL);body.put("promotion_price",Double.isFinite(promoAmount)&&promoAmount>0?Math.round(promoAmount*100)/100.0:JSONObject.NULL);',1)
s=s[:a]+part+s[b:]
helper='''    private GridLayout.LayoutParams promotionGridParams(Product p){GridLayout.LayoutParams lp=gridParams();if(hasQuantityPromotion(p))lp.height=dp(110);return lp;}
    private boolean hasQuantityPromotion(Product p){return p.promotionEnabled&&p.promotionQuantity>=2&&p.promotionQuantity<=9999&&Math.round(p.promotionPrice*100)>0&&Math.round(p.promotionPrice*100)<Math.round(p.price*100)*p.promotionQuantity;}
    private double quantityPrice(Product p,int q){long unit=Math.round(p.price*100);if(!hasQuantityPromotion(p))return unit*q/100.0;return ((q/p.promotionQuantity)*Math.round(p.promotionPrice*100)+(q%p.promotionQuantity)*unit)/100.0;}
    private String quantityPromotionLabel(Product p){return hasQuantityPromotion(p)?String.format(Locale.ROOT,"מבצע: %d ב־%.2f ₪",p.promotionQuantity,p.promotionPrice):"";}
'''
s=s.replace('    private Spinner supplierSpinner()',helper+'\n    private Spinner supplierSpinner()',1);p.write_text(s);print('Quantity promotions applied to product editor, storefront and all cart totals')

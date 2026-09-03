from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
# Practical tablet density: enough room for clean images and a real cart button.
s=s.replace('if(w>=1100)return 7;\n        if(w>=850)return 6;\n        if(w>=650)return 5;\n        if(w>=500)return 4;\n        return 3;',
'''if(w>=1100)return 8;\n        if(w>=850)return 7;\n        if(w>=650)return 6;\n        if(w>=500)return 5;\n        return 4;''')
# Give every card enough height for image, text, price, stock and button.
s=s.replace('p.height=dp(235);','p.height=dp(218);')
# Images get a fixed, centered area with generous inner spacing.
s=s.replace('card.addView(image,new LinearLayout.LayoutParams(-1,dp(100)));','card.addView(image,new LinearLayout.LayoutParams(-1,dp(92)));')
s=s.replace('card.addView(collage,new LinearLayout.LayoutParams(-1,dp(100)));','card.addView(collage,new LinearLayout.LayoutParams(-1,dp(92)));')
s=s.replace('i.setScaleType(ImageView.ScaleType.FIT_CENTER);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(2),dp(2),dp(2),dp(2));',
'''i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(8),dp(7),dp(8),dp(7));''')
s=s.replace('i.setScaleType(ImageView.ScaleType.CENTER_CROP);i.setAdjustViewBounds(false);i.setCropToPadding(true);i.setPadding(0,0,0,0);',
'''i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(8),dp(7),dp(8),dp(7));''')
# Card content must stay within the card.
s=s.replace('private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);',
'''private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setClipChildren(true);v.setClipToPadding(true);''')
# Category/product text sized for tablet readability.
s=s.replace('TextView name=text(c.name,15,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(4),dp(5),dp(4),dp(5));',
'''TextView name=text(c.name,14,true);name.setGravity(Gravity.CENTER);name.setMaxLines(2);name.setPadding(dp(4),dp(4),dp(4),dp(5));''')
s=s.replace('TextView n=text(p.name,14,true);n.setMaxLines(2);n.setPadding(dp(5),dp(4),dp(5),0);',
'''TextView n=text(p.name,13,true);n.setGravity(Gravity.CENTER);n.setMaxLines(2);n.setPadding(dp(4),dp(3),dp(4),0);''')
s=s.replace('TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),16,true);price.setPadding(dp(5),dp(2),dp(5),0);',
'''TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),15,true);price.setGravity(Gravity.CENTER);price.setPadding(dp(4),dp(1),dp(4),0);''')
s=s.replace('TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל",11,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(5),dp(1),dp(5),dp(3));',
'''TextView stock=text(p.stock>0?"מלאי "+p.stock:"אזל",11,true);stock.setGravity(Gravity.CENTER);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(4),0,dp(4),dp(2));''')
# Fix the actual conditional add-to-cart button, not only an exact static string.
s=s.replace('Button add=button(p.stock>0?"הוסף לסל":"לא זמין",blue,Color.WHITE);add.setEnabled(p.stock>0);',
'''Button add=button(p.stock>0?"+  הוסף לסל":"לא זמין",p.stock>0?green:Color.LTGRAY,p.stock>0?Color.WHITE:Color.DKGRAY);add.setEnabled(p.stock>0);add.setTextSize(12);add.setPadding(0,0,0,0);''')
s=s.replace('LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(40));ab.setMargins(dp(4),dp(3),dp(4),dp(5));',
'''LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(38));ab.setMargins(dp(4),dp(2),dp(4),dp(4));''')
p.write_text(s,encoding='utf-8')
print('clean storefront cards and working cart button applied')

from pathlib import Path
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
# Much smaller storefront tiles: roughly half current footprint on tablet.
s=s.replace('if(w>=1100)return 7;\n        if(w>=850)return 6;\n        if(w>=650)return 5;\n        if(w>=500)return 4;\n        return 3;',
'''if(w>=1100)return 12;\n        if(w>=850)return 10;\n        if(w>=650)return 8;\n        if(w>=500)return 6;\n        return 4;''')
# Keep tiles compact, but leave enough vertical room so nothing can spill outside.
s=s.replace('p.height=dp(235);','p.height=dp(182);')
# Category image/collage area.
s=s.replace('card.addView(image,new LinearLayout.LayoutParams(-1,dp(100)));','card.addView(image,new LinearLayout.LayoutParams(-1,dp(58)));')
s=s.replace('card.addView(collage,new LinearLayout.LayoutParams(-1,dp(100)));','card.addView(collage,new LinearLayout.LayoutParams(-1,dp(58)));')
# Product image specifically smaller than before so it always stays well inside the card.
s=s.replace('ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(58)));',
'''ImageView image=imageView();if(p.imageUrl!=null&&!p.imageUrl.isEmpty())loadImage(p.imageUrl,image);card.addView(image,new LinearLayout.LayoutParams(-1,dp(46)));''')
# Fit the entire bitmap inside its ImageView, never crop or zoom past the bounds.
s=s.replace('i.setScaleType(ImageView.ScaleType.FIT_CENTER);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(2),dp(2),dp(2),dp(2));',
'''i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(6),dp(5),dp(6),dp(5));''')
s=s.replace('i.setScaleType(ImageView.ScaleType.CENTER_CROP);i.setAdjustViewBounds(false);i.setCropToPadding(true);i.setPadding(0,0,0,0);',
'''i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(6),dp(5),dp(6),dp(5));''')
# Explicitly clip every card to its rounded bounds area so children can never draw outside it.
s=s.replace('private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);',
'''private LinearLayout card(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);v.setClipChildren(true);v.setClipToPadding(true);''')
# Keep names readable in the smaller tiles.
s=s.replace('TextView name=text(c.name,15,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(4),dp(5),dp(4),dp(5));',
'''TextView name=text(c.name,13,true);name.setGravity(Gravity.CENTER);name.setMaxLines(2);name.setPadding(dp(3),dp(3),dp(3),dp(3));''')
s=s.replace('TextView n=text(p.name,14,true);n.setMaxLines(2);n.setPadding(dp(5),dp(4),dp(5),0);',
'''TextView n=text(p.name,12,true);n.setMaxLines(2);n.setPadding(dp(3),dp(2),dp(3),0);''')
s=s.replace('TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),16,true);price.setPadding(dp(5),dp(2),dp(5),0);',
'''TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),14,true);price.setPadding(dp(3),0,dp(3),0);''')
s=s.replace('TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל",11,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(5),dp(1),dp(5),dp(3));',
'''TextView stock=text(p.stock>0?"מלאי "+p.stock:"אזל",10,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(3),0,dp(3),dp(1));''')
# Make the add-to-cart action visually dominant and easy to tap.
s=s.replace('LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(40));ab.setMargins(dp(4),dp(3),dp(4),dp(5));',
'''LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(42));ab.setMargins(dp(3),dp(2),dp(3),dp(3));''')
s=s.replace('button("הוסף לסל",blue,Color.WHITE)','button("+ הוסף לסל",green,Color.WHITE)')
s=s.replace('button("הוסף לסל",green,Color.WHITE)','button("+ הוסף לסל",green,Color.WHITE)')
p.write_text(s,encoding='utf-8')
print('compact storefront with fully contained images applied')

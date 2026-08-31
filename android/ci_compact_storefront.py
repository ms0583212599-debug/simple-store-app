from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
# Six compact tiles per row.
s=s.replace('grid.setColumnCount(3);','grid.setColumnCount(6);')
# Enough height so product details and add-to-cart button stay inside the card.
s=s.replace('p.height=dp(305);','p.height=dp(235);')
s=s.replace('p.setMargins(dp(8),dp(8),dp(8),dp(8));','p.setMargins(dp(4),dp(4),dp(4),dp(4));')
# Keep the whole image visible inside its area.
s=s.replace('i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setPadding(dp(8),dp(8),dp(8),dp(6));','i.setScaleType(ImageView.ScaleType.FIT_CENTER);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(2),dp(2),dp(2),dp(2));')
# Product/category image areas.
s=s.replace('card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));','card.addView(image,new LinearLayout.LayoutParams(-1,dp(100)));')
s=s.replace('card.addView(collage,new LinearLayout.LayoutParams(-1,dp(150)));','card.addView(collage,new LinearLayout.LayoutParams(-1,dp(100)));')
# Make category collage an exact 2x2 grid so images cannot drift outside their cells.
s=s.replace('GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=0;gp.height=dp(72);gp.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);gp.setMargins(dp(2),dp(2),dp(2),dp(2));collage.addView(iv,gp);',
'''GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=0;gp.height=0;gp.rowSpec=GridLayout.spec(shown/2,1f);gp.columnSpec=GridLayout.spec(shown%2,1f);gp.setMargins(dp(2),dp(2),dp(2),dp(2));collage.addView(iv,gp);''')
s=s.replace('GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=0;gp.height=dp(72);gp.columnSpec=GridLayout.spec(GridLayout.UNDEFINED,1f);gp.setMargins(dp(2),dp(2),dp(2),dp(2));collage.addView(empty,gp);shown++;',
'''GridLayout.LayoutParams gp=new GridLayout.LayoutParams();gp.width=0;gp.height=0;gp.rowSpec=GridLayout.spec(shown/2,1f);gp.columnSpec=GridLayout.spec(shown%2,1f);gp.setMargins(dp(2),dp(2),dp(2),dp(2));collage.addView(empty,gp);shown++;''')
# Compact typography while keeping product controls readable.
s=s.replace('TextView name=text(c.name,19,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(8),dp(12),dp(8),dp(14));','TextView name=text(c.name,15,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(4),dp(5),dp(4),dp(5));')
s=s.replace('TextView n=text(p.name,18,true);n.setPadding(dp(10),dp(10),dp(10),0);','TextView n=text(p.name,14,true);n.setMaxLines(2);n.setPadding(dp(5),dp(4),dp(5),0);')
s=s.replace('TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),22,true);price.setPadding(dp(10),dp(4),dp(10),0);','TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),16,true);price.setPadding(dp(5),dp(2),dp(5),0);')
s=s.replace('TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(10),dp(4),dp(10),dp(8));','TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל",11,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(5),dp(1),dp(5),dp(3));')
# Keep add-to-cart button inside the bottom of every product card.
s=s.replace('LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(50));ab.setMargins(dp(10),0,dp(10),dp(12));','LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(40));ab.setMargins(dp(4),dp(3),dp(4),dp(5));')
p.write_text(s,encoding='utf-8')

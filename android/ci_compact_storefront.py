from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
# Six compact tiles per row.
s=s.replace('grid.setColumnCount(3);','grid.setColumnCount(6);')
# Give the compact card enough vertical room for a complete image + product details.
s=s.replace('p.height=dp(305);','p.height=dp(205);')
s=s.replace('p.setMargins(dp(8),dp(8),dp(8),dp(8));','p.setMargins(dp(4),dp(4),dp(4),dp(4));')
# Always fit the entire bitmap inside its ImageView; never crop or overflow it.
s=s.replace('i.setScaleType(ImageView.ScaleType.CENTER_INSIDE);i.setPadding(dp(8),dp(8),dp(8),dp(6));','i.setScaleType(ImageView.ScaleType.FIT_CENTER);i.setAdjustViewBounds(false);i.setCropToPadding(false);i.setPadding(dp(2),dp(2),dp(2),dp(2));')
# Reserve a proper image window in every compact card.
s=s.replace('card.addView(image,new LinearLayout.LayoutParams(-1,dp(150)));','card.addView(image,new LinearLayout.LayoutParams(-1,dp(105)));')
s=s.replace('gp.height=dp(72);','gp.height=dp(50);')
s=s.replace('card.addView(collage,new LinearLayout.LayoutParams(-1,dp(150)));','card.addView(collage,new LinearLayout.LayoutParams(-1,dp(105)));')
s=s.replace('TextView name=text(c.name,19,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(8),dp(12),dp(8),dp(14));','TextView name=text(c.name,15,true);name.setGravity(Gravity.CENTER);name.setPadding(dp(4),dp(5),dp(4),dp(5));')
s=s.replace('TextView n=text(p.name,18,true);n.setPadding(dp(10),dp(10),dp(10),0);','TextView n=text(p.name,14,true);n.setMaxLines(2);n.setPadding(dp(5),dp(3),dp(5),0);')
s=s.replace('TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),22,true);price.setPadding(dp(10),dp(4),dp(10),0);','TextView price=text(String.format(Locale.US,"%.2f ₪",p.price),16,true);price.setPadding(dp(5),dp(1),dp(5),0);')
s=s.replace('TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל מהמלאי",14,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(10),dp(4),dp(10),dp(8));','TextView stock=text(p.stock>0?"במלאי: "+p.stock:"אזל",11,true);stock.setTextColor(p.stock>0?Color.DKGRAY:Color.RED);stock.setPadding(dp(5),0,dp(5),dp(1));')
s=s.replace('LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(50));ab.setMargins(dp(10),0,dp(10),dp(12));','LinearLayout.LayoutParams ab=new LinearLayout.LayoutParams(-1,dp(36));ab.setMargins(dp(4),0,dp(4),dp(4));')
p.write_text(s,encoding='utf-8')

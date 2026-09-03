from pathlib import Path
import re
p=Path('app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
pattern=r'    private View categoryCard\(Category c\)\{.*?\n    \}\n\n    private void showCategory\(Category c\)\{'
replacement='''    private View categoryCard(Category c){
        LinearLayout card=card();
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setClipChildren(true);card.setClipToPadding(true);

        LinearLayout imageBox=new LinearLayout(this);
        imageBox.setGravity(Gravity.CENTER);
        imageBox.setPadding(dp(7),dp(7),dp(7),dp(5));
        imageBox.setClipChildren(true);imageBox.setClipToPadding(true);
        imageBox.setBackgroundColor(Color.WHITE);

        if("custom".equals(c.imageMode)&&c.imageUrl!=null&&!c.imageUrl.isEmpty()){
            ImageView image=imageView();
            image.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
            image.setAdjustViewBounds(false);image.setCropToPadding(false);image.setPadding(0,0,0,0);
            loadImage(c.imageUrl,image);
            imageBox.addView(image,new LinearLayout.LayoutParams(-1,-1));
        }else{
            GridLayout collage=new GridLayout(this);
            collage.setColumnCount(2);collage.setRowCount(2);
            collage.setUseDefaultMargins(false);
            collage.setClipChildren(true);collage.setClipToPadding(true);
            int shown=0;
            for(Product p:products){
                if(!p.categoryId.equals(c.id)||p.imageUrl==null||p.imageUrl.isEmpty())continue;
                ImageView iv=imageView();
                iv.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
                iv.setAdjustViewBounds(false);iv.setCropToPadding(false);iv.setPadding(dp(3),dp(3),dp(3),dp(3));
                loadImage(p.imageUrl,iv);
                GridLayout.LayoutParams gp=new GridLayout.LayoutParams();
                gp.width=0;gp.height=0;
                gp.rowSpec=GridLayout.spec(shown/2,1f);gp.columnSpec=GridLayout.spec(shown%2,1f);
                gp.setMargins(dp(1),dp(1),dp(1),dp(1));collage.addView(iv,gp);
                if(++shown==4)break;
            }
            while(shown<4){
                View empty=new View(this);GridLayout.LayoutParams gp=new GridLayout.LayoutParams();
                gp.width=0;gp.height=0;gp.rowSpec=GridLayout.spec(shown/2,1f);gp.columnSpec=GridLayout.spec(shown%2,1f);
                gp.setMargins(dp(1),dp(1),dp(1),dp(1));collage.addView(empty,gp);shown++;
            }
            imageBox.addView(collage,new LinearLayout.LayoutParams(-1,-1));
        }
        card.addView(imageBox,new LinearLayout.LayoutParams(-1,dp(96)));
        TextView name=text(c.name,14,true);name.setGravity(Gravity.CENTER);name.setMaxLines(2);name.setPadding(dp(5),dp(5),dp(5),dp(6));card.addView(name);
        card.setOnClickListener(v->showCategory(c));
        return card;
    }

    private void showCategory(Category c){'''
ns,n=re.subn(pattern,replacement,s,count=1,flags=re.S)
if n!=1: raise SystemExit('categoryCard method not found')
p.write_text(s,encoding='utf-8')
print('category tiles rebuilt with contained image area')

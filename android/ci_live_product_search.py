from pathlib import Path

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

if 'import android.text.Editable;' not in s:
    s = s.replace('import android.text.InputType;\n', 'import android.text.InputType;\nimport android.text.Editable;\nimport android.text.TextWatcher;\n')

old = '''        Runnable doSearch=()->{String q=search.getText().toString().trim();if(!q.isEmpty())showSearch(q);};
        searchBtn.setOnClickListener(v->doSearch.run());
        search.setOnEditorActionListener((v,a,e)->{doSearch.run();return true;});'''

new = '''        Runnable renderLiveSearch=()->{
            String q=search.getText().toString().trim();
            grid.removeAllViews();
            if(q.isEmpty()){
                h.setText("בחר קטגוריה");
                for(Category c:categories)grid.addView(categoryCard(c),gridParams());
                return;
            }
            String needle=q.toLowerCase(Locale.ROOT);
            List<String> matchingCats=new ArrayList<>();
            for(Category c:categories)if(c.name.toLowerCase(Locale.ROOT).contains(needle))matchingCats.add(c.id);
            int found=0;
            for(Product product:products){
                if(product.name.toLowerCase(Locale.ROOT).contains(needle)||matchingCats.contains(product.categoryId)){
                    grid.addView(productCard(product),gridParams());
                    found++;
                }
            }
            h.setText(found>0?"תוצאות חיפוש ("+found+")":"לא נמצאו מוצרים");
        };
        search.addTextChangedListener(new TextWatcher(){
            @Override public void beforeTextChanged(CharSequence value,int start,int count,int after){}
            @Override public void onTextChanged(CharSequence value,int start,int before,int count){renderLiveSearch.run();}
            @Override public void afterTextChanged(Editable value){}
        });
        searchBtn.setOnClickListener(v->renderLiveSearch.run());
        search.setOnEditorActionListener((v,a,e)->{renderLiveSearch.run();return true;});'''

if new not in s:
    if old not in s:
        raise SystemExit('Live search anchor not found; refusing unsafe patch')
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('Android live product search enabled')

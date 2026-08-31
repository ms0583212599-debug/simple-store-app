from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# The compact storefront patch turns all customer grids into six columns.
# Replace that fixed value with a width-aware helper so portrait and landscape both look natural.
s=s.replace('grid.setColumnCount(6);','grid.setColumnCount(storefrontColumns());')

marker='    private int dp(int v){'
if 'private int storefrontColumns()' not in s:
    helper='''    private int storefrontColumns(){\n        int w=getResources().getConfiguration().screenWidthDp;\n        if(w>=1100)return 7;\n        if(w>=850)return 6;\n        if(w>=650)return 5;\n        if(w>=500)return 4;\n        return 3;\n    }\n\n'''
    if marker not in s: raise SystemExit('dp marker not found')
    s=s.replace(marker,helper+marker,1)

p.write_text(s,encoding='utf-8')

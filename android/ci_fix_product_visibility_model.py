from pathlib import Path
import re

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

# The checkout/search bundle uses showToCustomers and 9-argument Product construction.
# Make the Product model match that API regardless of formatting introduced by earlier transforms.
pattern = r'static class Product\{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;Product\(String i,String c,String n,double p,int s,String u,int l,int so\)\{id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;\}\}'
replacement = 'static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;boolean showToCustomers;Product(String i,String c,String n,double p,int s,String u,int l,int so,boolean sh){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;showToCustomers=sh;}}'
s, n = re.subn(pattern, replacement, s, count=1)
if n != 1:
    # If already upgraded, leave it alone; otherwise fail early with a useful error.
    if 'boolean showToCustomers' not in s or 'Product(String i,String c,String n,double p,int s,String u,int l,int so,boolean sh)' not in s:
        raise SystemExit('Product model marker not found and visibility model is not already present')

# Upgrade any remaining legacy 8-argument constructor calls to visible-by-default.
legacy = re.compile(r'new Product\((o\.optString\("id"\),o\.optString\("category_id"\),o\.optString\("name"\),o\.optDouble\("price",0\),o\.optInt\("stock_quantity",0\),o\.optString\("image_url"\),o\.optInt\("low_stock_threshold",3\),o\.optInt\("sort_order",0\))\)')
s = legacy.sub(r'new Product(\1,o.optBoolean("show_to_customers",true))', s)

p.write_text(s, encoding='utf-8')
print('Product visibility model compilation fix applied')

from pathlib import Path
import re

p = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s = p.read_text(encoding='utf-8')

# Earlier CI transforms may change whitespace/formatting of Product, so do not depend on
# one exact class string. Locate the Product class structurally and replace only that class.
marker = 'static class Product'
start = s.find(marker)
if start < 0:
    raise SystemExit('Product class not found')
brace = s.find('{', start)
if brace < 0:
    raise SystemExit('Product class opening brace not found')
depth = 0
end = None
for i in range(brace, len(s)):
    ch = s[i]
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0:
            end = i + 1
            break
if end is None:
    raise SystemExit('Product class closing brace not found')

# Keep both visibility concepts. active is retained for older purchase/admin transforms
# that edit is_active; showToCustomers controls customer storefront visibility.
# Catalog parsing already excludes inactive rows, so loaded products begin active=true.
product_class = '''static class Product{String id,categoryId,name,imageUrl;double price;int stock,lowStock,sortOrder;boolean active=true,showToCustomers;Product(String i,String c,String n,double p,int s,String u,int l,int so,boolean sh){id=i;categoryId=c;name=n;price=p;stock=s;imageUrl=u;lowStock=l;sortOrder=so;showToCustomers=sh;}}'''
s = s[:start] + product_class + s[end:]

# Upgrade any remaining legacy JSON-backed Product constructor calls that earlier/later
# transforms may have introduced. This is whitespace-tolerant and leaves existing 9-arg calls alone.
legacy = re.compile(
    r'new\s+Product\s*\(\s*'
    r'o\.optString\("id"\)\s*,\s*'
    r'o\.optString\("category_id"\)\s*,\s*'
    r'o\.optString\("name"\)\s*,\s*'
    r'o\.optDouble\("price"\s*,\s*0\)\s*,\s*'
    r'o\.optInt\("stock_quantity"\s*,\s*0\)\s*,\s*'
    r'o\.optString\("image_url"\)\s*,\s*'
    r'o\.optInt\("low_stock_threshold"\s*,\s*3\)\s*,\s*'
    r'o\.optInt\("sort_order"\s*,\s*0\)\s*\)'
)
replacement = ('new Product(o.optString("id"),o.optString("category_id"),o.optString("name"),'
               'o.optDouble("price",0),o.optInt("stock_quantity",0),o.optString("image_url"),'
               'o.optInt("low_stock_threshold",3),o.optInt("sort_order",0),'
               'o.optBoolean("show_to_customers",true))')
s = legacy.sub(replacement, s)

# Fail before Gradle if the generated source still has an inconsistent model.
if 'boolean active=true,showToCustomers' not in s:
    raise SystemExit('Product active/customer visibility fields missing after normalization')
if 'Product(String i,String c,String n,double p,int s,String u,int l,int so,boolean sh)' not in s:
    raise SystemExit('9-argument Product constructor missing after normalization')

p.write_text(s, encoding='utf-8')
print('Product visibility model normalized successfully')

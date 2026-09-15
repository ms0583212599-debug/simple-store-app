from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

old='''JSONArray a=requestArray("POST","/rest/v1/rpc/get_purchase_report",b,true);main.post(()->{try{content.removeAllViews();JSONObject d=a.length()>0?a.getJSONObject(0):new JSONObject();'''
new='''JSONArray a; boolean cached=false;\n            try{a=requestArray("POST","/rest/v1/rpc/get_purchase_report",b,true);getSharedPreferences("offline_reports",MODE_PRIVATE).edit().putString("purchase_report",a.toString()).putLong("purchase_report_at",System.currentTimeMillis()).apply();}\n            catch(Exception net){String saved=getSharedPreferences("offline_reports",MODE_PRIVATE).getString("purchase_report","");if(saved.isEmpty())throw net;a=new JSONArray(saved);cached=true;}\n            final JSONArray reportData=a; final boolean usingCache=cached; main.post(()->{try{content.removeAllViews();if(usingCache){TextView stale=text("אין אינטרנט — מוצגים נתונים שמורים מהפעם האחרונה",15,true);stale.setTextColor(red);stale.setPadding(dp(12),dp(10),dp(12),dp(10));content.addView(stale);}JSONObject d=reportData.length()>0?reportData.getJSONObject(0):new JSONObject();'''
if old not in s: raise SystemExit('purchase report anchor not found')
s=s.replace(old,new,1)

old2='''JSONArray a=requestArray("POST","/rest/v1/rpc/get_inventory_history",b,true);main.post(()->{try{if(a.length()==0){content.addView(text("אין עדיין התאמות מלאי",21,true));return;}'''
new2='''JSONArray a; boolean cached=false;\n            try{a=requestArray("POST","/rest/v1/rpc/get_inventory_history",b,true);getSharedPreferences("offline_reports",MODE_PRIVATE).edit().putString("inventory_history",a.toString()).putLong("inventory_history_at",System.currentTimeMillis()).apply();}\n            catch(Exception net){String saved=getSharedPreferences("offline_reports",MODE_PRIVATE).getString("inventory_history","");if(saved.isEmpty())throw net;a=new JSONArray(saved);cached=true;}\n            final JSONArray historyData=a; final boolean usingCache=cached;main.post(()->{try{if(usingCache){TextView stale=text("אין אינטרנט — מוצגת היסטוריה שמורה מהפעם האחרונה",15,true);stale.setTextColor(red);stale.setPadding(dp(12),dp(10),dp(12),dp(10));content.addView(stale);}if(historyData.length()==0){content.addView(text("אין עדיין התאמות מלאי",21,true));return;}'''
if old2 not in s: raise SystemExit('inventory history anchor not found')
s=s.replace(old2,new2,1)
# Replace only the original array references after the injected alias.
start=s.find('final JSONArray historyData=a;')
if start >= 0:
    end=s.find('});', start)
    if end >= 0:
        block=s[start:end]
        block=block.replace('for(int i=0;i<a.length();i++){JSONObject o=a.getJSONObject(i);', 'for(int i=0;i<historyData.length();i++){JSONObject o=historyData.getJSONObject(i);')
        s=s[:start]+block+s[end:]
p.write_text(s,encoding='utf-8')
print('Added offline cache fallback for purchase report and inventory history')

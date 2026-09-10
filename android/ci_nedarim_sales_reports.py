from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

def replace_method(src, signature, replacement):
    start=src.find(signature)
    if start<0: raise SystemExit('missing method: '+signature)
    brace=src.find('{',start)
    depth=0
    i=brace
    while i<len(src):
        if src[i]=='{': depth+=1
        elif src[i]=='}':
            depth-=1
            if depth==0:
                return src[:start]+replacement+src[i+1:]
        i+=1
    raise SystemExit('unclosed method: '+signature)

show_reports=r'''    private void showReports(){
        buildShell("דוחות",this::showAdminHome,false);
        Button sales=button("סיכום מכירות ומוצרים",blue,Color.WHITE);sales.setOnClickListener(v->showSalesHistoryNative());LinearLayout.LayoutParams sp=new LinearLayout.LayoutParams(-1,dp(64));sp.setMargins(0,0,0,dp(10));content.addView(sales,sp);
        Button purchases=button("דוח קניות",Color.WHITE,blue);purchases.setOnClickListener(v->showPurchaseReportFilters());LinearLayout.LayoutParams pp=new LinearLayout.LayoutParams(-1,dp(60));pp.setMargins(0,0,0,dp(10));content.addView(purchases,pp);
        Button inventory=button("היסטוריית התאמות מלאי",Color.WHITE,blue);inventory.setOnClickListener(v->loadInventoryReport());content.addView(inventory,new LinearLayout.LayoutParams(-1,dp(60)));
    }
'''
s=replace_method(s,'    private void showReports()',show_reports)

helpers=r'''
    private JSONArray salesReportSales=new JSONArray();
    private JSONArray salesReportItems=new JSONArray();
    private String salesReportFrom="",salesReportTo="",salesReportQuery="";
    private int salesReportPage=0;
    private int salesReportSort=0;
    private static final int SALES_PAGE_SIZE=50;

    private void showSalesHistoryNative(){
        buildShell("סיכום מכירות ומוצרים",this::showReports,false);
        TextView title=text("היסטוריית הכנסות",24,true);title.setGravity(Gravity.RIGHT);title.setPadding(0,dp(4),0,dp(10));content.addView(title);
        LinearLayout quick=new LinearLayout(this);quick.setOrientation(LinearLayout.HORIZONTAL);String[] qs={"היום","אתמול","החודש","חודש קודם","הכל"};for(String q:qs){Button b=button(q,Color.WHITE,blue);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(48),1);lp.setMargins(dp(2),0,dp(2),0);quick.addView(b,lp);b.setOnClickListener(v->applySalesQuickRange(q));}content.addView(quick);
        LinearLayout dates=new LinearLayout(this);dates.setOrientation(LinearLayout.HORIZONTAL);EditText from=input("מתאריך YYYY-MM-DD");EditText to=input("עד תאריך YYYY-MM-DD");from.setText(salesReportFrom);to.setText(salesReportTo);dates.addView(from,new LinearLayout.LayoutParams(0,dp(58),1));LinearLayout.LayoutParams tlp=new LinearLayout.LayoutParams(0,dp(58),1);tlp.setMargins(dp(8),0,0,0);dates.addView(to,tlp);content.addView(dates);
        EditText search=input("חיפוש לפי מוצר, אמצעי תשלום, אסמכתא או מספר עסקה");search.setText(salesReportQuery);content.addView(search);
        LinearLayout tools=new LinearLayout(this);Button run=button("הצג",blue,Color.WHITE);Button sort=button(salesReportSort==0?"מיון: חדש לישן":"מיון: סכום גבוה",Color.WHITE,blue);Button clear=button("נקה סינון",Color.WHITE,blue);tools.addView(run,new LinearLayout.LayoutParams(0,dp(52),1));LinearLayout.LayoutParams slp=new LinearLayout.LayoutParams(0,dp(52),1);slp.setMargins(dp(6),0,0,0);tools.addView(sort,slp);LinearLayout.LayoutParams clp=new LinearLayout.LayoutParams(0,dp(52),1);clp.setMargins(dp(6),0,0,0);tools.addView(clear,clp);content.addView(tools);
        run.setOnClickListener(v->{salesReportFrom=from.getText().toString().trim();salesReportTo=to.getText().toString().trim();salesReportQuery=search.getText().toString().trim();salesReportPage=0;loadNativeSalesReport();});
        sort.setOnClickListener(v->{salesReportSort=(salesReportSort+1)%4;salesReportPage=0;showSalesHistoryNative();if(salesReportSales.length()>0)renderNativeSalesReport();});
        clear.setOnClickListener(v->{salesReportFrom="";salesReportTo="";salesReportQuery="";salesReportSort=0;salesReportPage=0;showSalesHistoryNative();loadNativeSalesReport();});
        if(salesReportSales.length()>0)renderNativeSalesReport();else loadNativeSalesReport();
    }

    private String salesDate(java.util.Calendar c){return new SimpleDateFormat("yyyy-MM-dd",Locale.US).format(c.getTime());}
    private void applySalesQuickRange(String q){
        java.util.Calendar c=java.util.Calendar.getInstance();String from="",to="";
        if("היום".equals(q)){from=to=salesDate(c);}else if("אתמול".equals(q)){c.add(java.util.Calendar.DAY_OF_MONTH,-1);from=to=salesDate(c);}else if("החודש".equals(q)){to=salesDate(c);c.set(java.util.Calendar.DAY_OF_MONTH,1);from=salesDate(c);}else if("חודש קודם".equals(q)){c.set(java.util.Calendar.DAY_OF_MONTH,1);c.add(java.util.Calendar.DAY_OF_MONTH,-1);to=salesDate(c);c.set(java.util.Calendar.DAY_OF_MONTH,1);from=salesDate(c);}salesReportFrom=from;salesReportTo=to;salesReportPage=0;showSalesHistoryNative();loadNativeSalesReport();
    }

    private void loadNativeSalesReport(){
        io.execute(()->{try{
            String path="/rest/v1/sales?select=*&status=eq.paid&order=created_at.desc&limit=1000";
            if(!salesReportFrom.isEmpty())path+="&created_at=gte."+url(salesReportFrom+"T00:00:00");
            if(!salesReportTo.isEmpty()){java.text.SimpleDateFormat f=new java.text.SimpleDateFormat("yyyy-MM-dd",Locale.US);java.util.Calendar c=java.util.Calendar.getInstance();c.setTime(f.parse(salesReportTo));c.add(java.util.Calendar.DAY_OF_MONTH,1);path+="&created_at=lt."+url(f.format(c.getTime())+"T00:00:00");}
            JSONArray a=requestArray("GET",path,null,true);String ids="";for(int i=0;i<a.length();i++){String id=a.optJSONObject(i).optString("id");if(!id.isEmpty())ids+=(ids.isEmpty()?"":",")+id;}JSONArray items=new JSONArray();if(!ids.isEmpty())items=requestArray("GET","/rest/v1/sale_items?select=*&sale_id=in.("+ids+")",null,true);salesReportSales=a;salesReportItems=items;main.post(this::renderNativeSalesReport);
        }catch(Exception e){main.post(()->Toast.makeText(this,"טעינת סיכום המכירות נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}});
    }

    private java.util.List<JSONObject> filteredNativeSales(){
        java.util.List<JSONObject> out=new java.util.ArrayList<>();String q=salesReportQuery.toLowerCase(Locale.ROOT);
        for(int i=0;i<salesReportSales.length();i++){JSONObject sale=salesReportSales.optJSONObject(i);if(sale==null)continue;String hay=(sale.optString("id")+" "+sale.optString("payment_method")+" "+sale.optString("payment_reference")).toLowerCase(Locale.ROOT);for(int j=0;j<salesReportItems.length();j++){JSONObject it=salesReportItems.optJSONObject(j);if(it!=null&&sale.optString("id").equals(it.optString("sale_id")))hay+=" "+it.optString("product_name").toLowerCase(Locale.ROOT);}if(q.isEmpty()||hay.contains(q))out.add(sale);}
        java.util.Collections.sort(out,(a,b)->{if(salesReportSort==1)return a.optString("created_at").compareTo(b.optString("created_at"));if(salesReportSort==2)return Double.compare(b.optDouble("total_amount",0),a.optDouble("total_amount",0));if(salesReportSort==3)return Double.compare(a.optDouble("total_amount",0),b.optDouble("total_amount",0));return b.optString("created_at").compareTo(a.optString("created_at"));});return out;
    }

    private void renderNativeSalesReport(){
        java.util.List<JSONObject> rows=filteredNativeSales();double total=0;int units=0;java.util.Map<String,Integer> qty=new java.util.HashMap<>();java.util.Map<String,Double> revenue=new java.util.HashMap<>();for(JSONObject sale:rows)total+=sale.optDouble("total_amount",0);java.util.HashSet<String> allowed=new java.util.HashSet<>();for(JSONObject sale:rows)allowed.add(sale.optString("id"));for(int i=0;i<salesReportItems.length();i++){JSONObject it=salesReportItems.optJSONObject(i);if(it==null||!allowed.contains(it.optString("sale_id")))continue;String n=it.optString("product_name","מוצר");int q=it.optInt("quantity",0);double r=it.optDouble("line_total",it.optDouble("unit_price",0)*q);units+=q;qty.put(n,qty.getOrDefault(n,0)+q);revenue.put(n,revenue.getOrDefault(n,0.0)+r);}
        TextView summary=text("סה״כ הכנסות  "+String.format(Locale.US,"%.2f ₪",total)+"     |     "+rows.size()+" עסקאות     |     "+units+" יחידות",20,true);summary.setPadding(dp(14),dp(14),dp(14),dp(14));summary.setBackground(roundRect(Color.rgb(235,247,244),Color.rgb(198,224,217),1,12));content.addView(summary,new LinearLayout.LayoutParams(-1,dp(66)));
        if(!qty.isEmpty()){TextView ph=text("ריכוז לפי מוצרים",20,true);ph.setPadding(0,dp(18),0,dp(8));content.addView(ph);java.util.List<String> names=new java.util.ArrayList<>(qty.keySet());java.util.Collections.sort(names,(a,b)->Integer.compare(qty.get(b),qty.get(a)));int max=Math.min(names.size(),12);for(int i=0;i<max;i++){String n=names.get(i);TextView t=text(n+"   ·   "+qty.get(n)+" יח׳   ·   "+String.format(Locale.US,"%.2f ₪",revenue.get(n)),16,true);t.setPadding(dp(12),dp(8),dp(12),dp(8));content.addView(t);}}
        TextView hh=text("עסקאות",20,true);hh.setPadding(0,dp(18),0,dp(8));content.addView(hh);int pages=Math.max(1,(rows.size()+SALES_PAGE_SIZE-1)/SALES_PAGE_SIZE);if(salesReportPage>=pages)salesReportPage=pages-1;int start=salesReportPage*SALES_PAGE_SIZE,end=Math.min(rows.size(),start+SALES_PAGE_SIZE);TextView count=text(rows.isEmpty()?"אין תוצאות":"מציג "+(start+1)+"-"+end+" מתוך "+rows.size()+" · עמוד "+(salesReportPage+1)+" מתוך "+pages,15,false);content.addView(count);
        for(int i=start;i<end;i++){JSONObject sale=rows.get(i);LinearLayout card=card();card.setPadding(dp(14),dp(10),dp(14),dp(10));TextView amount=text(String.format(Locale.US,"%.2f ₪",sale.optDouble("total_amount",0)),22,true);card.addView(amount);String date=sale.optString("created_at").replace('T',' ');if(date.length()>16)date=date.substring(0,16);TextView meta=text(date+"   ·   "+sale.optString("payment_method","אשראי"),15,false);card.addView(meta);java.util.List<String> itemLines=new java.util.ArrayList<>();for(int j=0;j<salesReportItems.length();j++){JSONObject it=salesReportItems.optJSONObject(j);if(it!=null&&sale.optString("id").equals(it.optString("sale_id")))itemLines.add(it.optString("product_name","מוצר")+" × "+it.optInt("quantity",0));}TextView productsText=text(android.text.TextUtils.join("  |  ",itemLines),15,false);productsText.setPadding(0,dp(5),0,dp(5));card.addView(productsText);Button details=button("פתיחת עסקה",Color.WHITE,blue);details.setOnClickListener(v->showNativeSaleDetails(sale));card.addView(details,new LinearLayout.LayoutParams(-1,dp(46)));content.addView(card);}
        if(rows.size()>SALES_PAGE_SIZE){LinearLayout nav=new LinearLayout(this);Button prev=button("הקודם",Color.WHITE,blue),next=button("הבא",Color.WHITE,blue);prev.setEnabled(salesReportPage>0);next.setEnabled(salesReportPage<pages-1);prev.setOnClickListener(v->{salesReportPage--;showSalesHistoryNative();});next.setOnClickListener(v->{salesReportPage++;showSalesHistoryNative();});nav.addView(prev,new LinearLayout.LayoutParams(0,dp(52),1));LinearLayout.LayoutParams nlp=new LinearLayout.LayoutParams(0,dp(52),1);nlp.setMargins(dp(8),0,0,0);nav.addView(next,nlp);content.addView(nav);}
    }

    private void showNativeSaleDetails(JSONObject sale){
        LinearLayout box=baseRoot();box.setPadding(dp(14),dp(8),dp(14),dp(8));box.addView(text("סכום: "+String.format(Locale.US,"%.2f ₪",sale.optDouble("total_amount",0)),20,true));box.addView(text("תאריך: "+sale.optString("created_at").replace('T',' '),16,false));box.addView(text("אמצעי תשלום: "+sale.optString("payment_method",""),16,false));if(!sale.optString("payment_reference").isEmpty())box.addView(text("אסמכתא: "+sale.optString("payment_reference"),16,false));box.addView(text("מספר עסקה: "+sale.optString("id"),14,false));TextView h=text("מוצרים",18,true);h.setPadding(0,dp(12),0,dp(6));box.addView(h);for(int j=0;j<salesReportItems.length();j++){JSONObject it=salesReportItems.optJSONObject(j);if(it!=null&&sale.optString("id").equals(it.optString("sale_id"))){double line=it.optDouble("line_total",it.optDouble("unit_price",0)*it.optInt("quantity",0));box.addView(text(it.optString("product_name","מוצר")+" · "+it.optInt("quantity",0)+" × "+String.format(Locale.US,"%.2f ₪",it.optDouble("unit_price",0))+" = "+String.format(Locale.US,"%.2f ₪",line),15,false));}}new AlertDialog.Builder(this).setTitle("פרטי עסקה").setView(box).setPositiveButton("סגור",null).show();
    }

'''
marker='    private Spinner supplierSpinner()'
if marker not in s: raise SystemExit('supplier spinner marker missing')
s=s.replace(marker,helpers+marker,1)
p.write_text(s,encoding='utf-8')
print('Nedarim-style native sales reports applied')

from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text()
def replace_method(src,name,replacement):
    start=src.index('    private '+name)
    end=src.find('\n    private ',start+10)
    assert end>start,name
    return src[:start]+replacement+'\n'+src[end:]
s=replace_method(s,'void showSpecialSaleNative()', '')
anchor='card.addView(head);'
start=s.index('    private void renderPurchaseHistory(')
end=s.index('    private void showPurchaseDetails(',start)
b=s[start:end];assert anchor in b
b=b.replace(anchor,anchor+'if(!p.isNull("notes")&&!p.optString("notes").trim().isEmpty()){TextView note=text("הערות: "+p.optString("notes"),16,false);note.setPadding(dp(12),0,dp(12),dp(10));card.addView(note);}',1)
s=s[:start]+b+s[end:]
helpers=Path('android/admin_updates/helpers.java').read_text()
s=s.replace('    private Spinner supplierSpinner()',helpers+'\n    private Spinner supplierSpinner()',1)
# Native reports use the same compact row geometry as the web tables.
a=s.index('        for(int i=start;i<end;i++){JSONObject sale=rows.get(i);')
b=s.index('        if(rows.size()>SALES_PAGE_SIZE)',a)
s=s[:a]+r'''        content.addView(compactAdminRow(new String[]{"תאריך ושעה","סכום","כמות","אמצעי תשלום"},new float[]{2.2f,1.3f,.7f,1.4f},true,0));
        for(int i=start;i<end;i++){JSONObject sale=rows.get(i);int qty=0;for(int j=0;j<salesReportItems.length();j++){JSONObject item=salesReportItems.optJSONObject(j);if(item!=null&&sale.optString("id").equals(item.optString("sale_id")))qty+=item.optInt("quantity",0);}String date=sale.optString("created_at").replace('T',' ');if(date.length()>16)date=date.substring(0,16);LinearLayout row=compactAdminRow(new String[]{date,String.format(Locale.ROOT,"%.2f ₪",sale.optDouble("total_amount")),String.valueOf(qty),sale.optString("payment_method","אשראי")},new float[]{2.2f,1.3f,.7f,1.4f},false,i);row.setContentDescription("פתיחת עסקה "+date);row.setOnClickListener(v->showNativeSaleDetails(sale));content.addView(row);}
'''+s[b:]
old='TextView t=text(row,16,false);LinearLayout c=card();c.addView(t,new LinearLayout.LayoutParams(-1,-2));results.addView(c);'
new='if(i==0)results.addView(compactAdminRow(new String[]{"מוצר","מכירות","נמכר","לבית","עלות לבית","סה״כ יצא"},new float[]{2,1.3f,.8f,.8f,1.3f,1},true,0));results.addView(compactAdminRow(new String[]{x.optString("product_name"),String.format(Locale.ROOT,"%.2f ₪",x.optDouble("sales_amount")),String.valueOf(x.optLong("sold_qty")),String.valueOf(x.optLong("home_qty")),String.format(Locale.ROOT,"%.2f ₪",x.optDouble("home_cost")),String.valueOf(x.optLong("total_out_qty"))},new float[]{2,1.3f,.8f,.8f,1.3f,1},false,i));'
assert old in s
s=s.replace(old,new,1)

p.write_text(s)
print('Store admin notes and four pricing modes applied')

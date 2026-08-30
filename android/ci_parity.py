from pathlib import Path

path = Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
text = path.read_text(encoding='utf-8')

# Expand the native admin menu with website features that were still missing.
old_labels = '        String[] labels={"מוצרים וקטגוריות","מלאי","ספקים","רכישה חדשה","היסטוריית רכישות","דוחות"};'
new_labels = '        String[] labels={"מוצרים וקטגוריות","מלאי","ספקים","רכישה חדשה","היסטוריית רכישות","דוחות","מודעות","הודעות לקוחות","הכנסות והוצאות"};'
old_actions = '        Runnable[] actions={this::showProductsAdmin,this::showStockAdmin,this::showSuppliersAdmin,this::showNewPurchase,this::showPurchaseHistory,this::showReports};'
new_actions = '        Runnable[] actions={this::showProductsAdmin,this::showStockAdmin,this::showSuppliersAdmin,this::showNewPurchase,this::showPurchaseHistory,this::showReports,this::showAnnouncementsAdmin,this::showFeedbackAdmin,this::showFinanceAdmin};'
if old_labels in text:
    text = text.replace(old_labels, new_labels, 1)
if old_actions in text:
    text = text.replace(old_actions, new_actions, 1)

# Add customer feedback entry point and asynchronously load the two store announcements.
home_marker = '        TextView h=text("בחר קטגוריה",28,true);h.setGravity(Gravity.CENTER);h.setPadding(0,dp(24),0,dp(18));content.addView(h);'
if 'שליחת הערה לחנות' not in text:
    home_add = '''        Button feedback=button("💬  חסר מוצר? שליחת הערה לחנות",Color.WHITE,blue);feedback.setOnClickListener(v->openCustomerFeedbackDialog());LinearLayout.LayoutParams fbp=new LinearLayout.LayoutParams(-1,dp(58));fbp.setMargins(0,dp(10),0,dp(8));content.addView(feedback,fbp);\n        loadHomeAnnouncements();\n'''
    if home_marker not in text:
        raise SystemExit('Home marker not found')
    text = text.replace(home_marker, home_add + home_marker, 1)

helper_marker = '    private void showStockAdmin(){'
if 'private void loadHomeAnnouncements()' not in text:
    methods = r'''    private void loadHomeAnnouncements(){
        final LinearLayout target=content;
        io.execute(()->{try{
            JSONArray rows=requestArray("GET","/rest/v1/store_announcements?select=slot,content,is_active",null,false);
            final String[] top={""},bottom={""};
            for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if(!r.optBoolean("is_active",false))continue;String msg=r.optString("content","").trim();if(msg.isEmpty())continue;if("top".equals(r.optString("slot")))top[0]=msg;else if("bottom".equals(r.optString("slot")))bottom[0]=msg;}
            main.post(()->{if(content!=target)return;if(!top[0].isEmpty()){TextView a=text(top[0],18,true);a.setGravity(Gravity.CENTER);a.setPadding(dp(18),dp(14),dp(18),dp(14));a.setBackgroundColor(Color.WHITE);content.addView(a,0,new LinearLayout.LayoutParams(-1,-2));}if(!bottom[0].isEmpty()){TextView a=text(bottom[0],18,true);a.setGravity(Gravity.CENTER);a.setPadding(dp(18),dp(14),dp(18),dp(14));a.setBackgroundColor(Color.WHITE);content.addView(a,new LinearLayout.LayoutParams(-1,-2));}});
        }catch(Exception ignored){}});
    }

    private void openCustomerFeedbackDialog(){
        EditText msg=input("מוצר שחסר, בקשה או הערה");msg.setMinLines(4);msg.setGravity(Gravity.TOP|Gravity.RIGHT);
        new AlertDialog.Builder(this).setTitle("שליחת הערה לחנות").setView(msg).setNegativeButton("ביטול",null).setPositiveButton("שלח",(d,w)->{String value=msg.getText().toString().trim();if(value.length()<2){Toast.makeText(this,"כתוב את ההערה",Toast.LENGTH_LONG).show();return;}io.execute(()->{try{JSONObject b=new JSONObject();b.put("message",value);requestRaw("POST","/rest/v1/customer_feedback",b,false);main.post(()->Toast.makeText(this,"ההערה נשלחה. תודה!",Toast.LENGTH_LONG).show());}catch(Exception e){main.post(()->Toast.makeText(this,"שליחת ההערה נכשלה",Toast.LENGTH_LONG).show());}});}).show();
    }

    private void showAnnouncementsAdmin(){
        buildShell("מודעות",this::showAdminHome,false);
        io.execute(()->{try{JSONArray rows=requestArray("GET","/rest/v1/store_announcements?select=slot,content,is_active",null,true);String top="",bottom="";boolean ta=false,ba=false;for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if("top".equals(r.optString("slot"))){top=r.optString("content","");ta=r.optBoolean("is_active",false);}if("bottom".equals(r.optString("slot"))){bottom=r.optString("content","");ba=r.optBoolean("is_active",false);}}final String ft=top,fb=bottom;final boolean fta=ta,fba=ba;main.post(()->renderAnnouncementEditor(ft,fta,fb,fba));}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת המודעות נכשלה",Toast.LENGTH_LONG).show());}});
    }

    private void renderAnnouncementEditor(String top,boolean topActive,String bottom,boolean bottomActive){
        EditText topText=input("מודעה למעלה");topText.setMinLines(3);topText.setText(top);Spinner topOn=new Spinner(this);topOn.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"לא מוצג","מוצג"}));topOn.setSelection(topActive?1:0);
        EditText bottomText=input("מודעה למטה");bottomText.setMinLines(3);bottomText.setText(bottom);Spinner bottomOn=new Spinner(this);bottomOn.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"לא מוצג","מוצג"}));bottomOn.setSelection(bottomActive?1:0);
        content.addView(label("מודעה למעלה"));content.addView(topText);content.addView(topOn);content.addView(label("מודעה למטה"));content.addView(bottomText);content.addView(bottomOn);
        Button save=button("שמור מודעות",green,Color.WHITE);content.addView(save,new LinearLayout.LayoutParams(-1,dp(60)));save.setOnClickListener(v->io.execute(()->{try{JSONObject a=new JSONObject();a.put("content",topText.getText().toString().trim());a.put("is_active",topOn.getSelectedItemPosition()==1);requestRaw("PATCH","/rest/v1/store_announcements?slot=eq.top",a,true);JSONObject b=new JSONObject();b.put("content",bottomText.getText().toString().trim());b.put("is_active",bottomOn.getSelectedItemPosition()==1);requestRaw("PATCH","/rest/v1/store_announcements?slot=eq.bottom",b,true);main.post(()->Toast.makeText(this,"המודעות נשמרו",Toast.LENGTH_LONG).show());}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת המודעות נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}}));
    }

    private void showFeedbackAdmin(){
        buildShell("הודעות לקוחות",this::showAdminHome,false);
        io.execute(()->{try{JSONArray rows=requestArray("GET","/rest/v1/customer_feedback?select=*&order=created_at.desc",null,true);main.post(()->renderFeedbackAdmin(rows));}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת הודעות נכשלה",Toast.LENGTH_LONG).show());}});
    }

    private void renderFeedbackAdmin(JSONArray rows){
        if(rows.length()==0){content.addView(text("אין עדיין הודעות מלקוחות",21,true));return;}
        try{for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);String id=r.optString("id"),msg=r.optString("message"),created=r.optString("created_at"),prefix=r.optBoolean("is_read",false)?"הודעה":"● הודעה חדשה";LinearLayout c=card();TextView t=text(prefix+"\n"+created+"\n\n"+msg,17,true);c.addView(t);LinearLayout actions=new LinearLayout(this);if(!r.optBoolean("is_read",false)){Button read=button("סמן כנקרא",Color.WHITE,blue);read.setOnClickListener(v->io.execute(()->{try{JSONObject b=new JSONObject();b.put("is_read",true);requestRaw("PATCH","/rest/v1/customer_feedback?id=eq."+url(id),b,true);main.post(this::showFeedbackAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"העדכון נכשל",Toast.LENGTH_LONG).show());}}));actions.addView(read,new LinearLayout.LayoutParams(0,dp(50),1));}Button del=button("מחיקה",red,Color.WHITE);del.setOnClickListener(v->new AlertDialog.Builder(this).setMessage("למחוק את ההודעה?").setNegativeButton("לא",null).setPositiveButton("כן",(d,w)->io.execute(()->{try{requestRaw("DELETE","/rest/v1/customer_feedback?id=eq."+url(id),null,true);main.post(this::showFeedbackAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"מחיקת ההודעה נכשלה",Toast.LENGTH_LONG).show());}})).show());actions.addView(del,new LinearLayout.LayoutParams(0,dp(50),1));c.addView(actions);content.addView(c);}}catch(Exception e){Toast.makeText(this,"שגיאה בהצגת הודעות",Toast.LENGTH_LONG).show();}
    }

    private void showFinanceAdmin(){
        buildShell("הכנסות והוצאות",this::showAdminHome,false);
        Button add=button("+ הוספת תנועה",green,Color.WHITE);add.setOnClickListener(v->financeDialog(null));content.addView(add,new LinearLayout.LayoutParams(-1,dp(58)));
        io.execute(()->{try{JSONArray rows=requestArray("GET","/rest/v1/finance_entries?select=*&order=entry_date.desc,created_at.desc",null,true);main.post(()->renderFinanceRows(rows));}catch(Exception e){main.post(()->Toast.makeText(this,"טעינת הכנסות והוצאות נכשלה",Toast.LENGTH_LONG).show());}});
    }

    private void renderFinanceRows(JSONArray rows){
        try{double income=0,expense=0;for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);if("income".equals(r.optString("entry_type")))income+=r.optDouble("amount",0);else expense+=r.optDouble("amount",0);}TextView summary=text(String.format(Locale.US,"הכנסות: %.2f ₪   |   הוצאות: %.2f ₪   |   יתרה: %.2f ₪",income,expense,income-expense),19,true);summary.setGravity(Gravity.CENTER);summary.setPadding(0,dp(16),0,dp(16));content.addView(summary);
            for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);LinearLayout c=card();String typ="income".equals(r.optString("entry_type"))?"הכנסה":"הוצאה";String source="purchase".equals(r.optString("source_type"))?"רכישה אוטומטית":"ידני";TextView t=text(r.optString("entry_date")+" · "+typ+" · "+String.format(Locale.US,"%.2f ₪",r.optDouble("amount",0))+"\n"+r.optString("payment_method","")+" · "+source+"\n"+r.optString("description",""),17,true);c.addView(t);LinearLayout actions=new LinearLayout(this);Button edit=button("עריכה",Color.WHITE,blue);edit.setOnClickListener(v->financeDialog(r));actions.addView(edit,new LinearLayout.LayoutParams(0,dp(50),1));if(!"purchase".equals(r.optString("source_type"))){Button del=button("מחיקה",red,Color.WHITE);del.setOnClickListener(v->deleteFinanceEntry(r.optString("id")));actions.addView(del,new LinearLayout.LayoutParams(0,dp(50),1));}c.addView(actions);content.addView(c);}
        }catch(Exception e){Toast.makeText(this,"שגיאה בהצגת התנועות",Toast.LENGTH_LONG).show();}
    }

    private void financeDialog(JSONObject row){
        LinearLayout box=baseRoot();Spinner type=new Spinner(this);type.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"הוצאה","הכנסה"}));EditText amount=input("סכום");amount.setInputType(InputType.TYPE_CLASS_NUMBER|InputType.TYPE_NUMBER_FLAG_DECIMAL);EditText payment=input("אופן תשלום / סוג כסף");EditText date=input("תאריך YYYY-MM-DD");EditText desc=input("פירוט");box.addView(type);box.addView(amount);box.addView(payment);box.addView(date);box.addView(desc);if(row!=null){type.setSelection("income".equals(row.optString("entry_type"))?1:0);amount.setText(String.valueOf(row.optDouble("amount",0)));payment.setText(row.optString("payment_method",""));date.setText(row.optString("entry_date",today()));desc.setText(row.optString("description",""));}else date.setText(today());
        new AlertDialog.Builder(this).setTitle(row==null?"הוספת תנועה":"עריכת תנועה").setView(box).setNegativeButton("ביטול",null).setPositiveButton("שמור",(d,w)->io.execute(()->{try{JSONObject b=new JSONObject();b.put("entry_type",type.getSelectedItemPosition()==1?"income":"expense");b.put("amount",num(amount,0));b.put("payment_method",payment.getText().toString().trim());b.put("entry_date",date.getText().toString().trim().isEmpty()?today():date.getText().toString().trim());b.put("description",desc.getText().toString().trim());if(row==null){b.put("source_type","manual");requestRaw("POST","/rest/v1/finance_entries",b,true);}else requestRaw("PATCH","/rest/v1/finance_entries?id=eq."+url(row.optString("id")),b,true);main.post(this::showFinanceAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"שמירת התנועה נכשלה: "+safeMsg(e),Toast.LENGTH_LONG).show());}})).show();
    }

    private void deleteFinanceEntry(String id){
        new AlertDialog.Builder(this).setMessage("למחוק את התנועה?").setNegativeButton("לא",null).setPositiveButton("כן",(d,w)->io.execute(()->{try{requestRaw("DELETE","/rest/v1/finance_entries?id=eq."+url(id),null,true);main.post(this::showFinanceAdmin);}catch(Exception e){main.post(()->Toast.makeText(this,"מחיקת התנועה נכשלה",Toast.LENGTH_LONG).show());}})).show();
    }

'''
    if helper_marker not in text:
        raise SystemExit('Helper marker not found')
    text = text.replace(helper_marker, methods + helper_marker, 1)

path.write_text(text, encoding='utf-8')

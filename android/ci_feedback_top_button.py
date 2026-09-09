from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

method=r'''    private void openCustomerFeedback(){
        final EditText note=input("כתוב הערה לחנות");
        note.setMinLines(4);note.setGravity(Gravity.TOP|Gravity.RIGHT);
        AlertDialog dlg=new AlertDialog.Builder(this)
                .setTitle("שלח הערה לחנות")
                .setMessage("אפשר לכתוב מוצר שחסר, בקשה או הערה.")
                .setView(note)
                .setNegativeButton("ביטול",null)
                .setPositiveButton("שלח",null)
                .create();
        dlg.setOnShowListener(x->dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String msg=note.getText().toString().trim();
            if(msg.length()<2){Toast.makeText(this,"כתוב את ההערה",Toast.LENGTH_SHORT).show();return;}
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);
            io.execute(()->{try{
                JSONObject body=new JSONObject();body.put("message",msg);
                requestRaw("POST","/rest/v1/customer_feedback",body,false);
                main.post(()->{dlg.dismiss();Toast.makeText(this,"ההערה נשלחה. תודה!",Toast.LENGTH_LONG).show();});
            }catch(Exception e){main.post(()->{dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);Toast.makeText(this,"לא הצלחנו לשלוח. נסה שוב.",Toast.LENGTH_LONG).show();});}});
        }));
        dlg.show();
    }

'''
marker='    private void showHome(){'
if 'private void openCustomerFeedback()' not in s:
    if marker not in s: raise SystemExit('showHome marker not found')
    s=s.replace(marker,method+marker,1)

# Put a compact circular-ish feedback button in the fixed top bar, only on the main store screen.
needle='''        if(adminButton){\n            Button settings=button("⚙",Color.WHITE,blue);'''
insert='''        if("מערכת מכירה".equals(title)){\n            Button feedback=button("💬\\nשלח הערה",Color.rgb(237,247,249),Color.rgb(43,119,139));\n            feedback.setTextSize(11);feedback.setGravity(Gravity.CENTER);feedback.setAllCaps(false);\n            android.graphics.drawable.GradientDrawable feedbackBg=new android.graphics.drawable.GradientDrawable();feedbackBg.setShape(android.graphics.drawable.GradientDrawable.OVAL);feedbackBg.setColor(Color.rgb(237,247,249));feedbackBg.setStroke(dp(1),Color.rgb(43,119,139));feedback.setBackground(feedbackBg);\n            feedback.setOnClickListener(v->openCustomerFeedback());\n            LinearLayout.LayoutParams fp=new LinearLayout.LayoutParams(dp(74),dp(74));fp.setMargins(dp(6),0,dp(6),0);top.addView(feedback,fp);\n        }\n        if(adminButton){\n            Button settings=button("⚙",Color.WHITE,blue);'''
if 'Button feedback=button("💬\\nשלח הערה"' not in s:
    if needle not in s: raise SystemExit('top admin marker not found')
    s=s.replace(needle,insert,1)

p.write_text(s,encoding='utf-8')
print('Fixed top feedback button added to main screen')

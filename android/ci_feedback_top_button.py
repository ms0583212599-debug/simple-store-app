from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

method=r'''    private void openCustomerFeedback(){
        final EditText note=input("כתוב הערה לחנות");
        note.setMinLines(4);note.setGravity(Gravity.TOP|Gravity.RIGHT);
        AlertDialog dlg=new AlertDialog.Builder(this).setTitle("שלח הערה לחנות").setMessage("אפשר לכתוב מוצר שחסר, בקשה או הערה.").setView(note).setNegativeButton("ביטול",null).setPositiveButton("שלח",null).create();
        dlg.setOnShowListener(x->dlg.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
            String msg=note.getText().toString().trim();if(msg.length()<2){Toast.makeText(this,"כתוב את ההערה",Toast.LENGTH_SHORT).show();return;}
            dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(false);io.execute(()->{try{JSONObject body=new JSONObject();body.put("message",msg);requestRaw("POST","/rest/v1/customer_feedback",body,false);main.post(()->{dlg.dismiss();Toast.makeText(this,"ההערה נשלחה. תודה!",Toast.LENGTH_LONG).show();});}catch(Exception e){main.post(()->{dlg.getButton(AlertDialog.BUTTON_POSITIVE).setEnabled(true);Toast.makeText(this,"לא הצלחנו לשלוח. נסה שוב.",Toast.LENGTH_LONG).show();});}});
        }));dlg.show();
    }
    private void addFixedHomeFeedbackButton(){
        Button feedback=button("💬\nשלח הערה",Color.rgb(237,247,249),Color.rgb(43,119,139));feedback.setTextSize(11);feedback.setGravity(Gravity.CENTER);feedback.setAllCaps(false);feedback.setElevation(dp(8));
        android.graphics.drawable.GradientDrawable bg=new android.graphics.drawable.GradientDrawable();bg.setShape(android.graphics.drawable.GradientDrawable.OVAL);bg.setColor(Color.rgb(237,247,249));bg.setStroke(dp(1),Color.rgb(43,119,139));feedback.setBackground(bg);feedback.setOnClickListener(v->openCustomerFeedback());
        android.widget.FrameLayout.LayoutParams lp=new android.widget.FrameLayout.LayoutParams(dp(78),dp(78),Gravity.TOP|Gravity.LEFT);lp.setMargins(dp(14),dp(18),0,0);addContentView(feedback,lp);
    }

'''
marker='    private void showHome(){'
if 'private void openCustomerFeedback()' not in s:
    if marker not in s: raise SystemExit('showHome marker not found')
    s=s.replace(marker,method+marker,1)
home_start=s.find(marker);home_end=s.find('    private ',home_start+len(marker));home=s[home_start:home_end]
if 'addFixedHomeFeedbackButton();' not in home:
    idx=home.find('buildShell(');semi=home.find(';',idx)
    if idx<0 or semi<0: raise SystemExit('home buildShell call not found')
    home=home[:semi+1]+'addFixedHomeFeedbackButton();'+home[semi+1:];s=s[:home_start]+home+s[home_end:]
p.write_text(s,encoding='utf-8')
print('Fixed overlay feedback button added directly to home screen')

perf=Path('android/ci_performance_fast_checkout.py')
if perf.exists(): exec(compile(perf.read_text(encoding='utf-8'),str(perf),'exec'))
reports=Path('android/ci_nedarim_sales_reports.py')
if reports.exists(): exec(compile(reports.read_text(encoding='utf-8'),str(reports),'exec'))
keyboard_block=Path('android/ci_block_system_keyboard.py')
if keyboard_block.exists(): exec(compile(keyboard_block.read_text(encoding='utf-8'),str(keyboard_block),'exec'))

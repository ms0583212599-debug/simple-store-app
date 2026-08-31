from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')
# Force Android text fields not to invoke the tablet IME. The app keyboard is attached on focus.
needle='import android.widget.EditText;'
if needle in s and 'import android.text.InputType;' not in s:
    s=s.replace(needle, needle+'\nimport android.text.InputType;',1)

# Patch the common EditText factory when present. This covers customer/admin text fields created by the app.
for old in [
    'EditText e=new EditText(this);',
    'EditText e = new EditText(this);'
]:
    if old in s:
        new=old+'e.setShowSoftInputOnFocus(false);e.setOnFocusChangeListener((v,has)->{if(has)showAppKeyboard(e);});'
        s=s.replace(old,new)

marker='    private int dp(int v){'
if 'private void showAppKeyboard(EditText target)' not in s:
    code=r'''    private void showAppKeyboard(EditText target){
        final String[] mode={"HE"};
        LinearLayout box=new LinearLayout(this);box.setOrientation(LinearLayout.VERTICAL);box.setPadding(dp(8),dp(8),dp(8),dp(8));
        final AlertDialog[] holder=new AlertDialog[1];
        Runnable render=new Runnable(){public void run(){
            box.removeAllViews();
            String chars="HE".equals(mode[0])?"קראטוןםפשדגכעיחלךףזסבהנמצתץ":"abcdefghijklmnopqrstuvwxyz";
            if("123".equals(mode[0]))chars="1234567890";
            int cols="123".equals(mode[0])?5:10;
            for(int i=0;i<chars.length();i+=cols){LinearLayout row=new LinearLayout(MainActivity.this);row.setOrientation(LinearLayout.HORIZONTAL);for(int j=i;j<Math.min(i+cols,chars.length());j++){String k=String.valueOf(chars.charAt(j));Button b=button(k,Color.WHITE,Color.BLACK);b.setTextSize(18);b.setOnClickListener(v->{int a=Math.max(0,target.getSelectionStart()),z=Math.max(0,target.getSelectionEnd());target.getText().replace(Math.min(a,z),Math.max(a,z),k);});row.addView(b,new LinearLayout.LayoutParams(0,dp(52),1));}box.addView(row);}
            LinearLayout tools=new LinearLayout(MainActivity.this);tools.setOrientation(LinearLayout.HORIZONTAL);
            Button he=button("עברית",Color.WHITE,blue);he.setOnClickListener(v->{mode[0]="HE";run();});tools.addView(he,new LinearLayout.LayoutParams(0,dp(54),1));
            Button en=button("English",Color.WHITE,blue);en.setOnClickListener(v->{mode[0]="EN";run();});tools.addView(en,new LinearLayout.LayoutParams(0,dp(54),1));
            Button num=button("123",Color.WHITE,blue);num.setOnClickListener(v->{mode[0]="123";run();});tools.addView(num,new LinearLayout.LayoutParams(0,dp(54),1));
            Button space=button("רווח",Color.WHITE,blue);space.setOnClickListener(v->{int a=Math.max(0,target.getSelectionStart());target.getText().insert(a," ");});tools.addView(space,new LinearLayout.LayoutParams(0,dp(54),1));
            Button del=button("⌫",Color.WHITE,red);del.setOnClickListener(v->{int a=target.getSelectionStart(),z=target.getSelectionEnd();if(a!=z&&a>=0&&z>=0)target.getText().delete(Math.min(a,z),Math.max(a,z));else if(a>0)target.getText().delete(a-1,a);});tools.addView(del,new LinearLayout.LayoutParams(0,dp(54),1));
            box.addView(tools);
        }};render.run();
        holder[0]=new AlertDialog.Builder(this).setView(box).setNegativeButton("סגור",null).create();
        holder[0].setOnShowListener(x->{android.view.Window w=holder[0].getWindow();if(w!=null)w.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);});holder[0].show();
    }

'''
    if marker not in s: raise SystemExit('dp marker not found')
    s=s.replace(marker,code+marker,1)

p.write_text(s,encoding='utf-8')

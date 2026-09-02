from pathlib import Path

p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

needle='import android.widget.EditText;'
if needle in s and 'import android.text.InputType;' not in s:
    s=s.replace(needle, needle+'\nimport android.text.InputType;',1)

# Route all app-created text inputs through the internal keyboard and block the system IME.
for old in ['EditText e=new EditText(this);','EditText e = new EditText(this);']:
    if old in s and 'configureAppInput(e);' not in s:
        s=s.replace(old,old+'configureAppInput(e);',1)

marker='    private int dp(int v){'
old_start='    private void showAppKeyboard(EditText target){'
if old_start in s:
    a=s.index(old_start)
    b=s.index(marker,a)
    s=s[:a]+s[b:]

code=r'''    private void configureAppInput(EditText e){
        e.setShowSoftInputOnFocus(false);
        e.setOnClickListener(v->showAppKeyboard(e));
        e.setOnFocusChangeListener((v,has)->{if(has)showAppKeyboard(e);});
    }

    private void insertKey(EditText target,String value){
        int a=Math.max(0,target.getSelectionStart()),z=Math.max(0,target.getSelectionEnd());
        target.getText().replace(Math.min(a,z),Math.max(a,z),value);
        int pos=Math.min(a,z)+value.length();target.setSelection(Math.min(pos,target.length()));
    }

    private Button keyboardKey(String label,int bg,int fg){
        Button b=button(label,bg,fg);b.setTextSize(19);b.setAllCaps(false);b.setMinHeight(0);b.setMinimumHeight(0);b.setPadding(dp(2),0,dp(2),0);return b;
    }

    private void addKeyboardRow(LinearLayout box,EditText target,String[] keys,int bg){
        LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);row.setGravity(Gravity.CENTER);row.setPadding(dp(3),dp(2),dp(3),dp(2));
        for(String k:keys){Button b=keyboardKey(k,bg,Color.rgb(30,41,59));b.setOnClickListener(v->insertKey(target,k));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(0,dp(50),1);lp.setMargins(dp(3),0,dp(3),0);row.addView(b,lp);}box.addView(row);
    }

    private void showAppKeyboard(EditText target){
        Object tag=target.getTag();if(tag instanceof AlertDialog&&((AlertDialog)tag).isShowing())return;
        final String[] mode={"HE"};final boolean[] shift={false};final AlertDialog[] holder=new AlertDialog[1];
        LinearLayout shell=new LinearLayout(this);shell.setOrientation(LinearLayout.VERTICAL);shell.setBackgroundColor(Color.rgb(235,239,245));shell.setPadding(dp(8),dp(8),dp(8),dp(8));
        Runnable[] render=new Runnable[1];
        render[0]=()->{
            shell.removeAllViews();
            LinearLayout top=new LinearLayout(this);top.setOrientation(LinearLayout.HORIZONTAL);top.setGravity(Gravity.CENTER_VERTICAL);
            TextView title=text("מקלדת",14,true);title.setTextColor(Color.DKGRAY);top.addView(title,new LinearLayout.LayoutParams(0,dp(38),1));
            Button close=keyboardKey("סגור",Color.WHITE,blue);close.setOnClickListener(v->{if(holder[0]!=null)holder[0].dismiss();});top.addView(close,new LinearLayout.LayoutParams(dp(78),dp(38)));shell.addView(top);
            int keyBg=Color.WHITE;
            if("HE".equals(mode[0])){
                addKeyboardRow(shell,target,new String[]{"ק","ר","א","ט","ו","ן","ם","פ"},keyBg);
                addKeyboardRow(shell,target,new String[]{"ש","ד","ג","כ","ע","י","ח","ל","ך","ף"},keyBg);
                addKeyboardRow(shell,target,new String[]{"ז","ס","ב","ה","נ","מ","צ","ת","ץ"},keyBg);
            }else if("EN".equals(mode[0])){
                String[] r1={"q","w","e","r","t","y","u","i","o","p"};String[] r2={"a","s","d","f","g","h","j","k","l"};String[] r3={"z","x","c","v","b","n","m"};
                if(shift[0]){for(int i=0;i<r1.length;i++)r1[i]=r1[i].toUpperCase(Locale.ROOT);for(int i=0;i<r2.length;i++)r2[i]=r2[i].toUpperCase(Locale.ROOT);for(int i=0;i<r3.length;i++)r3[i]=r3[i].toUpperCase(Locale.ROOT);}
                addKeyboardRow(shell,target,r1,keyBg);addKeyboardRow(shell,target,r2,keyBg);
                LinearLayout row=new LinearLayout(this);row.setOrientation(LinearLayout.HORIZONTAL);Button sh=keyboardKey(shift[0]?"⇧":"↑",Color.rgb(214,221,232),Color.DKGRAY);sh.setOnClickListener(v->{shift[0]=!shift[0];render[0].run();});row.addView(sh,new LinearLayout.LayoutParams(0,dp(50),1.2f));for(String k:r3){Button b=keyboardKey(k,keyBg,Color.rgb(30,41,59));b.setOnClickListener(v->insertKey(target,((Button)v).getText().toString()));row.addView(b,new LinearLayout.LayoutParams(0,dp(50),1));}shell.addView(row);
            }else{
                addKeyboardRow(shell,target,new String[]{"1","2","3","4","5","6","7","8","9","0"},keyBg);
                addKeyboardRow(shell,target,new String[]{"-","/",":",";","(",")","₪","&","@","\""},keyBg);
                addKeyboardRow(shell,target,new String[]{".",",","?","!","'"},keyBg);
            }
            LinearLayout tools=new LinearLayout(this);tools.setOrientation(LinearLayout.HORIZONTAL);tools.setGravity(Gravity.CENTER);tools.setPadding(dp(3),dp(4),dp(3),dp(2));
            Button lang=keyboardKey("HE".equals(mode[0])?"EN":"HE",Color.rgb(214,221,232),Color.DKGRAY);lang.setOnClickListener(v->{mode[0]="HE".equals(mode[0])?"EN":"HE";shift[0]=false;render[0].run();});tools.addView(lang,new LinearLayout.LayoutParams(0,dp(52),1.15f));
            Button nums=keyboardKey("123",Color.rgb(214,221,232),Color.DKGRAY);nums.setOnClickListener(v->{mode[0]="123".equals(mode[0])?"HE":"123";render[0].run();});tools.addView(nums,new LinearLayout.LayoutParams(0,dp(52),1.15f));
            Button comma=keyboardKey(",",Color.WHITE,Color.DKGRAY);comma.setOnClickListener(v->insertKey(target,","));tools.addView(comma,new LinearLayout.LayoutParams(0,dp(52),.75f));
            Button space=keyboardKey("רווח",Color.WHITE,Color.DKGRAY);space.setOnClickListener(v->insertKey(target," "));tools.addView(space,new LinearLayout.LayoutParams(0,dp(52),4f));
            Button dot=keyboardKey(".",Color.WHITE,Color.DKGRAY);dot.setOnClickListener(v->insertKey(target,"."));tools.addView(dot,new LinearLayout.LayoutParams(0,dp(52),.75f));
            Button del=keyboardKey("⌫",Color.rgb(214,221,232),red);del.setOnClickListener(v->{int a=target.getSelectionStart(),z=target.getSelectionEnd();if(a!=z&&a>=0&&z>=0)target.getText().delete(Math.min(a,z),Math.max(a,z));else if(a>0)target.getText().delete(a-1,a);});tools.addView(del,new LinearLayout.LayoutParams(0,dp(52),1.25f));
            Button enter=keyboardKey("↵",blue,Color.WHITE);enter.setOnClickListener(v->{if(target.isSingleLine()){if(holder[0]!=null)holder[0].dismiss();target.clearFocus();}else insertKey(target,"\n");});tools.addView(enter,new LinearLayout.LayoutParams(0,dp(52),1.25f));shell.addView(tools);
        };
        render[0].run();
        holder[0]=new AlertDialog.Builder(this).setView(shell).create();target.setTag(holder[0]);
        holder[0].setOnDismissListener(d->target.setTag(null));holder[0].setOnShowListener(x->{android.view.Window w=holder[0].getWindow();if(w!=null){w.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);w.setGravity(Gravity.BOTTOM);w.setLayout(android.view.WindowManager.LayoutParams.MATCH_PARENT,android.view.WindowManager.LayoutParams.WRAP_CONTENT);}});holder[0].show();android.view.Window w=holder[0].getWindow();if(w!=null){w.setGravity(Gravity.BOTTOM);w.setLayout(android.view.WindowManager.LayoutParams.MATCH_PARENT,android.view.WindowManager.LayoutParams.WRAP_CONTENT);}
    }

'''
if marker not in s: raise SystemExit('dp marker not found')
s=s.replace(marker,code+marker,1)
p.write_text(s,encoding='utf-8')

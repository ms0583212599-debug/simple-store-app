from pathlib import Path
p=Path('android/app/src/main/java/com/simplestore/tablet/MainActivity.java')
s=p.read_text(encoding='utf-8')

# Force the activity window to remain in an IME-hidden state.
on='''        getWindow().setStatusBarColor(Color.WHITE);'''
if on in s and 'SOFT_INPUT_STATE_ALWAYS_HIDDEN' not in s:
    s=s.replace(on,on+'''\n        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN|android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);''',1)

# Add a hard hide helper and touch dispatcher so WebView/input focus cannot leave the tablet keyboard up.
marker='    private LinearLayout baseRoot(){'
code=r'''    private void hideSystemKeyboardHard(){
        try{
            android.view.inputmethod.InputMethodManager imm=(android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE);
            android.view.View v=getCurrentFocus();if(v==null)v=getWindow().getDecorView();
            if(imm!=null&&v!=null)imm.hideSoftInputFromWindow(v.getWindowToken(),android.view.inputmethod.InputMethodManager.HIDE_NOT_ALWAYS);
            getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN|android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
            if(android.os.Build.VERSION.SDK_INT>=30&&getWindow().getInsetsController()!=null)getWindow().getInsetsController().hide(android.view.WindowInsets.Type.ime());
        }catch(Exception ignored){}
    }
    @Override public boolean dispatchTouchEvent(android.view.MotionEvent ev){
        boolean handled=super.dispatchTouchEvent(ev);
        if(ev.getAction()==android.view.MotionEvent.ACTION_DOWN||ev.getAction()==android.view.MotionEvent.ACTION_UP){
            hideSystemKeyboardHard();main.postDelayed(this::hideSystemKeyboardHard,40);main.postDelayed(this::hideSystemKeyboardHard,180);
        }
        return handled;
    }

'''
if 'private void hideSystemKeyboardHard()' not in s:
    if marker not in s: raise SystemExit('baseRoot marker missing')
    s=s.replace(marker,code+marker,1)

# Strengthen every app EditText created through the shared input helper.
needle='private void configureAppInput(EditText e){e.setShowSoftInputOnFocus(false);'
if needle in s:
    s=s.replace(needle,'private void configureAppInput(EditText e){e.setShowSoftInputOnFocus(false);e.setOnEditorActionListener((v,a,event)->{hideSystemKeyboardHard();return false;});',1)

# Strengthen payment WebView specifically, where iframe focus can request the Android IME.
pay='paymentWebView=new WebView(this);'
if pay in s and 'paymentWebView.setOnFocusChangeListener' not in s:
    s=s.replace(pay,pay+'paymentWebView.setOnFocusChangeListener((v,has)->{if(has){hideSystemKeyboardHard();main.postDelayed(this::hideSystemKeyboardHard,100);}});',1)

p.write_text(s,encoding='utf-8')
print('System keyboard suppression applied')

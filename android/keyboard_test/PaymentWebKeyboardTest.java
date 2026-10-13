package com.simplestore.keyboardtest;
import android.app.*;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import android.os.SystemClock;
import java.lang.reflect.*;
import java.util.concurrent.*;
import org.json.*;

/** Offline synthetic DOM. No actual customer, card or transaction data. */
final class PaymentWebKeyboardTest {
 static Instrumentation inst;static Activity activity;static Class<?> owner;static WebView web;static int touchCount=0;
 interface Work {void run()throws Exception;}
 static void main(Work work)throws Exception{Throwable[] e={null};inst.runOnMainSync(()->{try{work.run();}catch(Throwable t){e[0]=t;}});if(e[0]!=null)throw new Exception(e[0]);}
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static Field field(String name)throws Exception{Field f=owner.getDeclaredField(name);f.setAccessible(true);return f;}
 static String js(String script)throws Exception{CountDownLatch latch=new CountDownLatch(1);String[] out={null};main(()->web.evaluateJavascript(script,v->{out[0]=v;latch.countDown();}));check(latch.await(8,TimeUnit.SECONDS),"JS timeout");return out[0];}
 static Button button(View v,String label){if(v instanceof Button&&label.contentEquals(((Button)v).getText()))return (Button)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){Button b=button(g.getChildAt(i),label);if(b!=null)return b;}}return null;}
 static AlertDialog dialog()throws Exception{Object target=field("paymentKeyboardInput").get(activity);return target==null?null:(AlertDialog)((EditText)target).getTag();}
 static void key(String label)throws Exception{main(()->{AlertDialog d=dialog();check(d!=null&&d.isShowing(),"Dedicated keyboard missing before key "+label);Button b=button(d.getWindow().getDecorView(),label);check(b!=null,"Key missing: "+label);b.performClick();});Thread.sleep(100);}
 static final String VISUAL_SCALE="var probe=document.createElement('div');probe.style.cssText='position:absolute;width:100px;height:0;pointer-events:none';document.body.appendChild(probe);var factor=100*parseFloat(document.body.style.zoom||1)/probe.getBoundingClientRect().width;probe.remove();";
 static void tap(String id)throws Exception{
  JSONArray xy=new JSONArray(js("(function(){"+VISUAL_SCALE+"var r=document.getElementById("+JSONObject.quote(id)+").getBoundingClientRect();return [factor*(r.left+r.width/2),factor*(r.top+r.height/2)]})()"));
  int[] loc=new int[2];float[] density={1};main(()->{web.requestFocus();web.getLocationOnScreen(loc);density[0]=web.getResources().getDisplayMetrics().density;});
  float x=loc[0]+(float)xy.getDouble(0)*density[0],y=loc[1]+(float)xy.getDouble(1)*density[0];long t=SystemClock.uptimeMillis();
  System.out.println("Fixture tap: "+id+" x="+x+" y="+y+" local="+xy);
  MotionEvent down=MotionEvent.obtain(t,t,MotionEvent.ACTION_DOWN,x,y,0);down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);inst.sendPointerSync(down);Thread.sleep(80);MotionEvent up=MotionEvent.obtain(t,SystemClock.uptimeMillis(),MotionEvent.ACTION_UP,x,y,0);up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);inst.sendPointerSync(up);Thread.sleep(700);
  System.out.println("Fixture native touch events="+touchCount);
  screenshot("payment-tap.png");
  System.out.println("Fixture focus: "+js("JSON.stringify({active:document.activeElement.id,keyboard:typeof window.__storePaymentKey,bridge:typeof StorePaymentKeyboard,error:window.fixtureError||'',width:innerWidth,dpr:devicePixelRatio,events:window.fixtureEvents})"));
  if(!id.equals(new JSONArray("["+js("document.activeElement.id")+"]").getString(0))&&!"amount".equals(id)&&!"MosadName".equals(id)){
    js("document.getElementById("+JSONObject.quote(id)+").focus()");Thread.sleep(400);
    System.out.println("Fixture programmatic focus: "+js("JSON.stringify({active:document.activeElement.id,error:window.fixtureError||''})"));
    main(()->{System.out.println("Fixture native dialog: "+(dialog()!=null));});
    main(()->System.out.println("Fixture window focus="+activity.hasWindowFocus()+" web focus="+web.hasFocus()+" attached="+web.isAttachedToWindow()));
    throw new AssertionError("Native tap did not focus requested fixture field");
  }
 }
 static void checkIme()throws Exception{main(()->{check(!web.onCheckIsTextEditor(),"WebView advertises system editor");check(web.onCreateInputConnection(new android.view.inputmethod.EditorInfo())==null,"System IME connection created");WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();check(insets==null||!insets.isVisible(WindowInsets.Type.ime()),"Tablet IME became visible");});}
 static boolean systemImeShown()throws Exception{
  android.os.ParcelFileDescriptor fd=inst.getUiAutomation().executeShellCommand("dumpsys input_method");
  java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();
  try(java.io.InputStream in=new android.os.ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
  return out.toString("UTF-8").contains("mInputShown=true");
 }
 static void proveImeAvailable()throws Exception{
  final AlertDialog[] d={null};final EditText[] e={null};
  main(()->{e[0]=new EditText(activity);d[0]=new AlertDialog.Builder(activity).setView(e[0]).create();d[0].show();d[0].getWindow().clearFlags(WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM|WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE);e[0].requestFocus();});
  Thread.sleep(400);
  main(()->((android.view.inputmethod.InputMethodManager)activity.getSystemService(Activity.INPUT_METHOD_SERVICE)).showSoftInput(e[0],android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT));
  Thread.sleep(700);check(systemImeShown(),"Positive control: emulator system IME did not open");
  main(()->{((android.view.inputmethod.InputMethodManager)activity.getSystemService(Activity.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(e[0].getWindowToken(),0);d[0].dismiss();});Thread.sleep(500);
  check(!systemImeShown(),"Positive-control keyboard remained visible");
  System.out.println("Positive control: real system keyboard opened and closed.");
 }
 static void challengeIme()throws Exception{
  main(()->{
   check((activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM)!=0,"Activity permits system IME targeting");
   ((android.view.inputmethod.InputMethodManager)activity.getSystemService(Activity.INPUT_METHOD_SERVICE)).showSoftInput(web,android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
  });
  for(int n=0;n<4;n++){check(!systemImeShown(),"System keyboard appeared despite payment window exclusion");Thread.sleep(80);}
  checkIme();
 }
 static void regularPayment()throws Exception{
  main(()->{Method show=owner.getDeclaredMethod("showPayment");show.setAccessible(true);show.invoke(activity);web=(WebView)field("paymentWebView").get(activity);web.stopLoading();web.removeJavascriptInterface("Android");web.setWebViewClient(new WebViewClient());web.loadDataWithBaseURL("https://www.matara.pro/","<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body style='margin:0'><input id='number' type='tel' style='width:200px;height:42px;font-size:20px'></body></html>","text/html","UTF-8",null);});
  Thread.sleep(700);
  main(()->{Method mode=owner.getDeclaredMethod("setPaymentInputMode",boolean.class);mode.setAccessible(true);mode.invoke(activity,false);});Thread.sleep(300);
  tap("number");challengeIme();
  for(String digit:new String[]{"1","2","3","⌫"}){main(()->{Button b=button((View)field("paymentKeyboardPanel").get(activity),digit);check(b!=null,"Regular payment dedicated key missing");b.performClick();});Thread.sleep(90);}
  check("\"12\"".equals(js("document.getElementById('number').value")),"Regular payment native digit/delete events failed");
  challengeIme();screenshot("payment-regular.png");
 }
 static void fit()throws Exception{
  JSONObject m=new JSONObject(js("({zoom:parseFloat(document.body.style.zoom||1),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:innerHeight})"));
  check(m.getDouble("zoom")==1,"Payment page was shrunk");
  check(m.getDouble("scrollWidth")<=m.getDouble("width")+2,"Payment page overflows horizontally");
 }
 static int webHeight()throws Exception{int[] height={0};main(()->height[0]=web.getHeight());return height[0];}
 static void automaticConfirmation()throws Exception{
  main(()->{
   Method open=owner.getDeclaredMethod("openNedarimDirectPaymentPage",double.class);open.setAccessible(true);
   field("customerOnlineActive").setBoolean(activity,true);field("saleToken").set(activity,"fixture-auto-order-123456");open.invoke(activity,1.25);
   Method accept=owner.getDeclaredMethod("acceptCustomerOnlineResult",int.class,String.class,String.class);accept.setAccessible(true);
   int generation=field("customerOnlinePollGeneration").getInt(activity);String token="fixture-auto-order-123456";
   check(field("customerOnlinePoll").get(activity)!=null,"Automatic check timer missing");
   check(!(Boolean)accept.invoke(activity,generation,"another-order-123456","paid"),"Wrong order accepted");
   check(!(Boolean)accept.invoke(activity,generation-1,token,"paid"),"Stale confirmation accepted");
   check(!(Boolean)accept.invoke(activity,generation,token,"pending"),"Pending result completed purchase");
   check(field("customerOnlineActive").getBoolean(activity),"Pending result closed purchase");
   check((Boolean)accept.invoke(activity,generation,token,"paid"),"Current server confirmation not accepted");
   check(!(Boolean)accept.invoke(activity,generation,token,"paid"),"Duplicate confirmation accepted");
   check(field("customerOnlinePoll").get(activity)==null,"Polling survived approval");
   field("customerOnlineActive").setBoolean(activity,true);open.invoke(activity,1.25);
   generation=field("customerOnlinePollGeneration").getInt(activity);
   Method leave=owner.getDeclaredMethod("showCart");leave.setAccessible(true);leave.invoke(activity);
   check(field("customerOnlinePoll").get(activity)==null,"Polling survived leaving checkout");
   check(!(Boolean)accept.invoke(activity,generation,token,"paid"),"Late confirmation after exit accepted");
  });
 }
 static void screenshot(String path)throws Exception{java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(inst.getTargetContext().getCacheDir(),path));inst.getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);out.close();}
 static void run(Instrumentation i,Activity a,Class<?> c)throws Exception{
  inst=i;activity=a;owner=c;
  main(()->{web=(WebView)field("directPaymentPage").get(activity);WebViewClient original=web.getWebViewClient();web.stopLoading();web.setOnTouchListener((v,e)->{touchCount++;return false;});web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){try{return new WebResourceResponse("text/html","UTF-8",inst.getContext().getAssets().open("payment-fixture.html"));}catch(Exception e){throw new RuntimeException(e);}}
   @Override public void onPageStarted(WebView w,String u,android.graphics.Bitmap b){original.onPageStarted(w,u,b);}
   @Override public void onPageFinished(WebView w,String u){original.onPageFinished(w,u);}
  });web.loadUrl("https://www.matara.pro/nedarimplus/online/?fixture=1");});
  Thread.sleep(2000);proveImeAvailable();fit();checkIme();
  check("true".equals(js("getComputedStyle(document.getElementById('PayModeGpayBt')).display==='none'&&getComputedStyle(document.getElementById('PayModeCardBt')).display==='none'")),"Provider payment-mode tiles remain visible");
  js("document.getElementById('PayModeGpayBt').style.display='flex'");
  check("\"none\"".equals(js("getComputedStyle(document.getElementById('PayModeGpayBt')).display")),"Provider update re-enabled Google Pay");
  screenshot("payment-form.png");
  int originalHeight=webHeight();
  tap("name");key("ש");key("HE");key("Aa");key("A");key("B");key("⌫");key("C");
  check("\"שAC\"".equals(js("document.getElementById('name').value")),"Hebrew/uppercase/delete insertion failed");
  fit();challengeIme();check(webHeight()==originalHeight,"Keyboard resized payment page");screenshot("payment-keyboard.png");
  tap("MosadName");main(()->check(dialog()==null,"Background tap did not dismiss keyboard"));
  tap("name");main(()->check(dialog()!=null,"Field tap did not reopen keyboard"));key("Go");
  tap("email");key("a");key("@");key("b");key(".");key("c");key("Go");
  check("\"a@b.c\"".equals(js("document.getElementById('email').value")),"Email entry failed");
  tap("number");key("1");key("2");key("3");key("4");key("5");
  check("\"1234\"".equals(js("document.getElementById('number').value")),"maxlength not respected");
  js("document.getElementById('number').setSelectionRange(1,3)");key("9");
  check("\"194\"".equals(js("document.getElementById('number').value")),"Selected text not replaced");
  key("Go");checkIme();tap("amount");main(()->check(dialog()==null,"Readonly amount opened keyboard"));
  check("\"1.25\"".equals(js("document.getElementById('amount').value")),"Readonly amount changed");
  check("true".equals(js("inputs>0&&keys>0&&changes>0&&!window.submitted")),"Provider events absent or unexpected submission");
  js("StorePaymentKeyboard.open('forged-nonce','NUM')");Thread.sleep(100);main(()->check(dialog()==null,"Untrusted bridge request opened keyboard"));
  js("var alert=document.createElement('div');alert.style.height='600px';document.getElementById('FormDiv').appendChild(alert)");Thread.sleep(300);fit();
  check("true".equals(js("document.documentElement.scrollHeight>innerHeight")),"Expanded card details cannot scroll");
  js("window.scrollTo(0,200)");Thread.sleep(150);
  check("true".equals(js("window.scrollY>0&&parseFloat(document.body.style.zoom)===1")),"Expanded form shrank or refused scrolling");
  js("window.scrollTo(0,0)");
  main(()->activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));Thread.sleep(1200);fit();checkIme();
  tap("name");key("ש");key("Go");
  main(()->activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));Thread.sleep(1200);fit();
  main(()->{Method m=owner.getDeclaredMethod("showCart");m.setAccessible(true);m.invoke(activity);check(field("directPaymentPage").get(activity)==null,"Payment WebView survived leaving checkout");check(dialog()==null,"Keyboard survived leaving checkout");});
  regularPayment();automaticConfirmation();
 }
}

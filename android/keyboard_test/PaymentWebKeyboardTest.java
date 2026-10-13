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
 static Instrumentation inst;static Activity activity;static Class<?> owner;static WebView web;
 interface Work {void run()throws Exception;}
 static void main(Work work)throws Exception{Throwable[] e={null};inst.runOnMainSync(()->{try{work.run();}catch(Throwable t){e[0]=t;}});if(e[0]!=null)throw new Exception(e[0]);}
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static Field field(String name)throws Exception{Field f=owner.getDeclaredField(name);f.setAccessible(true);return f;}
 static String js(String script)throws Exception{CountDownLatch latch=new CountDownLatch(1);String[] out={null};main(()->web.evaluateJavascript(script,v->{out[0]=v;latch.countDown();}));check(latch.await(8,TimeUnit.SECONDS),"JS timeout");return out[0];}
 static Button button(View v,String label){if(v instanceof Button&&label.contentEquals(((Button)v).getText()))return (Button)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){Button b=button(g.getChildAt(i),label);if(b!=null)return b;}}return null;}
 static AlertDialog dialog()throws Exception{Object target=field("paymentKeyboardInput").get(activity);return target==null?null:(AlertDialog)((EditText)target).getTag();}
 static void key(String label)throws Exception{main(()->{AlertDialog d=dialog();check(d!=null&&d.isShowing(),"Dedicated keyboard missing before key "+label);Button b=button(d.getWindow().getDecorView(),label);check(b!=null,"Key missing: "+label);b.performClick();});Thread.sleep(100);}
 static void tap(String id)throws Exception{
  JSONArray xy=new JSONArray(js("(function(){var r=document.getElementById("+JSONObject.quote(id)+").getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()"));
  int[] loc=new int[2];float[] density={1};main(()->{web.requestFocus();web.getLocationOnScreen(loc);density[0]=web.getResources().getDisplayMetrics().density;});
  float x=loc[0]+(float)xy.getDouble(0)*density[0],y=loc[1]+(float)xy.getDouble(1)*density[0];long t=SystemClock.uptimeMillis();
  System.out.println("Fixture tap: "+id+" x="+x+" y="+y+" local="+xy);
  MotionEvent down=MotionEvent.obtain(t,t,MotionEvent.ACTION_DOWN,x,y,0);down.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);inst.sendPointerSync(down);Thread.sleep(80);MotionEvent up=MotionEvent.obtain(t,SystemClock.uptimeMillis(),MotionEvent.ACTION_UP,x,y,0);up.setSource(android.view.InputDevice.SOURCE_TOUCHSCREEN);inst.sendPointerSync(up);Thread.sleep(650);
  screenshot("payment-tap.png");
  System.out.println("Fixture focus: "+js("JSON.stringify({active:document.activeElement.id,keyboard:typeof window.__storePaymentKey,bridge:typeof StorePaymentKeyboard,error:window.fixtureError||'',width:innerWidth,dpr:devicePixelRatio,events:window.fixtureEvents})"));
  if(!id.equals(new JSONArray("["+js("document.activeElement.id")+"]").getString(0))&&!"amount".equals(id)){
    js("document.getElementById("+JSONObject.quote(id)+").focus()");Thread.sleep(400);
    System.out.println("Fixture programmatic focus: "+js("JSON.stringify({active:document.activeElement.id,error:window.fixtureError||''})"));
    main(()->{System.out.println("Fixture native dialog: "+(dialog()!=null));});
    throw new AssertionError("Native tap did not focus requested fixture field");
  }
 }
 static void checkIme()throws Exception{main(()->{check(!web.onCheckIsTextEditor(),"WebView advertises system editor");check(web.onCreateInputConnection(new android.view.inputmethod.EditorInfo())==null,"System IME connection created");WindowInsets insets=activity.getWindow().getDecorView().getRootWindowInsets();check(insets==null||!insets.isVisible(WindowInsets.Type.ime()),"Tablet IME became visible");});}
 static void fit()throws Exception{check("true".equals(js("(function(){return document.getElementById('footer').getBoundingClientRect().bottom<=innerHeight+3&&document.getElementById('MainDiv').getBoundingClientRect().right<=innerWidth+3})()")),"Payment form does not fit viewport");}
 static void screenshot(String path)throws Exception{java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(inst.getTargetContext().getCacheDir(),path));inst.getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG,100,out);out.close();}
 static void run(Instrumentation i,Activity a,Class<?> c)throws Exception{
  inst=i;activity=a;owner=c;
  main(()->{web=(WebView)field("directPaymentPage").get(activity);WebViewClient original=web.getWebViewClient();web.stopLoading();web.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView w,WebResourceRequest r){try{return new WebResourceResponse("text/html","UTF-8",inst.getContext().getAssets().open("payment-fixture.html"));}catch(Exception e){throw new RuntimeException(e);}}
   @Override public void onPageStarted(WebView w,String u,android.graphics.Bitmap b){original.onPageStarted(w,u,b);}
   @Override public void onPageFinished(WebView w,String u){original.onPageFinished(w,u);}
  });web.loadUrl("https://www.matara.pro/nedarimplus/online/?fixture=1");});
  Thread.sleep(2000);fit();checkIme();screenshot("payment-form.png");
  tap("name");key("ש");key("HE");key("Aa");key("A");key("B");key("⌫");key("C");
  check("\"שAC\"".equals(js("document.getElementById('name').value")),"Hebrew/uppercase/delete insertion failed");
  fit();checkIme();screenshot("payment-keyboard.png");key("Go");
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
  js("var alert=document.createElement('div');alert.style.height='180px';document.getElementById('FormDiv').appendChild(alert)");Thread.sleep(300);fit();
  main(()->activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));Thread.sleep(1200);fit();checkIme();
  tap("name");key("ש");key("Go");
  main(()->activity.setRequestedOrientation(android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));Thread.sleep(1200);fit();
  main(()->{Method m=owner.getDeclaredMethod("showCart");m.setAccessible(true);m.invoke(activity);check(field("directPaymentPage").get(activity)==null,"Payment WebView survived leaving checkout");check(dialog()==null,"Keyboard survived leaving checkout");});
 }
}

package com.simplestore.keyboardtest;
import android.app.*;
import android.content.Intent;
import android.os.Bundle;
import android.widget.EditText;
import android.view.*;
import java.lang.reflect.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.json.JSONObject;

/** Uses synthetic settings only; emulator web traffic is blocked before launch. */
public final class PaymentSettingsInstrumentation extends Instrumentation {
 private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 private static Field field(Class<?> c,String name)throws Exception{Field f=c.getDeclaredField(name);f.setAccessible(true);return f;}
 private static Method method(Class<?> c,String name,Class<?>... types)throws Exception{Method m=c.getDeclaredMethod(name,types);m.setAccessible(true);return m;}
 private static JSONObject row(String mosad,String api,Object group,boolean visible)throws Exception{
  return new JSONObject().put("mosad",mosad).put("api_valid",api).put("groupe",group).put("show_customer_payment_page",visible);
 }
 private static android.webkit.WebView web(View v){if(v instanceof android.webkit.WebView)return (android.webkit.WebView)v;if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++){android.webkit.WebView w=web(g.getChildAt(i));if(w!=null)return w;}}return null;}
 private static boolean hasInput(View v,String value){
  if(v instanceof EditText&&value.contentEquals(((EditText)v).getText()))return true;
  if(v instanceof ViewGroup){ViewGroup g=(ViewGroup)v;for(int i=0;i<g.getChildCount();i++)if(hasInput(g.getChildAt(i),value))return true;}
  return false;
 }
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 @Override public void onStart(){
  Bundle result=new Bundle();
  try{
   Intent intent=new Intent().setClassName("com.simplestore.tablet","com.simplestore.tablet.KioskActivity").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
   Activity activity=startActivitySync(intent);Class<?> c=activity.getClass().getSuperclass();
   Method apply=method(c,"applySharedNedarimSettings",JSONObject.class);
   Method refresh=method(c,"refreshNedarimSettings",Runnable.class,boolean.class,boolean.class);
   Field pending=field(c,"nedarimSettingsActionPending");AtomicInteger continued=new AtomicInteger();
   final Throwable[] error={null};
   runOnMainSync(()->{try{
    // Invalidate the launch request so it cannot overwrite a newer action.
    Field revision=field(c,"nedarimSettingsRevision");revision.setInt(activity,revision.getInt(activity)+1);
    apply.invoke(activity,row("1111111","synthetic-old","old-group",false));
    apply.invoke(activity,row("2222222","synthetic-new","new-group",true));
    check("2222222".equals(field(c,"paymentMosad").get(activity)),"Website institution did not replace old account");
    check("synthetic-new".equals(field(c,"paymentApiValid").get(activity)),"Website public API setting not applied");
    check("new-group".equals(field(c,"paymentGroupe").get(activity)),"Website group not applied");
    check(field(c,"showCustomerPaymentPage").getBoolean(activity),"Website visibility not applied");
    method(c,"renderNedarimSettings").invoke(activity);
    check(hasInput(activity.getWindow().getDecorView(),"2222222"),"Editor displays stale institution");
    check(hasInput(activity.getWindow().getDecorView(),"synthetic-new"),"Editor displays stale API setting");
    JSONObject invalid=row("3333333","synthetic-third",42,false);
    try{apply.invoke(activity,invalid);throw new AssertionError("Malformed response accepted");}catch(InvocationTargetException expected){}
    check("2222222".equals(field(c,"paymentMosad").get(activity)),"Malformed response partially overwrote account");
    check(field(c,"showCustomerPaymentPage").getBoolean(activity),"Malformed response partially overwrote visibility");
    apply.invoke(activity,row("2222222","synthetic-new",JSONObject.NULL,false));
    check("".equals(field(c,"paymentGroupe").get(activity)),"Cleared website group retained old value");
    JSONObject missing=row("4444444","synthetic", "",false);missing.remove("api_valid");
    try{apply.invoke(activity,missing);throw new AssertionError("Incomplete response accepted");}catch(InvocationTargetException expected){}
    check("2222222".equals(field(c,"paymentMosad").get(activity)),"Incomplete response overwrote account");
    refresh.invoke(activity,(Runnable)()->continued.incrementAndGet(),true,true);
    int after=revision.getInt(activity);
    refresh.invoke(activity,(Runnable)()->continued.incrementAndGet(),true,true);
    check(revision.getInt(activity)==after,"Duplicate payment refresh not blocked");
   }catch(Throwable t){error[0]=t;}});
   if(error[0]!=null)throw error[0];
   boolean[] busy={true};
   long deadline=System.currentTimeMillis()+25000;
   while(busy[0]&&System.currentTimeMillis()<deadline){Thread.sleep(100);runOnMainSync(()->{try{busy[0]=pending.getBoolean(activity);}catch(Exception e){error[0]=e;}});}
   check(!busy[0],"Failed request did not release pending state");
   check(continued.get()==0,"Failed refresh continued to checkout");
   runOnMainSync(()->{try{method(c,"openNedarimDirectPaymentPage",double.class).invoke(activity,1.25);}catch(Throwable t){error[0]=t;}});
   if(error[0]!=null)throw error[0];
   Thread.sleep(1000);
   runOnMainSync(()->{try{
    android.webkit.WebView w=web(activity.getWindow().getDecorView());
    check(w!=null&&w.getHeight()>100&&w.getWidth()>100,"Direct payment WebView is collapsed");
    check(!(w.getParent().getParent() instanceof android.widget.ScrollView),"Direct page still inside unbounded scroll");
    android.webkit.WebViewClient client=w.getWebViewClient();
    check(client.shouldOverrideUrlLoading(w,"https://example.com/"),"External navigation allowed");
    check(!client.shouldOverrideUrlLoading(w,"https://www.matara.pro/nedarimplus/online/"),"Nedarim navigation blocked");
    activity.finish();
   }catch(Throwable t){error[0]=t;}});
   if(error[0]!=null)throw error[0];
   result.putString("keyboard_result","PASS: website account replacement, editor, visibility, cleared group, atomic validation, duplicate guard, offline checkout block, visible direct payment WebView and navigation restrictions");
   finish(Activity.RESULT_OK,result);
  }catch(Throwable t){result.putString("keyboard_result","FAIL: "+t.getClass().getSimpleName()+": "+t.getMessage());finish(Activity.RESULT_CANCELED,result);}
 }
}

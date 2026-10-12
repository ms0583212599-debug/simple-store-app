package com.simplestore.keyboardtest;
import android.app.*;
import android.content.Intent;
import android.os.Bundle;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.lang.reflect.Method;
import java.util.Locale;

public final class KeyboardInstrumentation extends Instrumentation {
 private static Button find(View view, String label) {
  if(view instanceof Button && label.contentEquals(((Button)view).getText())) return (Button)view;
  if(view instanceof ViewGroup) {
   ViewGroup group=(ViewGroup)view;
   for(int i=0;i<group.getChildCount();i++){Button b=find(group.getChildAt(i),label);if(b!=null)return b;}
  }
  return null;
 }
 private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 private static void click(AlertDialog dialog,String label){
  Button button=find(dialog.getWindow().getDecorView(),label);check(button!=null,"Missing key "+label);button.performClick();
 }
 @Override public void onStart(){
  Bundle result=new Bundle();
  try {
   Intent intent=new Intent();intent.setClassName("com.simplestore.tablet","com.simplestore.tablet.KioskActivity");intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
   Activity activity=startActivitySync(intent);
   final Throwable[] problem={null};
   runOnMainSync(()->{
    Locale previous=Locale.getDefault();
    try {
     Locale.setDefault(new Locale("tr","TR"));
     EditText target=new EditText(activity);target.setInputType(InputType.TYPE_CLASS_TEXT);target.setText("");target.setSelection(0);
     Method method=activity.getClass().getSuperclass().getDeclaredMethod("showAppKeyboard",EditText.class);method.setAccessible(true);method.invoke(activity,target);
     AlertDialog dialog=(AlertDialog)target.getTag();click(dialog,"HE");
     for(char c='a';c<='z';c++)check(find(dialog.getWindow().getDecorView(),String.valueOf(c))!=null,"Missing lowercase key");
     click(dialog,"Aa");
     for(char c='A';c<='Z';c++)check(find(dialog.getWindow().getDecorView(),String.valueOf(c))!=null,"Missing uppercase key");
     check(find(dialog.getWindow().getDecorView(),"Aa").isSelected(),"Uppercase mode is not marked selected");
     click(dialog,"Q");click(dialog,"A");click(dialog,"Z");check("QAZ".equals(target.getText().toString()),"Uppercase insertion failed");
     click(dialog,"Aa");click(dialog,"q");click(dialog,"a");click(dialog,"z");
     check("QAZqaz".equals(target.getText().toString()),"Lowercase insertion failed");
     click(dialog,"⌫");check("QAZqa".equals(target.getText().toString()),"Delete failed");
     target.setSelection(1,3);click(dialog,"Aa");click(dialog,"B");
     check("QBqa".equals(target.getText().toString()),"Selection replacement failed");
     click(dialog,"123");check(find(dialog.getWindow().getDecorView(),"1")!=null,"Numeric mode failed");
     click(dialog,"חזרה לעברית");check(find(dialog.getWindow().getDecorView(),"ק")!=null,"Hebrew mode failed");
     click(dialog,"HE");check(find(dialog.getWindow().getDecorView(),"q")!=null,"English mode reset failed");
     click(dialog,"Go");check(!dialog.isShowing(),"Dismiss failed");
     activity.finish();
    } catch(Throwable error){problem[0]=error;} finally {Locale.setDefault(previous);}
   });
   if(problem[0]!=null)throw problem[0];
   result.putString("keyboard_result","PASS: uppercase/lowercase, 26 keys, Turkish locale, insertion, delete, selection, Hebrew/numeric switch");
   finish(Activity.RESULT_OK,result);
  } catch(Throwable error){result.putString("keyboard_result","FAIL: "+error.getClass().getSimpleName()+": "+error.getMessage());finish(Activity.RESULT_CANCELED,result);}
 }
}

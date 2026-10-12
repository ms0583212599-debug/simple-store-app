package com.simplestore.tools;
import java.lang.reflect.*;
/** Stage-one owner release only. Never deletes data, uninstalls, resets or transfers. */
public final class ApprovedOwnerRelease {
 public static void main(String[] args) throws Exception {
  if(args.length!=1 || !"--release-owner-after-explicit-approval".equals(args[0])) {
   System.out.println("REFUSED: explicit owner-release argument required");
   System.exit(2);
  }
  int sdk=Class.forName("android.os.Build$VERSION").getField("SDK_INT").getInt(null);
  int uid=(Integer)Class.forName("android.os.Process").getMethod("myUid").invoke(null);
  if(sdk!=33 || uid!=10329)throw new SecurityException("Unexpected Android version or installed-app UID");
  Object binder=Class.forName("android.os.ServiceManager").getMethod("getService",String.class).invoke(null,"device_policy");
  Object policy=Class.forName("android.app.admin.IDevicePolicyManager$Stub").getMethod("asInterface",Class.forName("android.os.IBinder")).invoke(null,binder);
  Method get=policy.getClass().getMethod("getDeviceOwnerComponent",boolean.class);get.setAccessible(true);
  Object owner=get.invoke(policy,true);
  if(owner==null)throw new SecurityException("No device owner");
  String expected="com.simplestore.tablet";
  String actual=(String)owner.getClass().getMethod("getPackageName").invoke(owner);
  String receiver=(String)owner.getClass().getMethod("getClassName").invoke(owner);
  if(!expected.equals(actual) || !(expected+".KioskDeviceAdminReceiver").equals(receiver))throw new SecurityException("Unexpected owner identity");
  Method release=policy.getClass().getMethod("clearDeviceOwner",String.class);release.setAccessible(true);
  release.invoke(policy,expected);
  if(get.invoke(policy,true)!=null)throw new IllegalStateException("Ownership release needs inspection");
  System.out.println("OWNER_RELEASE_CONFIRMED");
  System.out.println("This tool did not uninstall the app, delete app data or reset the device.");
 }
}

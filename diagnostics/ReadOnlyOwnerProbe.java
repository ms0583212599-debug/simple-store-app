package com.simplestore.tools;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/** Queries only. No ownership, policy, package, account or data mutations. */
public final class ReadOnlyOwnerProbe {
    private static final String PKG = "com.simplestore.tablet";
    private static Object call(Object target, String name, Class<?>[] types, Object... args) throws Exception {
        Method method = target.getClass().getMethod(name, types);
        method.setAccessible(true);
        return method.invoke(target, args);
    }
    public static void main(String[] args) {
        if (args.length != 0) {
            System.out.println("PROBE_ERROR: this tool accepts no commands or options");
            System.exit(2);
        }
        try {
            Class<?> process = Class.forName("android.os.Process");
            int uid = (Integer) process.getMethod("myUid").invoke(null);
            Class<?> version = Class.forName("android.os.Build$VERSION");
            System.out.println("SDK=" + version.getField("SDK_INT").getInt(null));
            System.out.println("CALLER_UID=" + uid);
            if (uid < 10000 || uid >= 100000) {
                throw new IllegalStateException("Run under the primary-user app UID with run-as");
            }
            Class<?> serviceManager = Class.forName("android.os.ServiceManager");
            Object binder = serviceManager.getMethod("getService", String.class).invoke(null, "device_policy");
            if (binder == null) throw new IllegalStateException("device_policy service unavailable");
            Class<?> stub = Class.forName("android.app.admin.IDevicePolicyManager$Stub");
            Object policy = stub.getMethod("asInterface", Class.forName("android.os.IBinder")).invoke(null, binder);
            Object owner = call(policy, "getDeviceOwnerComponent", new Class<?>[]{boolean.class}, true);
            if (owner == null) throw new IllegalStateException("No owner visible for calling user");
            String ownerPackage = (String) call(owner, "getPackageName", new Class<?>[]{});
            String ownerClass = (String) call(owner, "getClassName", new Class<?>[]{});
            System.out.println("OWNER_PACKAGE=" + ownerPackage);
            System.out.println("OWNER_CLASS=" + ownerClass);
            if (!PKG.equals(ownerPackage)) throw new IllegalStateException("Unexpected owner package");
            Object active = call(policy, "isAdminActive", new Class<?>[]{Class.forName("android.content.ComponentName"), int.class}, owner, 0);
            System.out.println("ADMIN_ACTIVE=" + active);
            System.out.println("READ_ONLY_PROBE_OK");
            System.out.println("This proves read access only; migration and re-enrollment remain untested.");
        } catch (Throwable error) {
            while (error instanceof InvocationTargetException && error.getCause() != null) error = error.getCause();
            System.out.println("PROBE_ERROR_TYPE=" + error.getClass().getSimpleName());
            System.out.println("PROBE_ERROR=" + String.valueOf(error.getMessage()));
            System.exit(1);
        }
    }
}

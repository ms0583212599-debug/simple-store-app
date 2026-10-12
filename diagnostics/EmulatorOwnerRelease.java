package com.simplestore.tools;
import java.lang.reflect.*;
/** Mutation fixture: refuses real hardware; used only in disposable CI emulator. */
public final class EmulatorOwnerRelease {
    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !"--emulator-test-only".equals(args[0])) throw new SecurityException("Explicit emulator test argument required");
        String hardware = (String) Class.forName("android.os.Build").getField("HARDWARE").get(null);
        if (!"ranchu".equals(hardware) && !"goldfish".equals(hardware)) throw new SecurityException("Refusing non-emulator hardware");
        Class<?> sm = Class.forName("android.os.ServiceManager");
        Object binder = sm.getMethod("getService",String.class).invoke(null,"device_policy");
        Object policy = Class.forName("android.app.admin.IDevicePolicyManager$Stub").getMethod("asInterface",Class.forName("android.os.IBinder")).invoke(null,binder);
        Method method = policy.getClass().getMethod("clearDeviceOwner",String.class);
        method.setAccessible(true);
        method.invoke(policy,"com.simplestore.tablet");
        System.out.println("EMULATOR_OWNER_RELEASED");
    }
}

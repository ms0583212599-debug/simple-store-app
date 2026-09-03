package com.simplestore.tablet;

import android.app.Activity;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.UserManager;
import android.view.View;

public final class KioskManager {
    private KioskManager() {}

    public static boolean isDeviceOwner(Context context) {
        DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
        return dpm != null && dpm.isDeviceOwnerApp(context.getPackageName());
    }

    public static void applyDeviceOwnerPolicies(Activity activity) {
        DevicePolicyManager dpm = (DevicePolicyManager) activity.getSystemService(Context.DEVICE_POLICY_SERVICE);
        if (dpm == null || !dpm.isDeviceOwnerApp(activity.getPackageName())) return;
        ComponentName admin = new ComponentName(activity, KioskDeviceAdminReceiver.class);
        String pkg = activity.getPackageName();
        dpm.setLockTaskPackages(admin, new String[]{pkg});
        dpm.addUserRestriction(admin, UserManager.DISALLOW_SAFE_BOOT);
        dpm.addUserRestriction(admin, UserManager.DISALLOW_FACTORY_RESET);
        dpm.addUserRestriction(admin, UserManager.DISALLOW_ADD_USER);
        dpm.addUserRestriction(admin, UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA);
        dpm.addUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE);
        }
        PackageManager pm = activity.getPackageManager();
        ComponentName home = new ComponentName(activity, MainActivity.class);
        dpm.addPersistentPreferredActivity(admin,
                new android.content.IntentFilter(android.content.Intent.ACTION_MAIN) {{
                    addCategory(android.content.Intent.CATEGORY_HOME);
                    addCategory(android.content.Intent.CATEGORY_DEFAULT);
                }}, home);
    }

    public static void enter(Activity activity) {
        applyDeviceOwnerPolicies(activity);
        activity.getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY |
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        if (isDeviceOwner(activity)) {
            try { activity.startLockTask(); } catch (Exception ignored) {}
        }
    }

    public static void exit(Activity activity) {
        try { activity.stopLockTask(); } catch (Exception ignored) {}
        activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    }
}

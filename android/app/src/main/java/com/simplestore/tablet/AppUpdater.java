package com.simplestore.tablet;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class AppUpdater {
    private static final String UPDATE_PROXY = "https://ksddrcalmszxxcuxoznd.supabase.co/functions/v1/android-update-proxy";
    private static final String[] VERSION_URLS = new String[] {
            UPDATE_PROXY + "?file=version",
            "https://raw.githubusercontent.com/ms0583212599-debug/simple-store-app/main/updates/version.json",
            "https://simple-store-app-ms0583212599-1490s-projects.vercel.app/updates/version.json"
    };
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    private AppUpdater() {}

    public static void checkForUpdate(Activity activity) {
        Toast.makeText(activity, "בודק אם יש עדכון...", Toast.LENGTH_SHORT).show();
        IO.execute(() -> {
            try {
                JSONObject info = readVersionInfo();
                long remoteCode = info.optLong("versionCode", 0);
                long localCode = currentVersionCode(activity);
                String remoteName = info.optString("versionName", "");
                String apkUrl = info.optString("apkUrl", "");
                String apkUrlFallback = info.optString("apkUrlFallback", UPDATE_PROXY + "?file=apk");
                activity.runOnUiThread(() -> {
                    if (remoteCode <= localCode) {
                        Toast.makeText(activity, "האפליקציה מעודכנת. מותקן: " + localCode + " | זמין: " + remoteCode, Toast.LENGTH_LONG).show();
                        return;
                    }
                    new AlertDialog.Builder(activity)
                            .setTitle("קיים עדכון חדש")
                            .setMessage("גרסה חדשה " + remoteName + " זמינה. להוריד ולהתקין עכשיו?")
                            .setNegativeButton("לא עכשיו", null)
                            .setPositiveButton("עדכן", (d, w) -> downloadAndInstall(activity, apkUrl, apkUrlFallback, remoteCode))
                            .show();
                });
            } catch (Exception e) {
                showError(activity, "בדיקת עדכון נכשלה", e);
            }
        });
    }

    private static JSONObject readVersionInfo() throws Exception {
        Exception last = null;
        for (String baseUrl : VERSION_URLS) {
            try {
                String sep = baseUrl.contains("?") ? "&" : "?";
                JSONObject info = new JSONObject(readText(baseUrl + sep + "t=" + System.currentTimeMillis()));
                if (info.optLong("versionCode", 0) <= 0) throw new Exception("versionCode חסר");
                if (baseUrl.contains("raw.githubusercontent.com") || baseUrl.contains("vercel.app")) {
                    info.put("apkUrlFallback", UPDATE_PROXY + "?file=apk&v=" + info.optLong("versionCode", 0));
                }
                return info;
            } catch (Exception e) {
                last = e;
            }
        }
        throw last != null ? last : new Exception("לא נמצא מקור גרסה זמין");
    }

    private static long currentVersionCode(Activity activity) throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        return versionCode(info);
    }

    private static long versionCode(PackageInfo info) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
        return info.versionCode;
    }

    private static void downloadAndInstall(Activity activity, String apkUrl, String apkUrlFallback, long expectedVersion) {
        if ((apkUrl == null || apkUrl.isEmpty()) && (apkUrlFallback == null || apkUrlFallback.isEmpty())) {
            Toast.makeText(activity, "כתובת העדכון אינה תקינה", Toast.LENGTH_LONG).show();
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity, "יש לאשר פעם אחת התקנת אפליקציות ממקור זה, ואז לחזור וללחוץ שוב על עדכון", Toast.LENGTH_LONG).show();
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(settings);
            return;
        }
        Toast.makeText(activity, "מוריד את העדכון...", Toast.LENGTH_LONG).show();
        IO.execute(() -> {
            File apk = null;
            try {
                File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new Exception("אין תיקיית הורדות זמינה");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("לא ניתן ליצור תיקיית הורדות");
                apk = new File(dir, "simple-store-update.apk");
                if (apk.exists() && !apk.delete()) throw new Exception("לא ניתן למחוק קובץ עדכון ישן");

                Exception primaryError = null;
                boolean valid = false;
                if (apkUrl != null && !apkUrl.isEmpty()) {
                    try {
                        download(apkUrl, apk);
                        validateApk(activity, apk, expectedVersion);
                        valid = true;
                    } catch (Exception first) {
                        primaryError = first;
                        if (apk.exists()) apk.delete();
                    }
                }

                if (!valid) {
                    if (apkUrlFallback == null || apkUrlFallback.isEmpty()) {
                        throw primaryError != null ? primaryError : new Exception("אין כתובת הורדה חלופית");
                    }
                    download(apkUrlFallback, apk);
                    validateApk(activity, apk, expectedVersion);
                }

                final long size = apk.length();
                activity.runOnUiThread(() -> Toast.makeText(activity, "העדכון הורד ואומת (" + (size / 1024) + " KB). פותח התקנה...", Toast.LENGTH_LONG).show());
                installWithPackageInstaller(activity, apk);
            } catch (Exception e) {
                if (apk != null && apk.exists()) apk.delete();
                showError(activity, "העדכון נכשל", e);
            }
        });
    }

    private static void validateApk(Activity activity, File apk, long expectedVersion) throws Exception {
        if (apk == null || !apk.exists()) throw new Exception("קובץ APK לא קיים");
        if (apk.length() < 40000) throw new Exception("קובץ APK קטן מדי: " + apk.length() + " bytes");

        try (FileInputStream in = new FileInputStream(apk)) {
            int b1 = in.read();
            int b2 = in.read();
            if (b1 != 'P' || b2 != 'K') throw new Exception("הקובץ שהתקבל אינו APK תקין");
        }

        PackageInfo archive = activity.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
        if (archive == null) throw new Exception("Android לא מזהה את קובץ ה-APK");
        if (!activity.getPackageName().equals(archive.packageName)) {
            throw new Exception("שם החבילה שגוי: " + archive.packageName);
        }
        long downloadedVersion = versionCode(archive);
        if (downloadedVersion < expectedVersion) {
            throw new Exception("הורדה גרסה ישנה: " + downloadedVersion + " במקום " + expectedVersion);
        }
        long localVersion = currentVersionCode(activity);
        if (downloadedVersion <= localVersion) {
            throw new Exception("הקובץ אינו חדש יותר. מותקן " + localVersion + ", הורד " + downloadedVersion);
        }
    }

    private static void installWithPackageInstaller(Activity activity, File apk) throws Exception {
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        params.setSize(apk.length());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        }

        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);
        try {
            try (InputStream in = new FileInputStream(apk); OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
                session.fsync(out);
            }
            Intent resultIntent = new Intent(activity, AppInstallReceiver.class);
            resultIntent.setAction("com.simplestore.tablet.INSTALL_STATUS");
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent pending = PendingIntent.getBroadcast(activity, sessionId, resultIntent, flags);
            session.commit(pending.getIntentSender());
        } catch (Exception e) {
            try { session.abandon(); } catch (Exception ignored) {}
            throw e;
        } finally {
            session.close();
        }
    }

    private static String readText(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        c.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
        c.setRequestProperty("Pragma", "no-cache");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder text = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
            return text.toString();
        } finally {
            c.disconnect();
        }
    }

    private static void download(String url, File out) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        c.setUseCaches(false);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
        c.setRequestProperty("Pragma", "no-cache");
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("הורדת APK החזירה HTTP " + code);
        String type = c.getContentType();
        if (type != null && (type.toLowerCase().contains("text/html") || type.toLowerCase().contains("application/json"))) {
            throw new Exception("השרת החזיר " + type + " במקום APK");
        }
        try (BufferedInputStream in = new BufferedInputStream(c.getInputStream()); FileOutputStream fos = new FileOutputStream(out, false)) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = in.read(buffer)) != -1) fos.write(buffer, 0, n);
            fos.flush();
        } finally {
            c.disconnect();
        }
        if (out.length() < 40000) throw new Exception("ההורדה קצרה מדי: " + out.length() + " bytes");
    }

    private static void showError(Activity activity, String prefix, Exception e) {
        String msg = e == null ? "שגיאה לא ידועה" : e.getMessage();
        if (msg == null || msg.trim().isEmpty()) msg = e.getClass().getSimpleName();
        final String text = prefix + ": " + msg;
        activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
                .setTitle("שגיאת עדכון")
                .setMessage(text)
                .setPositiveButton("אישור", null)
                .show());
    }
}

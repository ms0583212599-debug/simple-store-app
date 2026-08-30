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
    private static final String[] VERSION_URLS = new String[] {
            "https://simple-store-app-ms0583212599-1490s-projects.vercel.app/updates/version.json",
            "https://raw.githubusercontent.com/ms0583212599-debug/simple-store-app/main/updates/version.json"
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
                String apkUrlFallback = info.optString("apkUrlFallback", "");
                activity.runOnUiThread(() -> {
                    if (remoteCode <= localCode) {
                        Toast.makeText(activity, "האפליקציה מעודכנת. מותקן: " + localCode + " | זמין: " + remoteCode, Toast.LENGTH_LONG).show();
                        return;
                    }
                    new AlertDialog.Builder(activity)
                            .setTitle("קיים עדכון חדש")
                            .setMessage("גרסה חדשה " + remoteName + " זמינה. להוריד ולהתקין עכשיו?")
                            .setNegativeButton("לא עכשיו", null)
                            .setPositiveButton("עדכן", (d, w) -> downloadAndInstall(activity, apkUrl, apkUrlFallback))
                            .show();
                });
            } catch (Exception e) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "לא ניתן לבדוק עדכון כרגע", Toast.LENGTH_LONG).show());
            }
        });
    }

    private static JSONObject readVersionInfo() throws Exception {
        Exception last = null;
        for (String baseUrl : VERSION_URLS) {
            try {
                String sep = baseUrl.contains("?") ? "&" : "?";
                return new JSONObject(readText(baseUrl + sep + "t=" + System.currentTimeMillis()));
            } catch (Exception e) {
                last = e;
            }
        }
        throw last != null ? last : new Exception("no version source");
    }

    private static long currentVersionCode(Activity activity) throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
        return info.versionCode;
    }

    private static void downloadAndInstall(Activity activity, String apkUrl, String apkUrlFallback) {
        if (apkUrl == null || apkUrl.isEmpty()) {
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
            try {
                File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new Exception("no download dir");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("cannot create dir");
                File apk = new File(dir, "simple-store-update.apk");
                try {
                    download(apkUrl, apk);
                } catch (Exception first) {
                    if (apkUrlFallback == null || apkUrlFallback.isEmpty()) throw first;
                    download(apkUrlFallback, apk);
                }
                installWithPackageInstaller(activity, apk);
            } catch (Exception e) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "הורדת או התקנת העדכון נכשלה", Toast.LENGTH_LONG).show());
            }
        });
    }

    private static void installWithPackageInstaller(Activity activity, File apk) throws Exception {
        PackageInstaller installer = activity.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(activity.getPackageName());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        }
        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);
        try (InputStream in = new FileInputStream(apk);
             OutputStream out = session.openWrite("base.apk", 0, apk.length())) {
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
        session.close();
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
        int code = c.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
        String type = c.getContentType();
        if (type != null && type.toLowerCase().contains("text/html")) throw new Exception("received html instead of apk");
        try (BufferedInputStream in = new BufferedInputStream(c.getInputStream());
             FileOutputStream fos = new FileOutputStream(out, false)) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = in.read(buffer)) != -1) fos.write(buffer, 0, n);
            fos.flush();
        } finally {
            c.disconnect();
        }
        if (out.length() < 20000) throw new Exception("download too small");
    }
}

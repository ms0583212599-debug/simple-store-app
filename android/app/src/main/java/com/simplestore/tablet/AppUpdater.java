package com.simplestore.tablet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class AppUpdater {
    private static final String VERSION_URL = "https://raw.githubusercontent.com/ms0583212599-debug/simple-store-app/main/updates/version.json";
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    private AppUpdater() {}

    public static void checkForUpdate(Activity activity) {
        Toast.makeText(activity, "בודק אם יש עדכון...", Toast.LENGTH_SHORT).show();
        IO.execute(() -> {
            try {
                JSONObject info = new JSONObject(readText(VERSION_URL));
                long remoteCode = info.optLong("versionCode", 0);
                long localCode = currentVersionCode(activity);
                String remoteName = info.optString("versionName", "");
                String apkUrl = info.optString("apkUrl", "");
                activity.runOnUiThread(() -> {
                    if (remoteCode <= localCode) {
                        Toast.makeText(activity, "האפליקציה מעודכנת לגרסה האחרונה", Toast.LENGTH_LONG).show();
                        return;
                    }
                    new AlertDialog.Builder(activity)
                            .setTitle("קיים עדכון חדש")
                            .setMessage("גרסה חדשה " + remoteName + " זמינה. להוריד ולהתקין עכשיו?")
                            .setNegativeButton("לא עכשיו", null)
                            .setPositiveButton("עדכן", (d, w) -> downloadAndInstall(activity, apkUrl))
                            .show();
                });
            } catch (Exception e) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "לא ניתן לבדוק עדכון כרגע", Toast.LENGTH_LONG).show());
            }
        });
    }

    private static long currentVersionCode(Activity activity) throws Exception {
        PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) return info.getLongVersionCode();
        return info.versionCode;
    }

    private static void downloadAndInstall(Activity activity, String apkUrl) {
        if (apkUrl == null || apkUrl.isEmpty()) {
            Toast.makeText(activity, "כתובת העדכון אינה תקינה", Toast.LENGTH_LONG).show();
            return;
        }
        Toast.makeText(activity, "מוריד את העדכון...", Toast.LENGTH_LONG).show();
        IO.execute(() -> {
            try {
                File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) throw new Exception("no download dir");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("cannot create dir");
                File apk = new File(dir, "simple-store-update.apk");
                download(apkUrl, apk);
                activity.runOnUiThread(() -> install(activity, apk));
            } catch (Exception e) {
                activity.runOnUiThread(() -> Toast.makeText(activity, "הורדת העדכון נכשלה", Toast.LENGTH_LONG).show());
            }
        });
    }

    private static void install(Activity activity, File apk) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.getPackageManager().canRequestPackageInstalls()) {
            Toast.makeText(activity, "יש לאשר פעם אחת התקנת אפליקציות ממקור זה, ואז לחזור וללחוץ שוב על עדכון", Toast.LENGTH_LONG).show();
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + activity.getPackageName()));
            activity.startActivity(settings);
            return;
        }
        Uri uri = FileProvider.getUriForFile(activity, activity.getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW);
        install.setDataAndType(uri, "application/vnd.android.package-archive");
        install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.startActivity(install);
    }

    private static String readText(String url) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
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
        try (BufferedInputStream in = new BufferedInputStream(c.getInputStream());
             FileOutputStream fos = new FileOutputStream(out, false)) {
            byte[] buffer = new byte[16384];
            int n;
            while ((n = in.read(buffer)) != -1) fos.write(buffer, 0, n);
            fos.flush();
        } finally {
            c.disconnect();
        }
    }
}

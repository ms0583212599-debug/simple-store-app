package com.simplestore.tablet;

import android.app.AlertDialog;
import android.os.Bundle;
import android.text.InputType;
import android.view.MotionEvent;
import android.widget.EditText;
import android.widget.Toast;

public class KioskActivity extends MainActivity {
    private int adminTapCount = 0;
    private long firstAdminTapAt = 0L;
    private boolean adminUnlocked = false;

    private void ensureKiosk() { if (!adminUnlocked) KioskManager.enter(this); }

    @Override protected void onCreate(Bundle savedInstanceState) { super.onCreate(savedInstanceState); ensureKiosk(); }
    @Override protected void onResume() { super.onResume(); ensureKiosk(); }
    @Override public void onWindowFocusChanged(boolean hasFocus) { super.onWindowFocusChanged(hasFocus); if (hasFocus) ensureKiosk(); }

    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        if (event.getAction() == MotionEvent.ACTION_DOWN && event.getX() < 120 && event.getY() < 120) {
            long now = System.currentTimeMillis();
            if (firstAdminTapAt == 0L || now - firstAdminTapAt > 5000L) { firstAdminTapAt = now; adminTapCount = 1; } else adminTapCount++;
            if (adminTapCount >= 7) { adminTapCount = 0; firstAdminTapAt = 0L; showAdminExit(); return true; }
        }
        return super.dispatchTouchEvent(event);
    }

    private void showAdminExit() {
        String savedPin = getSharedPreferences("kiosk", MODE_PRIVATE).getString("admin_pin", "");
        if (savedPin.isEmpty()) { showCreateAdminPin(); return; }
        EditText pin = pinField("קוד מנהל");
        new AlertDialog.Builder(this).setTitle("יציאה ממצב נעול").setView(pin).setNegativeButton("ביטול", null).setPositiveButton("פתח", (dialog, which) -> {
            if (savedPin.equals(pin.getText().toString())) { adminUnlocked = true; KioskManager.exit(this); Toast.makeText(this, "מצב Kiosk שוחרר זמנית", Toast.LENGTH_LONG).show(); }
            else Toast.makeText(this, "קוד שגוי", Toast.LENGTH_SHORT).show();
        }).show();
    }

    private void showCreateAdminPin() {
        EditText pin = pinField("קוד חדש - לפחות 6 ספרות");
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("הגדרת קוד מנהל").setMessage("בפעם הראשונה יש לקבוע קוד יציאה אישי. אין קוד ברירת מחדל.").setView(pin).setCancelable(false).setPositiveButton("שמור", null).create();
        dialog.setOnShowListener(x -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
            String value = pin.getText().toString();
            if (value.length() < 6) { Toast.makeText(this, "הקוד חייב להכיל לפחות 6 ספרות", Toast.LENGTH_LONG).show(); return; }
            getSharedPreferences("kiosk", MODE_PRIVATE).edit().putString("admin_pin", value).apply();
            Toast.makeText(this, "קוד המנהל נשמר", Toast.LENGTH_LONG).show(); dialog.dismiss();
        }));
        dialog.show();
    }

    private EditText pinField(String hint) { EditText pin = new EditText(this); pin.setInputType(InputType.TYPE_CLASS_NUMBER | InputType.TYPE_NUMBER_VARIATION_PASSWORD); pin.setHint(hint); return pin; }
}

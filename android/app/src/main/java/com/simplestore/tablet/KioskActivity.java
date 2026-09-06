package com.simplestore.tablet;

import android.os.Bundle;

public class KioskActivity extends MainActivity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        KioskManager.enter(this);
    }

    @Override protected void onResume() {
        super.onResume();
        if (!KioskManager.isTemporarilyReleased(this)) KioskManager.enter(this);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && !KioskManager.isTemporarilyReleased(this)) KioskManager.enter(this);
    }
}

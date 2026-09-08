from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
JAVA = ROOT / "android/app/src/main/java/com/simplestore/tablet"
MANIFEST = ROOT / "android/app/src/main/AndroidManifest.xml"
MAIN = JAVA / "MainActivity.java"
KIOSK = JAVA / "KioskManager.java"
UPDATER = JAVA / "AppUpdater.java"
VERSION = ROOT / "updates/version.json"

errors = []

def need(path: Path, needle: str, label: str):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    if needle not in text:
        errors.append(f"{label}: missing {needle!r} in {path.relative_to(ROOT)}")

# Device-owner / launcher invariants.
need(MANIFEST, ".KioskDeviceAdminReceiver", "device owner receiver")
need(MANIFEST, "android.permission.BIND_DEVICE_ADMIN", "device admin permission")
need(MANIFEST, ".KioskActivity", "kiosk launcher")
need(MANIFEST, "android.intent.category.HOME", "persistent home launcher")
need(KIOSK, "DISALLOW_DEBUGGING_FEATURES", "kiosk debugging restriction")
need(KIOSK, "clearPackagePersistentPreferredActivities", "clean kiosk release")
need(KIOSK, "clearUserRestriction(admin, UserManager.DISALLOW_DEBUGGING_FEATURES)", "debugging release")

# Secure admin-only kiosk release. This runs after ci_kiosk_admin_release.py.
need(MAIN, 'button("שימוש עצמי"', "self-use admin button")
need(MAIN, "postDelayed(kioskReleaseAction,10000)", "10-second kiosk hold")
need(MAIN, "confirmKioskRelease()", "kiosk release reauthentication")
need(MAIN, 'setTitle("יציאה ממצב חנות")', "kiosk release password dialog")
need(MAIN, 'body.put("email",ADMIN_EMAIL)', "fresh admin authentication")
need(MAIN, 'body.put("password",password)', "fresh admin password")
need(MAIN, "KioskManager.exit(this)", "kiosk release action")

# Updater invariants.
need(UPDATER, "android-update-proxy", "update proxy")
need(UPDATER, "USER_ACTION_NOT_REQUIRED", "silent device-owner updater")
need(UPDATER, "isDeviceOwner", "device-owner updater detection")

# Image-cache invariants. Storefront transforms may rewrite the exact cache-directory
# expression, so validate the functional cache pieces instead of one brittle line.
need(MAIN, "imageMemoryCache", "in-memory image cache")
need(MAIN, "downloadImageToCache", "persistent image cache downloader")
need(MAIN, "setUseCaches(true)", "HTTP image cache")

# Payment invariants verified working in production version 10012.
need(MAIN, "CONFIRM_CLIENT_PAYMENT", "client payment confirmation endpoint")
need(MAIN, "paymentFrameReady", "Nedarim iframe readiness guard")
need(MAIN, "setAcceptThirdPartyCookies(paymentWebView,true)", "Nedarim third-party cookies")
need(MAIN, "Android.onFrameReady()", "Nedarim iframe load bridge")
need(MAIN, 'button("טוען תשלום..."', "disabled payment button until iframe ready")
need(MAIN, "if(!paymentFrameReady)", "payment submit readiness check")
need(MAIN, '"ERROR".equalsIgnoreCase(providerStatus)', "Nedarim payment error handling")
need(MAIN, "CONFIRM_CLIENT_PAYMENT,body,false", "direct payment response confirmation")
need(MAIN, '"לא התקבל אישור תשלום. אפשר לנסות שוב לאחר בדיקה."', "payment polling timeout")

# Published version line must never fall back below the installed kiosk generation.
try:
    data = json.loads(VERSION.read_text(encoding="utf-8"))
    code = int(data.get("versionCode", 0))
    if code < 10000:
        errors.append(f"published versionCode {code} is below production baseline 10000")
except Exception as exc:
    errors.append(f"cannot validate updates/version.json: {exc}")

if errors:
    print("ANDROID RELEASE VALIDATION FAILED")
    for error in errors:
        print(" -", error)
    sys.exit(1)

print("Android production invariants validated")

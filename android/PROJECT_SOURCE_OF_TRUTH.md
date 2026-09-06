# Simple Store Android — Source of Truth

This file defines the canonical Android build state for the production tablet app.

## Canonical branch

- `main` is the only production source of truth.
- Old kiosk branches are reference/history only and must not be used for production builds.
- Production APKs are built only by `.github/workflows/build-android-apk.yml` from `main`.

## Package and signing compatibility

- Package: `com.simplestore.tablet`
- Device-owner receiver: `com.simplestore.tablet/.KioskDeviceAdminReceiver`
- The stable Android signing key used by the workflow must not be changed.
- Android update versionCode must stay above the historical kiosk 9xxx range. Current production baseline is `10000`.

## Required kiosk behavior

- The app is the Device Owner / kiosk launcher.
- Kiosk release is available only from store administration.
- Normal tap on `שימוש עצמי` opens self-use as usual.
- Holding `שימוש עצמי` continuously for 10 seconds opens a fresh management-password prompt.
- A persisted admin session is not enough to release kiosk; the management password must be authenticated again.
- Only successful fresh authentication may call `KioskManager.exit(...)`.
- Kiosk release preserves Device Owner ownership; it must not uninstall the app or call `clearDeviceOwnerApp`.
- When released, debugging restriction and persistent HOME are cleared so Android can be used normally.

## Required update behavior

- App update metadata is read from the Supabase `android-update-proxy`, with GitHub/Vercel fallbacks.
- Device Owner self-update uses `PackageInstaller` with `USER_ACTION_NOT_REQUIRED` when supported.
- Published metadata is stored in `updates/version.json`.
- Published APK is stored at `updates/simple-store-tablet.apk`.
- Update versions must monotonically increase and remain >= 10000.

## Required storefront behavior

- Product/category images are cached persistently on the device cache and reused instead of being redownloaded every launch.
- Normal portrait/landscape product images must not be rejected by aspect-ratio heuristics.
- Customer storefront, admin, home-use, special-sales, inventory, Nedarim Plus settings and automatic update checks are all part of the same production APK.

## Build safety

The workflow applies legacy CI transforms before compilation. Until those transforms are fully migrated into permanent Java source, every production build must run `android/ci_validate_release.py` after all transforms and before Gradle compilation. If a critical kiosk/update/image-cache invariant is missing, the build must fail rather than publish a broken APK.

## Current production line

The production Android line uses versionCodes `10000+`. Do not restart numbering at 1xx or 9xxx.

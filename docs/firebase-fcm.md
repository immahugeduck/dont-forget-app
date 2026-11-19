# Enabling Firebase Cloud Messaging (Android push) — one-time setup

The code is already wired: `lib/fcm.ts` sends via FCM HTTP v1 when `FIREBASE_SERVICE_ACCOUNT`
is set, and `.github/workflows/android-apk.yml` drops `google-services.json` into the APK
build when the `GOOGLE_SERVICES_JSON` repo secret exists. Until then, Android reminders use
on-device exact alarms (Capacitor Local Notifications) plus web push.

1. Create a Firebase project: https://console.firebase.google.com/ → **Add project**
   (Google Analytics optional — can be off).
2. Add an Android app: Project overview → **Add app → Android**.
   - Android package name: `app.dontforget.twa` (must match exactly)
   - Nickname: `Don't Forget` (optional); SHA-1 not required for FCM.
   - Download **google-services.json**.
3. Put google-services.json in GitHub: repo → Settings → Secrets and variables → Actions →
   **New repository secret**, name `GOOGLE_SERVICES_JSON`, value = entire file contents.
4. Create a service account key: Firebase console → ⚙ Project settings → **Service accounts** →
   **Generate new private key** (downloads a JSON file).
   Direct link: https://console.firebase.google.com/project/_/settings/serviceaccounts/adminsdk
5. Put the service account JSON in Vercel (project `dont-forget-app`) as a **Sensitive** env var
   `FIREBASE_SERVICE_ACCOUNT` (Production + Preview), value = entire JSON:
   `vercel env add FIREBASE_SERVICE_ACCOUNT production --sensitive < service-account.json`
6. Make sure the **Firebase Cloud Messaging API (V1)** is enabled (Project settings → Cloud Messaging).
7. Redeploy (Vercel) and re-run the **Android APK** workflow, then install the new APK.

Never commit either JSON file to the repo.

# Firebase Cloud Messaging (Android push)

**Status: enabled 2026-11-18** (project `don-t-forget-app-2e920`). Health check:
`GET /api/notifications/config?check=1` → `fcmCheck: "ok"` (dry-run send, nobody notified).

How it avoids double alerts: the phone schedules exact local alarms and reports
`local_synced_at` / `local_covered_until` to `device_tokens`; the server only pushes
reminders created or changed after that (`task_reminders.updated_at`), or all of them
if the phone lacks "Alarms & reminders" access. Needs APK build >= 3.

## One-time setup (done)

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

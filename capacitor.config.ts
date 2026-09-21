import type { CapacitorConfig } from "@capacitor/cli"

// The native Android app is a thin native shell around your deployed Next.js site.
// Supabase auth, the /app/api/* routes, and web-push all need a live server, so the
// WebView loads your Vercel deployment rather than bundling the app offline.
//
// ▸ To point at a different domain (custom domain, staging, etc.), change `server.url`
//   below, then run:  npx cap sync android
const config: CapacitorConfig = {
  appId: "app.dontforget.twa",
  appName: "Don't Forget",
  // Capacitor requires a webDir even when loading a remote URL; this folder just
  // needs to exist and is not shipped to devices when server.url is set.
  webDir: "public",
  server: {
    url: "https://dont-forget-app.vercel.app",
    cleartext: false,
  },
  android: {
    // Show the native splash until the remote page is ready to paint.
    backgroundColor: "#0f0f11",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#0f0f11",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
    StatusBar: {
      backgroundColor: "#0f0f11",
      style: "DARK",
    },
  },
}

export default config

import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "app.loopapp.me",
  appName: "Loop",
  // With `server.url` set, the native shell loads the live hosted app instead
  // of bundling a static copy — the app always reflects the current deployed
  // version without a new store submission per release. `webDir` is only used
  // when no server URL is present, so it points at an empty placeholder to
  // keep the native projects free of build artifacts.
  webDir: "native/web",
  server: {
    url: "https://loopapp.me",
    cleartext: false,
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#0d1230",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d1230",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
}

export default config

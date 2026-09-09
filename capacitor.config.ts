import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "app.loopapp.me",
  appName: "Loop",
  webDir: ".next",
  server: {
    url: "https://loopapp.me",
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    buildOptions: {
      keystorePath: "android/loop-release.keystore",
      keystoreAlias: "loop",
    },
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 1500,
      backgroundColor: "#0d1230",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0d1230",
    },
  },
}

export default config

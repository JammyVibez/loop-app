"use client"

/**
 * Thin Capacitor bridge for the native Loop shell.
 *
 * Every function is a safe no-op when the app runs in a browser — the web app
 * keeps using its existing Web Push + file-input paths, and only devices
 * running inside the Capacitor WebView get native behaviour.
 */

export function isNative(): boolean {
  if (typeof window === "undefined") return false
  return Boolean((window as any).Capacitor?.isNativePlatform?.())
}

/** Whether FCM (native push) should be used instead of the browser Web Push path. */
export function useNativePush(): boolean {
  return isNative()
}

/** Style the native status bar to Loop's dark navy/indigo theme. */
export async function styleNativeStatusBar(): Promise<void> {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar")
    await StatusBar.setStyle({ style: Style.Dark })
    await StatusBar.setBackgroundColor({ color: "#0d1230" })
    await StatusBar.setOverlaysWebView({ overlay: false })
  } catch (err) {
    console.warn("status bar styling skipped:", err)
  }
}

/**
 * Initialise the native shell: status bar, splash handling and the Android
 * hardware back button (go back in history, exit when nothing is left).
 */
export async function initNativeShell(): Promise<void> {
  if (!isNative()) return
  await styleNativeStatusBar()
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen")
    await SplashScreen.hide()
  } catch {
    /* auto-hide is configured in capacitor.config.ts as a fallback */
  }
  try {
    const { App } = await import("@capacitor/app")
    await App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        void App.minimizeApp?.().catch(() => {})
        history.back()
      } else {
        void App.exitApp()
      }
    })
  } catch (err) {
    console.warn("back button handling skipped:", err)
  }
}

/**
 * Register this device for FCM push and return the token.
 * Resolves null if the user denies permission or FCM is not configured on
 * this platform build.
 */
export async function registerNativePush(): Promise<{ token: string; platform: string } | null> {
  if (!isNative()) return null
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")
    const permission = await PushNotifications.requestPermissions()
    if (permission.receive !== "granted") return null

    let resolveToken: (t: string) => void
    let rejectToken: (e: Error) => void
    const tokenPromise = new Promise<string>((resolve, reject) => {
      resolveToken = resolve
      rejectToken = reject
    })

    void PushNotifications.addListener("registration", ({ value }) => {
      resolveToken(value)
    })
    void PushNotifications.addListener("registrationError", (err) => {
      rejectToken(new Error(err?.error || "FCM registration failed"))
    })

    await PushNotifications.register()

    const token = await Promise.race([
      tokenPromise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("FCM registration timed out")), 15000)),
    ])

    const platform = /iPad|iPhone|iPod/.test(navigator.userAgent) ? "ios" : "android"
    return { token, platform }
  } catch (err) {
    console.warn("native push registration skipped:", err)
    return null
  }
}

/** Remove this device's FCM token from the backend (logout / mute). */
export async function unregisterNativePush(token: string | null): Promise<void> {
  if (!isNative() || !token) return
  try {
    await fetch("/api/push/native", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
    const { PushNotifications } = await import("@capacitor/push-notifications")
    await PushNotifications.unregister()
  } catch {
    /* best effort */
  }
}

/** Keep the FCM token in sync with the backend for a signed-in user. */
export async function syncNativePushToken(token: string, platform: string, authHeader: Record<string, string>): Promise<void> {
  await fetch("/api/push/native", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ token, platform }),
  })
}

/** Listen for FCM taps and route to the notification's deep link. */
export async function listenForNativePushTaps(): Promise<void> {
  if (!isNative()) return
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications")
    const route = (data: Record<string, unknown>) => {
      const url = String(data?.url || data?.action_url || "")
      if (url.startsWith("/")) {
        window.location.href = url
      }
    }
    // Cold-start notification
    const initial = await PushNotifications.getDeliveredNotifications().catch(() => null)
    if (initial && initial.notifications?.[0]?.data) {
      route(initial.notifications[0].data as Record<string, unknown>)
    }
    void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      route((action?.notification?.data || {}) as Record<string, unknown>)
    })
  } catch (err) {
    console.warn("native push tap routing skipped:", err)
  }
}

/**
 * Open the native photo picker and return a File ready for the existing
 * Cloudinary upload pipeline. Falls back to a web file input outside
 * Capacitor by returning null (callers keep their <input type="file"> path).
 */
export async function pickNativeImage(): Promise<File | null> {
  if (!isNative()) return null
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera")
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      quality: 92,
      width: 2048,
      correctOrientation: true,
      allowEditing: true,
    })
    if (!photo.webPath) return null
    const res = await fetch(photo.webPath)
    const blob = await res.blob()
    const mime = photo.format ? `image/${photo.format.toLowerCase().replace("jpeg", "jpeg")}` : blob.type || "image/jpeg"
    const ext = photo.format === "png" ? "png" : "jpg"
    return new File([blob], `native-capture-${Date.now()}.${ext}`, { type: mime })
  } catch (err) {
    console.warn("native camera picker skipped:", err)
    return null
  }
}

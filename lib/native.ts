"use client"

/**
 * Thin native bridge for the Loop shell.
 *
 * Capacitor packages have been removed — every function is now a safe
 * no-op when the app runs in a browser or on the web. The web app
 * keeps using its existing Web Push + file-input paths.
 */

export function isNative(): boolean {
  if (typeof window === "undefined") return false
  return Boolean((window as any).Capacitor?.isNativePlatform?.())
}

/** Whether FCM (native push) should be used instead of the browser Web Push path. */
export function useNativePush(): boolean {
  return isNative()
}

/** Style the native status bar — no-op without Capacitor. */
export async function styleNativeStatusBar(): Promise<void> {
  // No-op: Capacitor packages removed
}

/**
 * Initialise the native shell — no-op without Capacitor.
 */
export async function initNativeShell(): Promise<void> {
  // No-op: Capacitor packages removed
}

/**
 * Register this device for FCM push — returns null without Capacitor.
 */
export async function registerNativePush(): Promise<{ token: string; platform: string } | null> {
  return null
}

/** Remove this device's FCM token from the backend (logout / mute). */
export async function unregisterNativePush(_token: string | null): Promise<void> {
  // No-op: Capacitor packages removed
}

/** Keep the FCM token in sync with the backend for a signed-in user. */
export async function syncNativePushToken(token: string, platform: string, authHeader: Record<string, string>): Promise<void> {
  await fetch("/api/push/native", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify({ token, platform }),
  })
}

/** Listen for FCM taps — no-op without Capacitor. */
export async function listenForNativePushTaps(): Promise<void> {
  // No-op: Capacitor packages removed
}

/**
 * Open the native photo picker — returns null without Capacitor.
 * Callers keep their <input type="file"> path.
 */
export async function pickNativeImage(): Promise<File | null> {
  return null
}

/**
 * Haptic feedback utility for mobile web.
 * Uses the Vibration API where available, with no-op fallback for desktop.
 */

type HapticStyle = "light" | "medium" | "heavy" | "success" | "error" | "selection";

const HAPTIC_PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  error: [30, 50, 30],
  selection: 5,
};

let enabled = true;

/** Enable or disable haptics globally. */
export function setHapticsEnabled(value: boolean) {
  enabled = value;
}

/** Check if vibration API is available. */
function supportsVibration(): boolean {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

/**
 * Trigger a haptic feedback pattern.
 * Safe to call anywhere — silently no-ops on desktop or when disabled.
 */
export function haptic(style: HapticStyle = "light") {
  if (!enabled || !supportsVibration()) return;
  try {
    navigator.vibrate(HAPTIC_PATTERNS[style]);
  } catch {
    // Silently ignore — some browsers throw on vibrate
  }
}

/**
 * Light tap — use for button presses, toggles, tab switches.
 */
export function hapticTap() {
  haptic("light");
}

/**
 * Medium press — use for likes, saves, important actions.
 */
export function hapticPress() {
  haptic("medium");
}

/**
 * Success feedback — use for completed actions (sent, saved, joined).
 */
export function hapticSuccess() {
  haptic("success");
}

/**
 * Error feedback — use for failed actions.
 */
export function hapticError() {
  haptic("error");
}

/**
 * Selection tick — use for scroll pickers, sliders.
 */
export function hapticSelection() {
  haptic("selection");
}

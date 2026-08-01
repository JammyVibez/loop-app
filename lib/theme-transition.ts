"use client"

const FADE_DURATION = 300
const FADE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)"

let isTransitioning = false

function getBackgroundColor(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim()
  if (!value) return "hsl(0 0% 100%)"
  if (!value.includes("#") && value.split(/\s+/).length >= 3) {
    return `hsl(${value})`
  }
  return value
}

function resolveThemeName(nextTheme: string): string {
  if (nextTheme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  }
  return nextTheme
}

/**
 * Mirror next-themes' class application (attribute="class", themes=["light",
 * "dark"], enableSystem) synchronously, so the new theme is in place
 * immediately instead of waiting on React's passive effect. next-themes later
 * re-asserts the exact same state (idempotent), so nothing desyncs.
 */
function applyThemeClassSync(nextTheme: string): void {
  const root = document.documentElement
  const resolved = resolveThemeName(nextTheme)
  if (resolved !== "dark" && resolved !== "light") return
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

function removeOverlay(overlay: HTMLElement) {
  overlay.remove()
  isTransitioning = false
}

/**
 * Smooth day/night cross-fade. Covers the viewport with the old background
 * color, swaps the theme behind it synchronously, then fades the single
 * overlay out. Only one element animates a composited opacity transition, so
 * it stays smooth on both GPU and CPU rendering and never blocks the switch.
 */
export function animateThemeChange(nextTheme: string, setTheme: (theme: string) => void): void {
  if (typeof window === "undefined") {
    setTheme(nextTheme)
    return
  }

  const root = document.documentElement
  const resolved = resolveThemeName(nextTheme)

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    isTransitioning ||
    root.classList.contains(resolved)
  ) {
    setTheme(nextTheme)
    return
  }

  const oldBackground = getBackgroundColor()

  const overlay = document.createElement("div")
  overlay.setAttribute("aria-hidden", "true")
  overlay.style.cssText = [
    "position: fixed",
    "inset: 0",
    "width: 100vw",
    "height: 100vh",
    `background: ${oldBackground}`,
    "opacity: 1",
    "z-index: 2147483646",
    "pointer-events: none",
    "will-change: opacity",
    "transform: translateZ(0)",
  ].join(";")
  document.body.appendChild(overlay)

  void overlay.offsetWidth

  isTransitioning = true
  applyThemeClassSync(nextTheme)
  setTheme(nextTheme)

  requestAnimationFrame(() => {
    overlay.style.transition = `opacity ${FADE_DURATION}ms ${FADE_EASING}`
    overlay.style.opacity = "0"
    const cleanup = () => removeOverlay(overlay)
    overlay.addEventListener("transitionend", cleanup, { once: true })
    setTimeout(cleanup, FADE_DURATION + 50)
  })
}

/**
 * Browser autoplay policy helper for WebRTC calls/livestreams.
 *
 * Chrome/Safari block unmuted audio until the user has interacted with the
 * page ("user activation"). Calls and livestreams are started from button
 * clicks, but by the time remote tracks arrive the activation window is gone,
 * so the first remote audio element can end up muted — the classic "I can see
 * them but I can't hear them" bug.
 *
 * Calling `unlockAudio()` from the click handler that starts/joins a call
 * primes the browser: it resumes a WebAudio context and plays a silent
 * buffer, which counts as media playback and unlocks unmuted <audio>/<video>
 * elements for the rest of the session.
 */

let ctx: AudioContext | null = null

export function unlockAudio(): void {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return
  try {
    if (!ctx) {
      // @ts-expect-error webkitAudioContext is the Safari prefix
      const Ctor = window.AudioContext || window.webkitAudioContext
      ctx = new Ctor()
    }
    if (ctx.state === "suspended") void ctx.resume()

    // Play a silent one-frame buffer — enough to satisfy the autoplay gate
    // without making any audible noise.
    const buffer = ctx.createBuffer(1, 1, 22050)
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = 0
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start(0)
  } catch {
    /* non-fatal — calls still work, autoplay may just prompt */
  }
}

/**
 * Safe helper to play an attached remote-audio element. Catches the
 * NotAllowedError autoplay rejection so a blocked play never breaks the call.
 */
export function playRemoteAudio(el: HTMLAudioElement): void {
  try {
    const p = el.play()
    if (p && typeof p.catch === "function") p.catch(() => {})
  } catch {
    /* ignored */
  }
}

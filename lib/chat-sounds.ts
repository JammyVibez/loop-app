"use client"

/**
 * Tiny Web Audio chat sounds — generated on the fly, so there's no audio
 * asset to ship or load. A bright "pop" for messages you send and a softer
 * two-note ding when a message arrives.
 */

let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      audioCtx = new Ctor()
    }
    // Browsers start the context suspended until the first user gesture; if
    // we're already past one (e.g. the user just pressed Enter to send), resume.
    if (audioCtx.state === "suspended") void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

function tone(
  ctx: AudioContext,
  opts: { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number },
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = opts.type || "sine"
  osc.frequency.value = opts.freq
  const t0 = ctx.currentTime + opts.start
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(opts.gain || 0.2, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + opts.dur + 0.03)
}

export function playChatSound(kind: "send" | "receive") {
  const ctx = getCtx()
  if (!ctx) return
  try {
    if (kind === "send") {
      // Bright, friendly "pop" — two quick rising tones.
      tone(ctx, { freq: 520, start: 0, dur: 0.09, gain: 0.14 })
      tone(ctx, { freq: 790, start: 0.05, dur: 0.1, gain: 0.11 })
    } else {
      // Softer two-note "ding" for incoming messages.
      tone(ctx, { freq: 660, start: 0, dur: 0.07, gain: 0.09 })
      tone(ctx, { freq: 880, start: 0.07, dur: 0.09, gain: 0.07 })
    }
  } catch {
    // Audio is a nice-to-have — never break the chat over it.
  }
}

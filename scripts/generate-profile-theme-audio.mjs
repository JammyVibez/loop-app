// Synthesises the Gilded Dusk profile soundtrack as a small looping WAV.
// No encoder is available in the build image, so the pad is rendered straight
// to 16-bit PCM. Run with: node scripts/generate-profile-theme-audio.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

const SAMPLE_RATE = 16000
const CHORD_SECONDS = 4.5
const FADE_SECONDS = 1.4
const CROSSFADE_SECONDS = 1.1

const CHORDS = [
  // Dmaj9 — warm, open
  [146.83, 185.0, 220.0, 277.18, 329.63],
  // Bm9 — a step down, still golden
  [123.47, 146.83, 185.0, 220.0, 277.18],
  // Gmaj7 — lift
  [98.0, 123.47, 146.83, 185.0, 220.0],
  // A7sus4 — suspension that resolves back to the top
  [110.0, 146.83, 164.81, 196.0, 246.94],
]

const totalSeconds = CHORD_SECONDS * CHORDS.length
const totalSamples = Math.round(totalSeconds * SAMPLE_RATE)
const samples = new Float32Array(totalSamples)

function voice(t, freq, phase) {
  // Two slightly detuned sines plus a soft octave: a slow analogue pad.
  const detune = 1 + 0.0016 * Math.sin(2 * Math.PI * 0.07 * t + phase)
  return (
    Math.sin(2 * Math.PI * freq * detune * t + phase) * 0.6 +
    Math.sin(2 * Math.PI * freq * 2 * t + phase * 0.5) * 0.12 +
    Math.sin(2 * Math.PI * freq * 0.5 * t) * 0.18
  )
}

CHORDS.forEach((chord, chordIndex) => {
  const start = chordIndex * CHORD_SECONDS
  const end = start + CHORD_SECONDS + CROSSFADE_SECONDS
  const from = Math.floor(start * SAMPLE_RATE)
  const to = Math.min(totalSamples, Math.floor(end * SAMPLE_RATE))

  for (let i = from; i < to; i += 1) {
    const t = i / SAMPLE_RATE
    const local = t - start
    const attack = Math.min(1, local / 1.6)
    const release = Math.max(0, 1 - Math.max(0, local - CHORD_SECONDS + 0.4) / (CROSSFADE_SECONDS + 0.4))
    const envelope = Math.pow(attack, 2.2) * Math.pow(release, 1.4)
    let value = 0
    for (let v = 0; v < chord.length; v += 1) {
      const weight = 0.16 / (1 + v * 0.24)
      value += voice(t, chord[v], v * 1.7 + chordIndex) * weight
    }

    // A distant bell every three beats keeps the loop from feeling static.
    const beat = 0.75
    const beatIndex = Math.floor(local / beat)
    const since = local - beatIndex * beat
    if (since < 2.2) {
      const bellFreq = chord[(beatIndex + chordIndex) % chord.length] * 4
      const bellEnv = Math.exp(-since * 3.4) * Math.min(1, since * 24)
      value += Math.sin(2 * Math.PI * bellFreq * since) * bellEnv * 0.022
    }

    samples[i] += value * envelope
  }
})

// One-pole low-pass to round off the sines, then normalise.
let previous = 0
for (let i = 0; i < totalSamples; i += 1) {
  previous = previous * 0.72 + samples[i] * 0.28
  samples[i] = previous
}

let peak = 0
for (let i = 0; i < totalSamples; i += 1) peak = Math.max(peak, Math.abs(samples[i]))
const gain = peak > 0 ? 0.5 / peak : 1

// A loop that starts and ends in silence never clicks.
const fadeSamples = Math.round(FADE_SECONDS * SAMPLE_RATE)
for (let i = 0; i < totalSamples; i += 1) {
  let fade = 1
  if (i < fadeSamples) fade = i / fadeSamples
  const tail = totalSamples - 1 - i
  if (tail < fadeSamples) fade = Math.min(fade, tail / fadeSamples)
  samples[i] = samples[i] * gain * Math.pow(fade, 1.6)
}

const dataBytes = totalSamples * 2
const buffer = Buffer.alloc(44 + dataBytes)
buffer.write("RIFF", 0)
buffer.writeUInt32LE(36 + dataBytes, 4)
buffer.write("WAVE", 8)
buffer.write("fmt ", 12)
buffer.writeUInt32LE(16, 16)
buffer.writeUInt16LE(1, 20) // PCM
buffer.writeUInt16LE(1, 22) // mono
buffer.writeUInt32LE(SAMPLE_RATE, 24)
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
buffer.writeUInt16LE(2, 32)
buffer.writeUInt16LE(16, 34)
buffer.write("data", 36)
buffer.writeUInt32LE(dataBytes, 40)

for (let i = 0; i < totalSamples; i += 1) {
  const clamped = Math.max(-1, Math.min(1, samples[i]))
  buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2)
}

const output = "public/profile-themes/gilded-dusk.wav"
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, buffer)
console.log(`${output} — ${totalSeconds}s, ${(buffer.length / 1024).toFixed(0)} KB`)

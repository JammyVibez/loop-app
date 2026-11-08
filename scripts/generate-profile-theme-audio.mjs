// Renders the loop for every profile theme as a small, seamless WAV.
//
// The build image has no encoder, so everything is synthesised straight to
// 16-bit mono PCM at 16 kHz. Each theme has its own progression, timbre and
// rhythm, but all of it is original synthesis — no samples, no recordings.
//
// Run with: node scripts/generate-profile-theme-audio.mjs
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

const SAMPLE_RATE = 16000
const FADE_SECONDS = 1.4
const CROSSFADE_SECONDS = 1.1

const hz = (note) => {
  const match = /^([a-g])(#|b)?(-?\d)$/i.exec(note)
  if (!match) throw new Error(`Bad note ${note}`)
  const semitone = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[match[1].toLowerCase()]
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0
  const octave = Number(match[3])
  const midi = (octave + 1) * 12 + semitone + accidental
  return 440 * Math.pow(2, (midi - 69) / 12)
}

const TRACKS = [
  {
    file: "gilded-dusk",
    title: "Gilded Dusk — Nocturne",
    chordSeconds: 4.5,
    chords: [
      ["d3", "f#3", "a3", "c#4", "e4"], // Dmaj9 — warm, open
      ["b2", "d3", "f#3", "a3", "c#4"], // Bm9 — a step down, still golden
      ["g2", "b2", "d3", "f#3", "a3"], // Gmaj7 — lift
      ["a2", "d3", "e3", "g3", "b3"], // A7sus4 — resolves back to the top
    ],
    timbre: "pad",
    bell: 0.022,
    // Coefficient of the incoming sample in the one-pole low-pass; lower is
    // warmer. 0.28 reproduces the original Gilded Dusk render exactly.
    cutoff: 0.28,
  },
  {
    file: "gojo-limitless",
    title: "Limitless — Infinite Blue",
    chordSeconds: 3.4,
    chords: [
      ["a2", "c#3", "e3", "b3", "c#4"], // Aadd9 — wide open
      ["f#2", "a2", "c#3", "e3", "g#3"], // F#m9 — drifting
      ["d2", "f#2", "a2", "c#3", "e3"], // Dmaj9 — light through glass
      ["e2", "g#2", "b2", "d3", "f#3"], // E6/9 — lift back
    ],
    timbre: "glass",
    arpEvery: 0.28,
    arpGain: 0.05,
    arpRange: 3,
    bell: 0.032,
    cutoff: 0.55,
  },
  {
    file: "sukuna-malevolent",
    title: "Malevolent Shrine — Cursed Pulse",
    chordSeconds: 4.8,
    chords: [
      ["d2", "a2", "d3", "f3", "g#3"], // Dm with a tritone
      ["d2", "a2", "c#3", "f3", "a3"], // shrine shift
      ["c2", "g2", "c3", "eb3", "g3"], // Cm
      ["d2", "a2", "d3", "f3", "b3"], // back, unresolved
    ],
    timbre: "dark",
    pulseBpm: 56,
    pulseGain: 0.2,
    percussion: 0.14,
    bell: 0,
    cutoff: 0.16,
    gain: 0.46,
  },
  {
    file: "after-hours",
    title: "After Hours — Neon Drive",
    chordSeconds: 3.8,
    chords: [
      ["a2", "e3", "a3", "c4", "e4"], // Am
      ["f2", "c3", "f3", "a3", "c4"], // F
      ["c3", "g3", "c4", "e4", "g4"], // C
      ["g2", "d3", "g3", "b3", "d4"], // G
    ],
    timbre: "saw",
    arpEvery: 0.25,
    arpGain: 0.042,
    arpRange: 2,
    pulseBpm: 104,
    pulseGain: 0.13,
    bell: 0,
    cutoff: 0.4,
  },
]

function voice(t, freq, phase, timbre) {
  const detune = 1 + 0.0014 * Math.sin(2 * Math.PI * 0.07 * t + phase)
  const f = freq * detune
  const fundamental = Math.sin(2 * Math.PI * f * t + phase)
  if (timbre === "glass") {
    return fundamental * 0.62 + Math.sin(2 * Math.PI * f * 2 * t + phase * 0.5) * 0.16 + Math.sin(2 * Math.PI * f * 3 * t) * 0.09
  }
  if (timbre === "dark") {
    return (
      fundamental * 0.56 +
      Math.sin(2 * Math.PI * f * 2 * t + phase) * 0.2 +
      Math.sin(2 * Math.PI * f * 3 * t + phase * 0.4) * 0.11 +
      Math.sin(2 * Math.PI * f * 4 * t) * 0.06
    )
  }
  if (timbre === "saw") {
    return (
      fundamental * 0.52 +
      Math.sin(2 * Math.PI * f * 2 * t + phase) * 0.26 +
      Math.sin(2 * Math.PI * f * 3 * t + phase * 0.6) * 0.14 +
      Math.sin(2 * Math.PI * f * 4 * t) * 0.08 +
      Math.sin(2 * Math.PI * f * 5 * t) * 0.04
    )
  }
  // Slow analogue pad.
  return fundamental * 0.6 + Math.sin(2 * Math.PI * f * 2 * t + phase * 0.5) * 0.12 + Math.sin(2 * Math.PI * f * 0.5 * t) * 0.18
}

function renderTrack(track) {
  const chords = track.chords.map((notes) => notes.map(hz))
  const totalSeconds = track.chordSeconds * chords.length
  const totalSamples = Math.round(totalSeconds * SAMPLE_RATE)
  const samples = new Float32Array(totalSamples)
  const beat = track.pulseBpm ? 60 / track.pulseBpm : 0

  chords.forEach((chord, chordIndex) => {
    const start = chordIndex * track.chordSeconds
    const end = start + track.chordSeconds + CROSSFADE_SECONDS
    const from = Math.floor(start * SAMPLE_RATE)
    const to = Math.min(totalSamples, Math.floor(end * SAMPLE_RATE))

    for (let i = from; i < to; i += 1) {
      const t = i / SAMPLE_RATE
      const local = t - start
      const attack = Math.min(1, local / 1.6)
      const release = Math.max(
        0,
        1 - Math.max(0, local - track.chordSeconds + 0.4) / (CROSSFADE_SECONDS + 0.4),
      )
      const envelope = Math.pow(attack, 2.2) * Math.pow(release, 1.4)
      let value = 0
      for (let v = 0; v < chord.length; v += 1) {
        const weight = 0.16 / (1 + v * 0.24)
        value += voice(t, chord[v], v * 1.7 + chordIndex, track.timbre) * weight
      }

      // A distant bell keeps a slow loop from feeling static.
      if (track.bell) {
        const bellBeat = 0.75
        const bellIndex = Math.floor(local / bellBeat)
        const since = local - bellIndex * bellBeat
        if (since < 2.2) {
          const bellFreq = chord[(bellIndex + chordIndex) % chord.length] * 4
          const bellEnv = Math.exp(-since * 3.4) * Math.min(1, since * 24)
          value += Math.sin(2 * Math.PI * bellFreq * since) * bellEnv * track.bell
        }
      }

      // Fast arpeggio: the glassy/luminous themes and the neon drive.
      if (track.arpEvery) {
        const step = Math.floor(local / track.arpEvery)
        const since = local - step * track.arpEvery
        const pool = chord.slice(0, track.arpRange || 3)
        const note = pool[(step + chordIndex) % pool.length] * (step % 2 === 0 ? 2 : 4)
        value += Math.sin(2 * Math.PI * note * since) * Math.exp(-since * 7) * (track.arpGain || 0.04)
      }

      samples[i] += value * envelope
    }
  })

  if (beat) {
    const bassGain = track.pulseGain || 0.12
    for (let i = 0; i < totalSamples; i += 1) {
      const t = i / SAMPLE_RATE
      const chordIndex = Math.min(chords.length - 1, Math.floor(t / track.chordSeconds))
      const root = chords[chordIndex][0] / 2
      const since = t % beat
      const env = Math.exp(-since * 6.2) * Math.min(1, since * 60)
      samples[i] += Math.sin(2 * Math.PI * root * since) * env * bassGain
    }
  }

  if (track.percussion) {
    // A dry, low hit on every other beat: shrine wood, not a drum kit.
    let seed = 1337
    const noise = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 2147483648 - 1
    }
    const hitBeat = beat * 2
    for (let i = 0; i < totalSamples; i += 1) {
      const t = i / SAMPLE_RATE
      const since = t % hitBeat
      if (since > 0.5) continue
      const env = Math.exp(-since * 9) * Math.min(1, since * 120)
      samples[i] += noise() * env * track.percussion + Math.sin(2 * Math.PI * 62 * since) * env * track.percussion * 0.6
    }
  }

  // One-pole low-pass to round the sines, then normalise.
  let previous = 0
  const cutoff = track.cutoff ?? 0.6
  for (let i = 0; i < totalSamples; i += 1) {
    previous = previous * (1 - cutoff) + samples[i] * cutoff
    samples[i] = previous
  }

  let peak = 0
  for (let i = 0; i < totalSamples; i += 1) peak = Math.max(peak, Math.abs(samples[i]))
  const gain = peak > 0 ? (track.gain ?? 0.5) / peak : 1

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

  return { buffer, totalSeconds }
}

for (const track of TRACKS) {
  const { buffer, totalSeconds } = renderTrack(track)
  const output = `public/profile-themes/${track.file}.wav`
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, buffer)
  console.log(`${output} — ${totalSeconds}s, ${(buffer.length / 1024).toFixed(0)} KB (${track.title})`)
}

import { hmsConfigured } from "@/lib/hms"
import { livekitConfigured } from "@/lib/livekit"

export type RealtimeProvider = "100ms" | "livekit"

/**
 * Resolve which SFU provider is active for livestreams and voice/video calls.
 *
 * Priority:
 *   1. `REALTIME_PROVIDER` env var — explicit override ("100ms" | "livekit")
 *   2. 100ms, if `HMS_ACCESS_KEY` + `HMS_SECRET` are set (current default)
 *   3. LiveKit, if `LIVEKIT_API_KEY` + `LIVEKIT_API_SECRET` + `LIVEKIT_URL`
 *      are set (free fallback — same SFU/WebRTC model, no room-creation API)
 *   4. null → endpoints return a clear 503
 *
 * Callers that already persisted a provider on a row (stream/call session)
 * should use that value instead of re-resolving — a session always joins
 * through the provider it was created on.
 */
export function getRealtimeProvider(): RealtimeProvider | null {
  const override = (process.env.REALTIME_PROVIDER || "").trim().toLowerCase()
  if (override === "livekit") return "livekit"
  if (override === "100ms" || override === "hms") return "100ms"
  if (hmsConfigured()) return "100ms"
  if (livekitConfigured()) return "livekit"
  return null
}

/** Human-readable label for error messages / badges. */
export function providerLabel(provider: RealtimeProvider): string {
  return provider === "100ms" ? "100ms" : "LiveKit"
}

/** Error text returned when neither provider is configured. */
export function providerNotConfiguredMessage(): string {
  return (
    "Livestreams and calls need a media provider. Set HMS_ACCESS_KEY + HMS_SECRET (100ms) or " +
    "LIVEKIT_API_KEY + LIVEKIT_API_SECRET + LIVEKIT_URL (free LiveKit fallback)."
  )
}

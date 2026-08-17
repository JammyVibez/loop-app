-- LiveKit fallback media provider (free alternative to 100ms)
-- Adds a `provider` column to call sessions and livestreams so a session
-- always joins through the SFU it was created on ("100ms" | "livekit").
-- Idempotent — safe to re-run.

ALTER TABLE call_sessions
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '100ms';

ALTER TABLE live_streams
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '100ms';

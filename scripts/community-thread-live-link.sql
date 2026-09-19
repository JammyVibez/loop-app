-- ============================================================
-- THREAD LIVE ROOM LINK
-- A thread's live session is a real live_streams row so it reuses
-- the existing /streams/[id] WebRTC room (signaling, chat, viewers,
-- HMS media) instead of a second, dead-end stack.
-- ============================================================

ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS live_stream_id UUID;

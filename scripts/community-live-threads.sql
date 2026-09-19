-- ============================================================
-- LIVE THREADS — go live inside a unit of work
-- Uses the existing co-loop / WebRTC infrastructure so a thread
-- can host voice and video without a new room system.
-- ============================================================

ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS is_live BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS live_started_at TIMESTAMPTZ;
ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS live_room_id TEXT;
ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS live_viewer_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE community_threads ADD COLUMN IF NOT EXISTS live_stream_url TEXT;

-- Index for the canvas "who's live" query.
CREATE INDEX IF NOT EXISTS idx_community_threads_live ON community_threads (circle_id, is_live) WHERE is_live = TRUE;

-- Fix: change option_id from UUID to TEXT so poll options with string IDs (like "opt_1")
-- can be stored without Postgres rejecting them as invalid UUID format.
ALTER TABLE loop_poll_votes ALTER COLUMN option_id TYPE TEXT USING option_id::TEXT;

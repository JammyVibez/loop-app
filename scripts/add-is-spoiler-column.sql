-- Add is_spoiler column to loops table for spoiler media feature
-- Run this in your Supabase SQL Editor

-- Add the column (safe to run multiple times)
ALTER TABLE loops ADD COLUMN IF NOT EXISTS is_spoiler BOOLEAN DEFAULT FALSE;

-- Add an index for quick lookups when fetching posts
CREATE INDEX IF NOT EXISTS idx_loops_is_spoiler ON loops(is_spoiler) WHERE is_spoiler = true;

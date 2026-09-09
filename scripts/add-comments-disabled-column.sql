-- Add comments_disabled column to loops table for lock/unlock comments feature
-- Run this in your Supabase SQL Editor

-- Add the column (safe to run multiple times)
ALTER TABLE loops ADD COLUMN IF NOT EXISTS comments_disabled BOOLEAN DEFAULT FALSE;

-- Add an index for quick lookups when fetching posts
CREATE INDEX IF NOT EXISTS idx_loops_comments_disabled ON loops(comments_disabled) WHERE comments_disabled = true;

-- Add missing fields to profiles table for user suspension/banning functionality
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_profiles_banned_until ON profiles(banned_until);

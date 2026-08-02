-- Add is_team_member and is_sponsor columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_team_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sponsor BOOLEAN DEFAULT FALSE;

-- Automatically flag owner account as team member & sponsor
UPDATE public.profiles 
SET is_team_member = TRUE, is_sponsor = TRUE 
WHERE email = 'useehamza0@gmail.com' OR LOWER(username) = 'jammyvibez';

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_profiles_team_member ON public.profiles(is_team_member);
CREATE INDEX IF NOT EXISTS idx_profiles_sponsor ON public.profiles(is_sponsor);

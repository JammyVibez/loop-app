-- Migration: Add Organization Account Tier & Partnership Flow
-- Run this against Supabase PostgreSQL database

-- 1. Add organization fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_organization BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_badge_url TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS organization_config JSONB DEFAULT '{"coin_rate_multiplier": 1.5, "custom_boost_discount": 0.2, "circle_perk_price": 50, "exclusive_rewards_enabled": true}';

-- 2. Add circle_id to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS circle_id TEXT DEFAULT NULL;

-- 3. Seed default admin setting for org_follower_threshold
INSERT INTO admin_settings (setting_key, setting_value)
VALUES ('org_follower_threshold', '100')
ON CONFLICT (setting_key) DO NOTHING;

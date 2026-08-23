-- Migration 001: Add Snowflake ID infrastructure
-- Phase 2 of UUID → Snowflake migration
-- Run AFTER Phase 1 scoping is approved
--
-- SAFE TO RUN: This only ADDS columns, never removes or modifies existing data.
-- UUID columns remain untouched as rollback safety net.

BEGIN;

-- ============================================================
-- 1. PROFILES — The bridge table (everything references this)
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_snowflake_id
  ON profiles(snowflake_id) WHERE snowflake_id IS NOT NULL;

-- Backfill is done via Node.js script (scripts/backfill-snowflake-ids.ts)
-- to use the same generator that production code will use.
-- The SQL backfill below is a fallback if the Node script fails.

-- ============================================================
-- 2. Add snowflake_id columns to ALL application tables
-- (Better Auth tables are EXCLUDED: user, session, account, verification, subscription)
-- ============================================================

-- Core content
ALTER TABLE loops ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE reels ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE moments ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Social
ALTER TABLE follows ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE follow_requests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_interactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_reactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE comment_likes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE reel_interactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE reel_comment_likes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE moment_comments ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE hashtag_follows ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE hashtag_usage ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE hashtags ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_mentions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE interests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Circles
ALTER TABLE circles ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_members ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_posts ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_post_comments ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_post_interactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_post_polls ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_post_poll_votes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_events ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_event_participants ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_rooms ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_room_members ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_room_messages ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_room_message_reactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_room_polls ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_room_poll_votes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_room_presence ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_voice_channels ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_bots ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_challenges ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_invitations ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_join_requests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_tags ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE circle_theme_presets ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Messaging
ALTER TABLE messages ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE message_reactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE message_read_status ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE conversation_participants ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE conversation_settings ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Developer Hub
ALTER TABLE developer_projects ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE developer_portfolios ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE developer_skills ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE project_collaborators ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE project_comments ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE project_forks ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE project_stars ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE code_snippets ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE snippet_likes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE dev_quests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE dev_quest_submissions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Duels & Co-Loop
ALTER TABLE loop_duels ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_duel_entries ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_duel_votes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE clutch_duel_predictions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE co_loop_sessions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE open_co_loop_participants ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE co_loop_invite_rewards ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Gifting & Economy
ALTER TABLE gifts ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE gift_transactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE gift_types ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_gifts ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE coin_transactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_inventory ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_cosmetics_inventory ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_cosmetics_equipped ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE cosmetics_catalog ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE earnings ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE surprise_boxes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE coin_gifts ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Themes
ALTER TABLE themes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE theme_categories ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE theme_customizations ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE theme_reviews ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE theme_bundles ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE profile_themes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Events
ALTER TABLE events ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE global_events ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE virtual_events ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE event_mutes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE event_messages ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Live Streaming
ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE stream_chat ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE stream_viewers ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Push & Devices
ALTER TABLE native_push_tokens ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Achievements & Gamification
ALTER TABLE achievements ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE quests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE quest_completions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE quest_rewards ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE skill_trees ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_skills ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_activity_logs ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE awards ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_awards ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE daily_claims ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE weekly_bonus_claims ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE reputation_logs ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- Other
ALTER TABLE reports ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE content_flags ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE search_analytics ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE search_history ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE video_media ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE admin_account_deletions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE ban_appeals ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE verification_badges ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE pro_lounge_checkins ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE voice_channel_participants ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE call_sessions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE game_session_players ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE nft_collections ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE nft_galleries ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE nft_items ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE mini_games ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE whiteboards ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE whiteboard_collaborators ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE shared_workspaces ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE workspace_collaborators ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE collaboration_sessions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE collaboration_activities ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE ad_impressions ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE ads ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE curated_emojis ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE curated_gifs ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE community_marketplace_listings ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE community_marketplace_purchases ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE community_marketplace_installs ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_boosts ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_collaborators ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_polls ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE loop_poll_votes ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;
ALTER TABLE user_rooms ADD COLUMN IF NOT EXISTS snowflake_id BIGINT;

-- ============================================================
-- 3. Create indexes for snowflake_id lookups
-- (Only on tables where snowflake_id will be queried)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loops_snowflake_id ON loops(snowflake_id) WHERE snowflake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circles_snowflake_id ON circles(snowflake_id) WHERE snowflake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_snowflake_id ON comments(snowflake_id) WHERE snowflake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_snowflake_id ON messages(snowflake_id) WHERE snowflake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_snowflake_id ON notifications(snowflake_id) WHERE snowflake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circle_posts_snowflake_id ON circle_posts(snowflake_id) WHERE snowflake_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_circle_room_messages_snowflake_id ON circle_room_messages(snowflake_id) WHERE snowflake_id IS NOT NULL;

COMMIT;

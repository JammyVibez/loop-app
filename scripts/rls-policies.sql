-- Row Level Security (RLS) Policies for Enhanced Social Platform
-- Run this after creating all tables from the schema files

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_trees ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_customizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE surprise_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nft_galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE mini_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_voice_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_channel_participants ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

-- Users can view public profiles and their own profile
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT USING (
        privacy_settings->>'profile_visibility' = 'public' 
        OR auth.uid() = id
        OR auth.uid() IN (
            SELECT following_id FROM follows WHERE follower_id = profiles.id
            UNION
            SELECT follower_id FROM follows WHERE following_id = profiles.id
        )
    );

-- Users can update their own profile
CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- =============================================
-- ACHIEVEMENTS POLICIES
-- =============================================

-- Everyone can view active achievements
CREATE POLICY "achievements_select_policy" ON achievements
    FOR SELECT USING (is_active = true);

-- Only admins can manage achievements
CREATE POLICY "achievements_admin_policy" ON achievements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND is_admin = true
        )
    );

-- =============================================
-- USER ACHIEVEMENTS POLICIES
-- =============================================

-- Users can view their own achievements and public achievements of others
CREATE POLICY "user_achievements_select_policy" ON user_achievements
    FOR SELECT USING (
        auth.uid() = user_id 
        OR is_displayed = true
    );

-- Users can update their own achievement display settings
CREATE POLICY "user_achievements_update_policy" ON user_achievements
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- THEMES POLICIES
-- =============================================

-- Everyone can view active themes
CREATE POLICY "themes_select_policy" ON themes
    FOR SELECT USING (is_active = true);

-- Theme creators can update their own themes
CREATE POLICY "themes_update_policy" ON themes
    FOR UPDATE USING (auth.uid() = creator_id);

-- Users can create themes
CREATE POLICY "themes_insert_policy" ON themes
    FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- =============================================
-- THEME REVIEWS POLICIES
-- =============================================

-- Everyone can view reviews
CREATE POLICY "theme_reviews_select_policy" ON theme_reviews
    FOR SELECT USING (true);

-- Users can create reviews for themes they own
CREATE POLICY "theme_reviews_insert_policy" ON theme_reviews
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM user_inventory ui
            JOIN shop_items si ON ui.item_id = si.id
            WHERE ui.user_id = auth.uid() 
            AND si.category = 'theme'
            AND si.id::text = theme_reviews.theme_id::text
        )
    );

-- Users can update their own reviews
CREATE POLICY "theme_reviews_update_policy" ON theme_reviews
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- USER ROOMS POLICIES
-- =============================================

-- Users can view public rooms and their own rooms
CREATE POLICY "user_rooms_select_policy" ON user_rooms
    FOR SELECT USING (
        is_public = true 
        OR auth.uid() = user_id
    );

-- Users can manage their own rooms
CREATE POLICY "user_rooms_manage_policy" ON user_rooms
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- GIFTING POLICIES
-- =============================================

-- Users can view gifts sent to them or by them
CREATE POLICY "user_gifts_select_policy" ON user_gifts
    FOR SELECT USING (
        auth.uid() = sender_id 
        OR auth.uid() = recipient_id
    );

-- Users can send gifts
CREATE POLICY "user_gifts_insert_policy" ON user_gifts
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Recipients can update gift status (open gifts)
CREATE POLICY "user_gifts_update_policy" ON user_gifts
    FOR UPDATE USING (auth.uid() = recipient_id);

-- =============================================
-- NFT POLICIES
-- =============================================

-- Everyone can view NFT collections and items
CREATE POLICY "nft_collections_select_policy" ON nft_collections
    FOR SELECT USING (true);

CREATE POLICY "nft_items_select_policy" ON nft_items
    FOR SELECT USING (true);

-- NFT owners can update their items
CREATE POLICY "nft_items_update_policy" ON nft_items
    FOR UPDATE USING (auth.uid() = owner_id);

-- Users can manage their own NFT galleries
CREATE POLICY "nft_galleries_select_policy" ON nft_galleries
    FOR SELECT USING (
        is_public = true 
        OR auth.uid() = user_id
    );

CREATE POLICY "nft_galleries_manage_policy" ON nft_galleries
    FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- LIVE STREAMING POLICIES
-- =============================================

-- Everyone can view active streams
CREATE POLICY "live_streams_select_policy" ON live_streams
    FOR SELECT USING (true);

-- Streamers can manage their own streams
CREATE POLICY "live_streams_manage_policy" ON live_streams
    FOR ALL USING (auth.uid() = streamer_id);

-- Users can join/leave streams
CREATE POLICY "stream_viewers_manage_policy" ON stream_viewers
    FOR ALL USING (auth.uid() = user_id);

-- Users can chat in streams they're viewing
CREATE POLICY "stream_chat_insert_policy" ON stream_chat
    FOR INSERT WITH CHECK (
        auth.uid() = user_id 
        AND EXISTS (
            SELECT 1 FROM stream_viewers 
            WHERE stream_id = stream_chat.stream_id 
            AND user_id = auth.uid() 
            AND left_at IS NULL
        )
    );

-- Everyone can view stream chat
CREATE POLICY "stream_chat_select_policy" ON stream_chat
    FOR SELECT USING (true);

-- =============================================
-- VIRTUAL EVENTS POLICIES
-- =============================================

-- Everyone can view public events
CREATE POLICY "virtual_events_select_policy" ON virtual_events
    FOR SELECT USING (is_public = true);

-- Event organizers can manage their events
CREATE POLICY "virtual_events_manage_policy" ON virtual_events
    FOR ALL USING (auth.uid() = organizer_id);

-- Users can register for events
CREATE POLICY "event_attendees_insert_policy" ON event_attendees
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own event registrations
CREATE POLICY "event_attendees_select_policy" ON event_attendees
    FOR SELECT USING (
        auth.uid() = user_id 
        OR EXISTS (
            SELECT 1 FROM virtual_events 
            WHERE id = event_attendees.event_id 
            AND organizer_id = auth.uid()
        )
    );

-- =============================================
-- MINI-GAMES POLICIES
-- =============================================

-- Everyone can view active games
CREATE POLICY "mini_games_select_policy" ON mini_games
    FOR SELECT USING (is_active = true);

-- Users can create game sessions
CREATE POLICY "game_sessions_insert_policy" ON game_sessions
    FOR INSERT WITH CHECK (auth.uid() = host_user_id);

-- Users can view and manage sessions they're part of
CREATE POLICY "game_sessions_select_policy" ON game_sessions
    FOR SELECT USING (
        auth.uid() = host_user_id 
        OR EXISTS (
            SELECT 1 FROM game_session_players 
            WHERE session_id = game_sessions.id 
            AND user_id = auth.uid()
        )
    );

-- Users can join game sessions
CREATE POLICY "game_session_players_insert_policy" ON game_session_players
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- WHITEBOARDS POLICIES
-- =============================================

-- Users can view public whiteboards and their own
CREATE POLICY "whiteboards_select_policy" ON whiteboards
    FOR SELECT USING (
        is_public = true 
        OR auth.uid() = owner_id 
        OR EXISTS (
            SELECT 1 FROM whiteboard_collaborators 
            WHERE whiteboard_id = whiteboards.id 
            AND user_id = auth.uid()
        )
    );

-- Whiteboard owners can manage their whiteboards
CREATE POLICY "whiteboards_manage_policy" ON whiteboards
    FOR ALL USING (auth.uid() = owner_id);

-- Collaborators can edit whiteboards based on permissions
CREATE POLICY "whiteboards_collaborator_update_policy" ON whiteboards
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM whiteboard_collaborators 
            WHERE whiteboard_id = whiteboards.id 
            AND user_id = auth.uid() 
            AND permission_level IN ('edit', 'admin')
        )
    );

-- =============================================
-- AI RECOMMENDATIONS POLICIES
-- =============================================

-- Users can only view their own recommendations
CREATE POLICY "ai_recommendations_select_policy" ON ai_recommendations
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- CONTENT MODERATION POLICIES
-- =============================================

-- Users can view flags they created
CREATE POLICY "content_flags_select_policy" ON content_flags
    FOR SELECT USING (
        auth.uid() = reporter_id 
        OR EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (is_admin = true OR is_verified = true)
        )
    );

-- Users can create content flags
CREATE POLICY "content_flags_insert_policy" ON content_flags
    FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Only moderators and admins can update flags
CREATE POLICY "content_flags_update_policy" ON content_flags
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND (is_admin = true OR is_verified = true)
        )
    );

-- =============================================
-- REPUTATION LOGS POLICIES
-- =============================================

-- Users can view their own reputation logs
CREATE POLICY "reputation_logs_select_policy" ON reputation_logs
    FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- CIRCLE ENHANCEMENTS POLICIES
-- =============================================

-- Circle members can view circle events
CREATE POLICY "circle_events_select_policy" ON circle_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members 
            WHERE circle_id = circle_events.circle_id 
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM circles 
            WHERE id = circle_events.circle_id 
            AND is_private = false
        )
    );

-- Circle admins and moderators can manage events
CREATE POLICY "circle_events_manage_policy" ON circle_events
    FOR ALL USING (
        auth.uid() = organizer_id 
        OR EXISTS (
            SELECT 1 FROM circle_members 
            WHERE circle_id = circle_events.circle_id 
            AND user_id = auth.uid() 
            AND role IN ('admin', 'moderator')
        )
    );

-- Voice channel policies
CREATE POLICY "voice_channels_select_policy" ON circle_voice_channels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members 
            WHERE circle_id = circle_voice_channels.circle_id 
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "voice_participants_manage_policy" ON voice_channel_participants
    FOR ALL USING (auth.uid() = user_id);

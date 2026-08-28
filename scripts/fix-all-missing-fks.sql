-- FIX: Add all missing FK constraints that were preventing PostgREST joins
-- These missing FKs caused Supabase queries to silently fail, so features
-- like duels, mentions, gifts, etc. appeared broken in the frontend.

-- Profiles references
ALTER TABLE call_sessions ADD CONSTRAINT IF NOT EXISTS call_sessions_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE gift_transactions ADD CONSTRAINT IF NOT EXISTS gift_transactions_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE gifts ADD CONSTRAINT IF NOT EXISTS gifts_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE loop_duel_entries ADD CONSTRAINT IF NOT EXISTS loop_duel_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE loop_duels ADD CONSTRAINT IF NOT EXISTS loop_duels_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE nft_collections ADD CONSTRAINT IF NOT EXISTS nft_collections_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE theme_bundles ADD CONSTRAINT IF NOT EXISTS theme_bundles_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE themes ADD CONSTRAINT IF NOT EXISTS themes_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE user_gifts ADD CONSTRAINT IF NOT EXISTS user_gifts_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE user_mentions ADD CONSTRAINT IF NOT EXISTS user_mentions_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL;

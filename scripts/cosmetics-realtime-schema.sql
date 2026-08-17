-- Real-time cosmetics: publish inventory + profile changes so equipping,
-- purchasing and applying shop items updates everywhere live (no refresh).
-- Idempotent — re-running is safe (ADD TABLE on an already-published table
-- is a no-op).

ALTER PUBLICATION supabase_realtime ADD TABLE user_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

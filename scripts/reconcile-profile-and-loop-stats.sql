-- Data integrity reconciliation: several cached counters had drifted from
-- (or were never backed by) their real source-of-truth tables — a form of
-- the same "fake engagement" problem the product has otherwise moved away
-- from. Safe to re-run any time; it only recomputes counts from real rows.

-- profiles.followers_count / following_count vs the real follows table
UPDATE profiles p SET
  followers_count = (SELECT COUNT(*) FROM follows WHERE following_id = p.id),
  following_count = (SELECT COUNT(*) FROM follows WHERE follower_id = p.id);

-- loop_stats vs real loop_interactions / comments / branch rows
UPDATE loop_stats ls SET
  likes_count = (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = ls.loop_id AND interaction_type = 'like'),
  comments_count = (SELECT COUNT(*) FROM comments WHERE loop_id = ls.loop_id),
  branches_count = (SELECT COUNT(*) FROM loops WHERE parent_loop_id = ls.loop_id),
  shares_count = (SELECT COUNT(*) FROM loop_interactions WHERE loop_id = ls.loop_id AND interaction_type = 'share');

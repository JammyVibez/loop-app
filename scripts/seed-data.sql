-- Seed data for Loop Social Media Platform
-- Run this after the main schema

-- Insert sample users
INSERT INTO users (id, username, email, display_name, bio, avatar_url, is_verified, verification_level, is_premium, loop_coins) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'creativemind', 'creative@example.com', 'Creative Mind', 'Digital artist and creative thinker. Building loops that inspire and connect minds across the universe. 🌟✨', '/placeholder.svg?height=120&width=120', true, 'root', true, 2500),
('550e8400-e29b-41d4-a716-446655440002', 'storyteller', 'story@example.com', 'Story Teller', 'Weaving narratives that branch into infinite possibilities. Every story is a seed waiting to grow.', '/placeholder.svg?height=120&width=120', true, 'influencer', false, 1200),
('550e8400-e29b-41d4-a716-446655440003', 'musicmaker', 'music@example.com', 'Music Maker', 'Composing collaborative symphonies one loop at a time. Let''s make music together! 🎵', '/placeholder.svg?height=120&width=120', true, 'influencer', true, 3400),
('550e8400-e29b-41d4-a716-446655440004', 'visualartist', 'visual@example.com', 'Visual Artist', 'Painting digital dreams in pixels and code. Art is the bridge between imagination and reality.', '/placeholder.svg?height=120&width=120', false, null, true, 890),
('550e8400-e29b-41d4-a716-446655440005', 'philosopher', 'think@example.com', 'Deep Thinker', 'Exploring the depths of consciousness through collaborative thought experiments.', '/placeholder.svg?height=120&width=120', true, 'influencer', false, 560),
('550e8400-e29b-41d4-a716-446655440006', 'coder', 'code@example.com', 'Code Master', 'Building the future one algorithm at a time. Open source enthusiast and loop tree architect.', '/placeholder.svg?height=120&width=120', true, 'influencer', false, 1800);

-- Insert sample root loops
INSERT INTO loops (id, author_id, content_type, content, hashtags, is_root, tree_depth) VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'text', '{"text": "What if we could travel through time but only to witness, never to change anything? 🤔 This thought has been looping in my mind all day..."}', ARRAY['timetravel', 'philosophy'], true, 0),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'audio', '{"title": "Midnight Thoughts - Loop Starter", "duration": 45, "audio_url": "/placeholder-audio.mp3"}', ARRAY['musiccollab', 'beats'], true, 0),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 'image', '{"image_url": "/placeholder.svg?height=400&width=600", "caption": "Digital dreams in neon colors - what do you see in this abstract piece?"}', ARRAY['digitalart', 'abstract'], true, 0),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440006', 'text', '{"text": "// Recursive function to traverse loop trees\nfunction traverseTree(node) {\n  if (!node) return;\n  console.log(node.content);\n  node.branches.forEach(traverseTree);\n}"}', ARRAY['coding', 'javascript', 'algorithms'], true, 0);

-- Insert branch loops
INSERT INTO loops (id, author_id, parent_loop_id, content_type, content, hashtags, is_root, tree_depth) VALUES
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440001', 'text', '{"text": "That would be the ultimate documentary experience! Imagine witnessing historical moments firsthand but being bound by the observer effect. We''d become living archives of human history."}', ARRAY['timetravel', 'history'], false, 1),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440005', '660e8400-e29b-41d4-a716-446655440005', 'text', '{"text": "But would knowing the outcome of events change how we perceive the present? The weight of future knowledge might be unbearable."}', ARRAY['timetravel', 'philosophy'], false, 2),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440004', '660e8400-e29b-41d4-a716-446655440002', 'audio', '{"title": "Added some drums to your melody", "duration": 45, "audio_url": "/placeholder-audio-2.mp3"}', ARRAY['musiccollab', 'drums'], false, 1);

-- Insert loop statistics
INSERT INTO loop_stats (loop_id, likes_count, branches_count, comments_count, saves_count, views_count) VALUES
('660e8400-e29b-41d4-a716-446655440001', 15600, 234, 890, 1200, 25000),
('660e8400-e29b-41d4-a716-446655440002', 12400, 189, 567, 890, 18500),
('660e8400-e29b-41d4-a716-446655440003', 8900, 156, 234, 445, 12300),
('660e8400-e29b-41d4-a716-446655440004', 5600, 89, 123, 234, 8900),
('660e8400-e29b-41d4-a716-446655440005', 3400, 45, 67, 123, 5600),
('660e8400-e29b-41d4-a716-446655440006', 2100, 23, 34, 67, 3400),
('660e8400-e29b-41d4-a716-446655440007', 1800, 12, 23, 45, 2800);

-- Insert sample circles
INSERT INTO circles (id, name, description, category, creator_id, member_count) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'Creative Writers', 'A community for writers to share stories and collaborate on narrative loops', 'Writing', '550e8400-e29b-41d4-a716-446655440002', 1247),
('770e8400-e29b-41d4-a716-446655440002', 'Digital Artists Hub', 'Share your digital art and get feedback from fellow artists', 'Art', '550e8400-e29b-41d4-a716-446655440004', 892),
('770e8400-e29b-41d4-a716-446655440003', 'Music Producers', 'Collaborate on beats, share samples, and create musical loops together', 'Music', '550e8400-e29b-41d4-a716-446655440003', 634),
('770e8400-e29b-41d4-a716-446655440004', 'Philosophy Discussions', 'Deep conversations about life, existence, and everything in between', 'Philosophy', '550e8400-e29b-41d4-a716-446655440005', 456);

-- Insert circle memberships
INSERT INTO circle_members (circle_id, user_id, role, status) VALUES
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'member', 'active'),
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'admin', 'active'),
('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'member', 'active'),
('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005', 'admin', 'active');

-- Insert trending hashtags
INSERT INTO trending_hashtags (hashtag, usage_count, growth_rate, timeframe) VALUES
('timetravel', 15600, 234.5, '24h'),
('digitalart', 12400, 189.2, '24h'),
('musiccollab', 9800, 156.7, '24h'),
('scifi', 8900, 134.3, '24h'),
('philosophy', 7600, 112.8, '24h'),
('poetry', 6800, 98.4, '24h'),
('coding', 5900, 87.6, '24h'),
('photography', 5200, 76.2, '24h');

-- Insert shop items
INSERT INTO shop_items (name, description, category, price, rarity, item_data) VALUES
('Neon Cyber Theme', 'Futuristic neon colors with cyberpunk vibes', 'theme', 500, 'rare', '{"primary_color": "#00ff88", "secondary_color": "#00ccff"}'),
('Sunset Dream Theme', 'Warm sunset colors for a dreamy profile', 'theme', 300, 'common', '{"primary_color": "#ff6b6b", "secondary_color": "#ffa500"}'),
('Galaxy Explorer Theme', 'Deep space colors with stellar effects', 'theme', 800, 'legendary', '{"primary_color": "#667eea", "secondary_color": "#764ba2"}'),
('Rainbow Pulse Animation', 'Animated rainbow effect for your avatar', 'animation', 750, 'epic', '{"animation_type": "rainbow_pulse"}'),
('Sparkle Trail Animation', 'Magical sparkles that follow your avatar', 'animation', 600, 'rare', '{"animation_type": "sparkle_trail"}'),
('Golden Tree Skin', 'Make your loop trees shine with golden branches', 'effect', 1000, 'legendary', '{"effect_type": "golden_tree"}');

-- Insert developer projects
INSERT INTO developer_projects (id, author_id, title, description, language, framework, tags, code_snippet, stars_count, forks_count, views_count) VALUES
('880e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440006', 'React Loop Tree Component', 'A reusable React component for rendering interactive loop trees with animations', 'JavaScript', 'React', ARRAY['react', 'components', 'trees', 'animation'], 'import React, { useState } from ''react'';
import { TreeNode } from ''./TreeNode'';

export const LoopTree = ({ data, onBranch }) => {
  const [expanded, setExpanded] = useState(new Set());
  
  const toggleNode = (nodeId) => {
    setExpanded(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  return (
    <div className="loop-tree">
      <TreeNode 
        node={data} 
        expanded={expanded}
        onToggle={toggleNode}
        onBranch={onBranch}
      />
    </div>
  );
};', 234, 45, 1200);

-- Insert user follows
INSERT INTO user_follows (follower_id, following_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003'),
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001');

-- Insert sample notifications
INSERT INTO notifications (user_id, type, title, message, data) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'like', 'New like on your loop', 'storyteller liked your time travel loop', '{"loop_id": "660e8400-e29b-41d4-a716-446655440001", "user_id": "550e8400-e29b-41d4-a716-446655440002"}'),
('550e8400-e29b-41d4-a716-446655440001', 'branch', 'New branch created', 'musicmaker created a branch on your audio loop', '{"loop_id": "660e8400-e29b-41d4-a716-446655440002", "user_id": "550e8400-e29b-41d4-a716-446655440003"}'),
('550e8400-e29b-41d4-a716-446655440001', 'verification', 'Congratulations!', 'You''ve earned the Root Verified badge for your popular loop tree!', '{"verification_level": "root"}');

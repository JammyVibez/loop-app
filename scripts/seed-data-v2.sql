-- Enhanced seed data for Loop Social Media Platform
-- Version 2.0 with comprehensive test data

-- Insert test users with diverse profiles
INSERT INTO users (id, username, email, display_name, bio, avatar_url, is_verified, verification_level, is_premium, loop_coins) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'storyteller', 'storyteller@loop.com', 'Story Teller', 'Master of narrative loops and collaborative storytelling. Root verified creator.', '/placeholder.svg?height=80&width=80', true, 'root', true, 5000),
('550e8400-e29b-41d4-a716-446655440002', 'creativemind', 'creative@loop.com', 'Creative Mind', 'Digital artist exploring the intersection of visual art and interactive storytelling.', '/placeholder.svg?height=80&width=80', true, 'influencer', true, 3500),
('550e8400-e29b-41d4-a716-446655440003', 'musicmaker', 'music@loop.com', 'Music Maker', 'Composer creating audio loops and collaborative musical narratives.', '/placeholder.svg?height=80&width=80', false, null, false, 1200),
('550e8400-e29b-41d4-a716-446655440004', 'scifiwriter', 'scifi@loop.com', 'Sci-Fi Writer', 'Exploring futures through branching science fiction narratives.', '/placeholder.svg?height=80&width=80', false, null, true, 2800),
('550e8400-e29b-41d4-a716-446655440005', 'philosopher', 'philosophy@loop.com', 'Deep Thinker', 'Contemplating existence through philosophical loop discussions.', '/placeholder.svg?height=80&width=80', true, 'influencer', false, 1800),
('550e8400-e29b-41d4-a716-446655440006', 'newcreator', 'newbie@loop.com', 'New Creator', 'Just discovered Loop and excited to start my creative journey!', '/placeholder.svg?height=80&width=80', false, null, false, 100),
('550e8400-e29b-41d4-a716-446655440007', 'bookworm', 'books@loop.com', 'Book Worm', 'Literature enthusiast and community moderator.', '/placeholder.svg?height=80&width=80', false, null, true, 2200),
('550e8400-e29b-41d4-a716-446655440008', 'techwriter', 'tech@loop.com', 'Tech Writer', 'Documenting the future of AI and human creativity.', '/placeholder.svg?height=80&width=80', true, 'influencer', true, 4200),
('550e8400-e29b-41d4-a716-446655440009', 'novelist', 'novelist@loop.com', 'Aspiring Novelist', 'Working on my first novel through collaborative loops.', '/placeholder.svg?height=80&width=80', false, null, false, 800),
('550e8400-e29b-41d4-a716-446655440010', 'mixedmedia', 'mixed@loop.com', 'Mixed Media Artist', 'Blending traditional and digital art in interactive narratives.', '/placeholder.svg?height=80&width=80', true, 'influencer', true, 3800);

-- Insert hashtags
INSERT INTO hashtags (id, tag, usage_count, trending_score) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'timetravel', 15600, 2340.5),
('660e8400-e29b-41d4-a716-446655440002', 'digitalart', 12400, 1890.3),
('660e8400-e29b-41d4-a716-446655440003', 'musiccollab', 9800, 1560.8),
('660e8400-e29b-41d4-a716-446655440004', 'scifi', 8900, 1340.2),
('660e8400-e29b-41d4-a716-446655440005', 'philosophy', 7600, 1120.7),
('660e8400-e29b-41d4-a716-446655440006', 'creativity', 6800, 980.4),
('660e8400-e29b-41d4-a716-446655440007', 'storytelling', 5900, 870.9),
('660e8400-e29b-41d4-a716-446655440008', 'collaboration', 5200, 760.3),
('660e8400-e29b-41d4-a716-446655440009', 'synesthesia', 3400, 520.8),
('660e8400-e29b-41d4-a716-446655440010', 'emotions', 4100, 630.2),
('660e8400-e29b-41d4-a716-446655440011', 'interpretation', 2800, 420.5),
('660e8400-e29b-41d4-a716-446655440012', 'future', 7200, 1080.6),
('660e8400-e29b-41d4-a716-446655440013', 'ai', 9500, 1425.8),
('660e8400-e29b-41d4-a716-446655440014', 'creativechallenge', 4600, 690.4);

-- Insert circles (communities)
INSERT INTO circles (id, name, description, avatar_url, banner_url, category, creator_id, member_count, rules) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'Creative Writers', 'A community for writers to share stories and collaborate on narrative loops. We believe every story is a seed that can grow into magnificent trees of creativity.', '/placeholder.svg?height=80&width=80', '/placeholder.svg?height=200&width=800', 'Writing', '550e8400-e29b-41d4-a716-446655440001', 1247, ARRAY['Be respectful and constructive in all interactions', 'Original content only - no plagiarism', 'Use appropriate content warnings when necessary', 'Collaborate, don''t compete - help others grow their stories', 'Follow Loop''s community guidelines']),
('770e8400-e29b-41d4-a716-446655440002', 'Digital Artists', 'Visual creators exploring the boundaries of digital art and interactive media.', '/placeholder.svg?height=80&width=80', '/placeholder.svg?height=200&width=800', 'Art', '550e8400-e29b-41d4-a716-446655440002', 892, ARRAY['Share your creative process', 'Provide constructive feedback', 'Credit all collaborators', 'No AI-generated content without disclosure']),
('770e8400-e29b-41d4-a716-446655440003', 'Music Collaborators', 'Musicians and sound designers creating collaborative audio experiences.', '/placeholder.svg?height=80&width=80', '/placeholder.svg?height=200&width=800', 'Music', '550e8400-e29b-41d4-a716-446655440003', 634, ARRAY['Respect copyright and licensing', 'Share stems and project files when collaborating', 'Give credit to all contributors', 'Keep discussions music-focused']),
('770e8400-e29b-41d4-a716-446655440004', 'Sci-Fi Explorers', 'Science fiction enthusiasts building futures through collaborative narratives.', '/placeholder.svg?height=80&width=80', '/placeholder.svg?height=200&width=800', 'Science Fiction', '550e8400-e29b-41d4-a716-446655440004', 1156, ARRAY['Ground speculation in scientific possibility', 'Explore diverse perspectives and cultures', 'Avoid harmful stereotypes', 'Encourage hard and soft sci-fi equally']);

-- Insert circle memberships
INSERT INTO circle_memberships (circle_id, user_id, role) VALUES
-- Creative Writers circle
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'admin'),
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440007', 'moderator'),
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 'member'),
('770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'member'),
-- Digital Artists circle
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 'admin'),
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440010', 'member'),
-- Music Collaborators circle
('770e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440003', 'admin'),
-- Sci-Fi Explorers circle
('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440004', 'admin'),
('770e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440008', 'member');

-- Insert challenges
INSERT INTO challenges (id, circle_id, title, description, prize, ends_at, participant_count) VALUES
('880e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Time Travel Stories', 'Create a story loop about time travel. The most creative and engaging tree wins!', 'Premium subscription for 3 months + Featured story', '2024-01-22 23:59:59+00', 89),
('880e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', 'Synesthetic Art', 'Create visual art that represents sound, taste, or other sensory crossovers.', '5000 Loop Coins + Gallery feature', '2024-01-25 23:59:59+00', 45),
('880e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440003', 'Collaborative Symphony', 'Build a musical piece where each branch adds a new instrument or melody.', 'Professional recording session + Distribution', '2024-01-28 23:59:59+00', 23);

-- Insert events
INSERT INTO events (id, circle_id, title, description, event_date, attendee_count, created_by) VALUES
('990e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', 'Weekly Writing Workshop', 'Join us for collaborative writing sessions every Wednesday', '2024-01-17 19:00:00+00', 34, '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440001', 'Story Tree Review Session', 'Community feedback on the week''s best story trees', '2024-01-19 20:00:00+00', 28, '550e8400-e29b-41d4-a716-446655440007'),
('990e8400-e29b-41d4-a716-446655440003', '770e8400-e29b-41d4-a716-446655440002', 'Digital Art Showcase', 'Present your latest digital art loops and get community feedback', '2024-01-20 18:00:00+00', 19, '550e8400-e29b-41d4-a716-446655440002');

-- Insert root loops (starting points for trees)
INSERT INTO loops (id, author_id, content_type, content_text, hashtags, circle_id, is_challenge_entry, challenge_id, tree_depth, branch_path) VALUES
-- Time travel story loop
('aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'text', 'Once upon a time, in a world where stories could grow like trees, there lived a young inventor who discovered that time itself could branch... #timetravel #storytelling #creativechallenge', ARRAY['timetravel', 'storytelling', 'creativechallenge'], '770e8400-e29b-41d4-a716-446655440001', true, '880e8400-e29b-41d4-a716-446655440001', 0, 'aa0e8400-e29b-41d4-a716-446655440001'),

-- Philosophy loop
('aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', 'text', 'What if we could travel through time but only to witness, never to change anything? The observer paradox in temporal mechanics raises fascinating questions about free will and determinism. #timetravel #philosophy', ARRAY['timetravel', 'philosophy'], null, false, null, 0, 'aa0e8400-e29b-41d4-a716-446655440002'),

-- Digital art loop
('aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440010', 'image', 'What if colors had emotions? This piece explores synesthesia through digital art. Add your interpretation! #synesthesia #digitalart #emotions', ARRAY['synesthesia', 'digitalart', 'emotions'], '770e8400-e29b-41d4-a716-446655440002', true, '880e8400-e29b-41d4-a716-446655440002', 0, 'aa0e8400-e29b-41d4-a716-446655440003'),

-- Recent loops
('aa0e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440006', 'text', 'Just discovered Loop and I''m amazed by the collaborative storytelling possibilities! Starting my first tree about #digitalart and #creativity 🎨', ARRAY['digitalart', 'creativity'], null, false, null, 0, 'aa0e8400-e29b-41d4-a716-446655440004'),

('aa0e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440008', 'text', 'The future of AI and human creativity: What happens when machines can branch our thoughts? #ai #future #philosophy', ARRAY['ai', 'future', 'philosophy'], null, false, null, 0, 'aa0e8400-e29b-41d4-a716-446655440005'),

-- Music collaboration loop
('aa0e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 'audio', 'Starting a collaborative symphony - here''s the opening melody. Who wants to add the next instrument? #musiccollab #collaboration', ARRAY['musiccollab', 'collaboration'], '770e8400-e29b-41d4-a716-446655440003', true, '880e8400-e29b-41d4-a716-446655440003', 0, 'aa0e8400-e29b-41d4-a716-446655440006');

-- Insert branch loops (children of root loops)
INSERT INTO loops (id, author_id, parent_id, content_type, content_text, hashtags, tree_depth, branch_path) VALUES
-- Branches of the time travel story
('bb0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440009', 'aa0e8400-e29b-41d4-a716-446655440001', 'text', 'The protagonist discovered that each choice created a new branch in reality itself. But what if someone else was already manipulating these branches? #timetravel #mystery', ARRAY['timetravel', 'mystery'], 1, 'aa0e8400-e29b-41d4-a716-446655440001.bb0e8400-e29b-41d4-a716-446655440001'),

('bb0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440001', 'text', 'Alternatively, what if the inventor realized that the machine didn''t create new timelines, but revealed that all possibilities already existed simultaneously? #timetravel #scifi #multiverse', ARRAY['timetravel', 'scifi', 'multiverse'], 1, 'aa0e8400-e29b-41d4-a716-446655440001.bb0e8400-e29b-41d4-a716-446655440002'),

-- Branches of philosophy loop
('bb0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440008', 'aa0e8400-e29b-41d4-a716-446655440002', 'text', 'This reminds me of quantum mechanics where observation changes the outcome. What if time travel works the same way - the act of witnessing changes what you witness? #philosophy #quantum #timetravel', ARRAY['philosophy', 'quantum', 'timetravel'], 1, 'aa0e8400-e29b-41d4-a716-446655440002.bb0e8400-e29b-41d4-a716-446655440003'),

-- Second level branches
('cc0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'bb0e8400-e29b-41d4-a716-446655440001', 'text', 'The manipulator turned out to be the inventor''s future self, trying to prevent a catastrophic timeline where the technology fell into the wrong hands... #timetravel #paradox', ARRAY['timetravel', 'paradox'], 2, 'aa0e8400-e29b-41d4-a716-446655440001.bb0e8400-e29b-41d4-a716-446655440001.cc0e8400-e29b-41d4-a716-446655440001');

-- Insert loop statistics
INSERT INTO loop_stats (loop_id, likes_count, branches_count, comments_count, saves_count, creativity_score) VALUES
('aa0e8400-e29b-41d4-a716-446655440001', 2340, 47, 234, 567, 95.8),
('aa0e8400-e29b-41d4-a716-446655440002', 1560, 12, 89, 234, 87.3),
('aa0e8400-e29b-41d4-a716-446655440003', 1890, 23, 156, 445, 98.5),
('aa0e8400-e29b-41d4-a716-446655440004', 23, 2, 8, 12, 72.1),
('aa0e8400-e29b-41d4-a716-446655440005', 156, 8, 34, 67, 84.7),
('aa0e8400-e29b-41d4-a716-446655440006', 89, 5, 23, 34, 79.2),
('bb0e8400-e29b-41d4-a716-446655440001', 456, 12, 67, 123, 88.9),
('bb0e8400-e29b-41d4-a716-446655440002', 234, 8, 45, 89, 82.4),
('bb0e8400-e29b-41d4-a716-446655440003', 178, 6, 32, 56, 85.1),
('cc0e8400-e29b-41d4-a716-446655440001', 89, 3, 21, 34, 81.7);

-- Insert some loop interactions (likes, saves)
INSERT INTO loop_interactions (user_id, loop_id, interaction_type) VALUES
-- Likes for the time travel story
('550e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440001', 'like'),
('550e8400-e29b-41d4-a716-446655440003', 'aa0e8400-e29b-41d4-a716-446655440001', 'like'),
('550e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440001', 'like'),
('550e8400-e29b-41d4-a716-446655440005', 'aa0e8400-e29b-41d4-a716-446655440001', 'like'),
('550e8400-e29b-41d4-a716-446655440006', 'aa0e8400-e29b-41d4-a716-446655440001', 'save'),
('550e8400-e29b-41d4-a716-446655440007', 'aa0e8400-e29b-41d4-a716-446655440001', 'save'),

-- Likes for digital art
('550e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440003', 'like'),
('550e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440003', 'like'),
('550e8400-e29b-41d4-a716-446655440003', 'aa0e8400-e29b-41d4-a716-446655440003', 'save'),

-- Likes for philosophy loop
('550e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440002', 'like'),
('550e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440002', 'like'),
('550e8400-e29b-41d4-a716-446655440008', 'aa0e8400-e29b-41d4-a716-446655440002', 'save');

-- Insert comments
INSERT INTO comments (id, loop_id, author_id, content, likes_count) VALUES
('dd0e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'This is such a fascinating concept! I love how you''ve explored the philosophical implications of time travel.', 23),
('dd0e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 'This reminds me of the concept in quantum mechanics where observation changes the outcome. What if time travel works the same way?', 15),
('dd0e8400-e29b-41d4-a716-446655440003', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'The way you''ve visualized synesthesia is incredible. It makes me wonder what music would look like in your artistic style.', 34),
('dd0e8400-e29b-41d4-a716-446655440004', 'aa0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440005', 'Exactly! The observer paradox in time travel is something that deserves more exploration.', 8);

-- Insert comment replies
INSERT INTO comments (id, loop_id, author_id, parent_comment_id, content, likes_count) VALUES
('ee0e8400-e29b-41d4-a716-446655440001', 'aa0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005', 'dd0e8400-e29b-41d4-a716-446655440001', 'Exactly! The observer paradox in time travel is something that deserves more exploration.', 8),
('ee0e8400-e29b-41d4-a716-446655440002', 'aa0e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440010', 'dd0e8400-e29b-41d4-a716-446655440003', 'Thank you! I''m actually working on a series that explores different senses through visual art. Music visualization is next!', 12);

-- Insert follows
INSERT INTO follows (follower_id, following_id) VALUES
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440005'),
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005'),
('550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440005');

-- Insert conversations for chat system
INSERT INTO conversations (id, type, created_by) VALUES
('ff0e8400-e29b-41d4-a716-446655440001', 'direct', '550e8400-e29b-41d4-a716-446655440001'),
('ff0e8400-e29b-41d4-a716-446655440002', 'direct', '550e8400-e29b-41d4-a716-446655440003');

-- Insert conversation participants
INSERT INTO conversation_participants (conversation_id, user_id) VALUES
('ff0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001'),
('ff0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'),
('ff0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001'),
('ff0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003');

-- Insert messages
INSERT INTO messages (id, conversation_id, sender_id, content, message_type) VALUES
('gg0e8400-e29b-41d4-a716-446655440001', 'ff0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Hey! I saw your time travel loop and it got me thinking...', 'text'),
('gg0e8400-e29b-41d4-a716-446655440002', 'ff0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Oh really? What did you think about?', 'text'),
('gg0e8400-e29b-41d4-a716-446655440003', 'ff0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'What if we created a collaborative story loop where each branch explores a different time period?', 'text'),
('gg0e8400-e29b-41d4-a716-446655440004', 'ff0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'That''s a fascinating loop idea! Want to collaborate?', 'text'),
('gg0e8400-e29b-41d4-a716-446655440005', 'ff0e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'Thanks for the feedback on my audio loop!', 'text');

-- Insert shop items
INSERT INTO shop_items (id, name, description, price, category, item_type, is_premium_only) VALUES
('hh0e8400-e29b-41d4-a716-446655440001', 'Cosmic Theme', 'A beautiful space-themed profile with animated stars', 500, 'Themes', 'theme', false),
('hh0e8400-e29b-41d4-a716-446655440002', 'Forest Guardian Frame', 'Animated tree frame for your avatar', 300, 'Avatar Frames', 'avatar_frame', false),
('hh0e8400-e29b-41d4-a716-446655440003', 'Premium Glow Effect', 'Exclusive glowing animation for premium users', 1000, 'Animations', 'animation', true),
('hh0e8400-e29b-41d4-a716-446655440004', 'Story Master Badge', 'Show off your storytelling achievements', 750, 'Badges', 'badge', false),
('hh0e8400-e29b-41d4-a716-446655440005', 'Rainbow Gradient Theme', 'Colorful animated background theme', 400, 'Themes', 'theme', false);

-- Insert notifications
INSERT INTO notifications (id, user_id, type, title, content, is_read) VALUES
('ii0e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41

-- Add reward redemption functionality to existing tables

-- Create quest rewards table for tracking available rewards
CREATE TABLE IF NOT EXISTS quest_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID REFERENCES shop_items(id) ON DELETE CASCADE,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE,
  is_redeemed BOOLEAN DEFAULT FALSE,
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create weekly bonus claims table
CREATE TABLE IF NOT EXISTS weekly_bonus_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  bonus_amount INTEGER NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to redeem quest rewards
CREATE OR REPLACE FUNCTION redeem_quest_reward(
  p_user_id UUID,
  p_reward_id UUID,
  p_item_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Mark reward as redeemed
  UPDATE quest_rewards 
  SET is_redeemed = TRUE, redeemed_at = NOW()
  WHERE id = p_reward_id AND user_id = p_user_id;

  -- Add item to user inventory
  INSERT INTO user_inventory (user_id, item_id, acquired_from, acquired_at)
  VALUES (p_user_id, p_item_id, 'quest_reward', NOW())
  ON CONFLICT (user_id, item_id) DO NOTHING;

  -- Log the transaction
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, 0, 'reward_redemption', 'Redeemed quest reward');
END;
$$ LANGUAGE plpgsql;

-- Create function to award weekly bonus
CREATE OR REPLACE FUNCTION award_weekly_bonus(
  p_user_id UUID,
  p_bonus_amount INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Update user's loop coins
  UPDATE profiles 
  SET loop_coins = loop_coins + p_bonus_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Record the weekly bonus claim
  INSERT INTO weekly_bonus_claims (user_id, bonus_amount)
  VALUES (p_user_id, p_bonus_amount);

  -- Log the transaction
  INSERT INTO coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, p_bonus_amount, 'weekly_bonus', 'Weekly bonus coins');
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quest_rewards_user_id ON quest_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_quest_rewards_redeemed ON quest_rewards(is_redeemed);
CREATE INDEX IF NOT EXISTS idx_weekly_bonus_claims_user_id ON weekly_bonus_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_bonus_claims_date ON weekly_bonus_claims(claimed_at);

-- Add quest reward items to shop_items
INSERT INTO shop_items (name, description, price_coins, category, item_type, rarity, premium_only, item_data, preview_data, is_active, quest_reward) VALUES
('Quest Master Theme', 'Exclusive theme for completing 10 quests', 0, 'theme', 'theme', 'epic', false, '{"colors": {"primary": "#8B5CF6", "secondary": "#06B6D4"}}', '{"preview": "linear-gradient(135deg, #8B5CF6, #06B6D4)"}', true, true),
('Daily Streak Effect', 'Special effect for 7-day login streak', 0, 'effect', 'particle_effect', 'rare', false, '{"effect_type": "streak_particles", "duration": 3000}', '{"preview": "✨"}', true, true),
('Coin Master Animation', 'Animated coin flip for earning 1000+ coins', 0, 'animation', 'ui_animation', 'legendary', false, '{"animation": "coin_flip", "trigger": "coin_earn"}', '{"preview": "🪙"}', true, true),
('Quest Warrior Badge', 'Badge theme for quest completions', 0, 'theme', 'badge', 'rare', false, '{"badge_style": "warrior", "glow": true}', '{"preview": "🏆"}', true, true),
('Premium Unlock Theme', 'Special theme unlocked through quests', 0, 'theme', 'theme', 'legendary', true, '{"colors": {"primary": "#FFD700", "secondary": "#FF6B6B"}}', '{"preview": "linear-gradient(135deg, #FFD700, #FF6B6B)"}', true, true)
ON CONFLICT (name) DO NOTHING;

-- Economy / claim faucet settings (admin toggles)
INSERT INTO admin_settings (setting_key, setting_value, updated_at)
VALUES (
  'economy',
  '{
    "daily_claim_enabled": true,
    "weekly_claim_enabled": true,
    "daily_amount": 12,
    "daily_pro_amount": 25,
    "weekly_amount": 50,
    "signup_bonus": 50,
    "onboarding_bonus": 25,
    "streak_bonus_enabled": true,
    "streak_bonus_days": 7,
    "streak_bonus_amount": 5
  }'::jsonb,
  NOW()
)
ON CONFLICT (setting_key) DO NOTHING;

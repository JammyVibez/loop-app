-- Boosting a loop never actually charged the booster — POST
-- /api/loops/[id]/boost only tracked pooled progress on the loop itself and
-- never touched profiles.loop_coins or wrote a ledger entry, so anyone could
-- "spend" unlimited coins boosting posts for free. Add 'boost_spent' to the
-- allowed coin_transactions types so the API can record a real ledger entry
-- once it actually deducts the balance.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE rel.relname = 'coin_transactions'
    AND nsp.nspname = 'public'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%transaction_type%'
  ORDER BY con.conname
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE coin_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;

  BEGIN
    ALTER TABLE coin_transactions
      ADD CONSTRAINT coin_transactions_transaction_type_check
      CHECK (transaction_type IN (
        'purchase',
        'gift_sent',
        'gift_received',
        'quest_reward',
        'weekly_bonus',
        'daily_checkin',
        'onboarding_bonus',
        'admin_grant',
        'admin_reward',
        'premium_purchase',
        'refund',
        'level_reward',
        'earning_payout',
        'boost_spent'
      ));
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

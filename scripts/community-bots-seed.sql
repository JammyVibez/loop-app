-- ============================================================================
-- Official community bots — purchasable from the marketplace.
-- Idempotent: re-running never duplicates (matched by title).
-- ============================================================================

DO $$
DECLARE
  bot jsonb;
BEGIN
  FOR bot IN SELECT * FROM jsonb_array_elements($bots$[
    {
      "title": "Welcome Bot",
      "description": "Greets every new member the moment they join your circle — warm intro, rules reminder, and a nudge to pick a role. Fully customizable messages.",
      "listing_type": "bot",
      "price_coins": 500,
      "tags": ["welcome", "automation", "official"],
      "is_featured": true,
      "payload": {
        "bot_type": "welcome",
        "name": "Welcome Bot",
        "configuration": {
          "tone": "warm",
          "greet_in_general": true,
          "mention_new_member": true,
          "rules_message": "Be kind, stay on topic, and follow the circle rules."
        },
        "triggers": ["member_join"],
        "messages": {
          "welcome": "👋 Welcome to the circle! Introduce yourself and tell everyone what you're here for.",
          "rules": "Quick reminder: be respectful, no spam, and have fun!"
        },
        "logic": {
          "cooldown_minutes": 5,
          "max_per_day": 50
        }
      }
    },
    {
      "title": "Moderation Bot",
      "description": "Watches every message in your circle's channels — auto-flags spam, harassment, and banned words, warns repeat offenders, and alerts your moderators. Rule list is fully editable after install.",
      "listing_type": "bot",
      "price_coins": 1200,
      "tags": ["moderation", "automation", "official"],
      "is_featured": true,
      "payload": {
        "bot_type": "moderation",
        "name": "Moderation Bot",
        "configuration": {
          "auto_remove": true,
          "warn_user": true,
          "notify_moderators": true,
          "moderation": {
            "banned_words": ["scam", "click here", "free coins", "dm me now", "buy followers"],
            "max_links_per_message": 3,
            "max_mentions_per_message": 10,
            "spam_window_minutes": 2,
            "max_messages_in_window": 6,
            "delete_message": true,
            "warn_message": "Your message was removed by the Moderation Bot — it looks like it may violate this circle's rules."
          }
        },
        "triggers": ["chat_message"],
        "messages": {
          "warning": "⚠️ Please keep messages respectful and on-topic. Repeated violations may lead to a mute.",
          "removed_notice": "🛡️ A message was removed by Moderation Bot for violating the circle rules."
        },
        "logic": {
          "cooldown_minutes": 1,
          "max_replies_per_hour": 60
        }
      }
    }
  ]$bots$)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM community_marketplace_listings WHERE title = bot->>'title') THEN
      INSERT INTO community_marketplace_listings (
        seller_id, listing_type, title, description, price_coins,
        payload, tags, is_published, is_featured, sales_count, created_at, updated_at
      )
      VALUES (
        NULL,
        bot->>'listing_type',
        bot->>'title',
        bot->>'description',
        COALESCE((bot->>'price_coins')::int, 0),
        COALESCE(bot->'payload', '{}'::jsonb),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(bot->'tags')), '{}'::text[]),
        TRUE,
        COALESCE((bot->>'is_featured')::boolean, FALSE),
        0,
        NOW(),
        NOW()
      );
      RAISE NOTICE 'Seeded marketplace bot: %', bot->>'title';
    END IF;
  END LOOP;
END $$;

-- circle_event_participants was created with two faults that made community
-- event RSVPs impossible:
--
--   1. event_id had a FOREIGN KEY pointing at circle_event_participants(id)
--      — i.e. the table referenced itself instead of circle_events(id), so an
--      RSVP could only be stored if some participant row happened to share its
--      id. Nullable, so it failed silently rather than loudly.
--   2. There was no UNIQUE constraint on (event_id, user_id), while the RSVP
--      route upserts with `onConflict: "event_id,user_id"`. Postgres rejects
--      that outright ("no unique or exclusion constraint matching the ON
--      CONFLICT specification"), so POST /events/[eventId]/participants 500s
--      for every user, on every event.
--
-- Idempotent: safe to re-run.

-- 1. Drop the self-referencing FK.
ALTER TABLE circle_event_participants
  DROP CONSTRAINT IF EXISTS circle_event_participants_event_id_fkey;

-- 2. Remove rows that RSVP'd to nothing (event_id NULL) or to an event that no
--    longer exists, so the correct FK below can be attached cleanly.
DELETE FROM circle_event_participants WHERE event_id IS NULL;
DELETE FROM circle_event_participants p
WHERE p.event_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM circle_events e WHERE e.id = p.event_id);

-- 3. Re-attach event_id to the right table.
ALTER TABLE circle_event_participants
  ADD CONSTRAINT circle_event_participants_event_id_fkey
  FOREIGN KEY (event_id) REFERENCES circle_events(id) ON DELETE CASCADE;

-- 4. The constraint the RSVP upsert already assumes exists.
CREATE UNIQUE INDEX IF NOT EXISTS circle_event_participants_event_user_key
  ON circle_event_participants (event_id, user_id);

-- 5. Resync the denormalized attendee counter from real RSVPs (the old broken
--    path left events pointing at participant counts that didn't exist).
UPDATE circle_events e
SET participant_count = COALESCE(
  (
    SELECT COUNT(*)
    FROM circle_event_participants p
    WHERE p.event_id = e.id AND p.status = 'attending'
  ),
  0
);

-- Per-message link previews
--
-- Chat renders a rich preview card for any URL in a message. Sometimes the link
-- is the point and the card is noise, so the author can turn it off — and turn
-- it back on, which means the choice has to be persisted rather than being a
-- client-only toggle that vanishes on reload.
--
-- Idempotent.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS link_preview_disabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN messages.link_preview_disabled IS
  'Author hid the rich link preview card for this message.';

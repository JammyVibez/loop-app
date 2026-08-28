-- Add custom button labels for duel sides
-- For standard duels: side_a_label and side_b_label replace "Side A" / "Side B"
-- For clutch duels: they replace "YES" / "NO" on the voting buttons
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS side_a_label TEXT;
ALTER TABLE public.loop_duels ADD COLUMN IF NOT EXISTS side_b_label TEXT;

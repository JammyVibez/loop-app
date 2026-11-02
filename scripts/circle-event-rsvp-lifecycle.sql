-- Circle event RSVP lifecycle.
-- Run after scripts/circles-enhancements-schema.sql and
-- scripts/fix-circle-event-participants.sql.
--
-- This function serializes capacity changes by locking the event row. It keeps
-- participant_count in sync with the actual attending rows and supports
-- pending/declined RSVP states without reserving a seat before approval.

CREATE UNIQUE INDEX IF NOT EXISTS circle_event_participants_event_user_key
  ON public.circle_event_participants (event_id, user_id);


CREATE OR REPLACE FUNCTION public.set_circle_event_rsvp(
  p_event_id UUID,
  p_user_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_row public.circle_events%ROWTYPE;
  previous_status TEXT;
  attendee_total INTEGER;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('pending', 'attending', 'declined') THEN
    RAISE EXCEPTION 'invalid_rsvp_status' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO event_row
  FROM public.circle_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'circle_event_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF event_row.ends_at IS NOT NULL AND event_row.ends_at < NOW() THEN
    RAISE EXCEPTION 'circle_event_ended' USING ERRCODE = '22023';
  END IF;

  SELECT status
  INTO previous_status
  FROM public.circle_event_participants
  WHERE event_id = p_event_id AND user_id = p_user_id;

  IF p_status = 'attending'
     AND COALESCE(previous_status, '') <> 'attending'
     AND event_row.max_participants IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER
    INTO attendee_total
    FROM public.circle_event_participants
    WHERE event_id = p_event_id AND status = 'attending';

    IF attendee_total >= event_row.max_participants THEN
      RAISE EXCEPTION 'circle_event_full' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.circle_event_participants (event_id, user_id, status)
  VALUES (p_event_id, p_user_id, p_status)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status;

  SELECT COUNT(*)::INTEGER
  INTO attendee_total
  FROM public.circle_event_participants
  WHERE event_id = p_event_id AND status = 'attending';

  UPDATE public.circle_events
  SET participant_count = attendee_total
  WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'event_id', p_event_id,
    'status', p_status,
    'participant_count', attendee_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_event_rsvp(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_circle_event_rsvp(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.set_circle_event_rsvp(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_circle_event_rsvp(UUID, UUID, TEXT) TO service_role;

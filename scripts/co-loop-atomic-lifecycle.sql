-- Atomic Co-Loop version history writer.
-- This runs after the session, open-invite, and version tables exist.

-- Atomic version allocation and snapshot insert.
-- Locking the owning session row serializes concurrent saves for one room.
CREATE OR REPLACE FUNCTION public.create_co_loop_version(
    p_session_id TEXT,
    p_actor_id UUID,
    p_title TEXT,
    p_content TEXT,
    p_hashtags JSONB,
    p_media_url TEXT,
    p_media_urls JSONB,
    p_media_type TEXT,
    p_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    locked_session public.co_loop_sessions%ROWTYPE;
    actor_profile public.profiles%ROWTYPE;
    next_version INTEGER;
    saved_version public.co_loop_versions%ROWTYPE;
    allowed BOOLEAN := false;
BEGIN
    SELECT *
      INTO locked_session
      FROM public.co_loop_sessions
     WHERE session_id = p_session_id
     FOR UPDATE;

    IF NOT FOUND OR locked_session.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'co_loop_unavailable' USING ERRCODE = 'P0002';
    END IF;
    IF locked_session.status <> 'active' THEN
        RAISE EXCEPTION 'co_loop_inactive' USING ERRCODE = '55000';
    END IF;
    IF locked_session.locked AND locked_session.owner_id <> p_actor_id THEN
        RAISE EXCEPTION 'co_loop_locked' USING ERRCODE = '42501';
    END IF;

    allowed := locked_session.owner_id = p_actor_id
        OR EXISTS (
            SELECT 1
              FROM jsonb_array_elements(
                    CASE
                      WHEN jsonb_typeof(locked_session.co_authors) = 'array'
                      THEN locked_session.co_authors
                      ELSE '[]'::jsonb
                    END
              ) AS author
             WHERE author->>'id' = p_actor_id::text
        )
        OR EXISTS (
            SELECT 1
              FROM public.open_co_loop_participants AS participant
             WHERE participant.session_id = p_session_id
               AND participant.user_id = p_actor_id
        );

    IF NOT allowed THEN
        RAISE EXCEPTION 'co_loop_participant_required' USING ERRCODE = '42501';
    END IF;

    IF p_media_type NOT IN ('text', 'image', 'video') THEN
        RAISE EXCEPTION 'invalid_media_type' USING ERRCODE = '22023';
    END IF;
    IF length(COALESCE(p_title, '')) > 300 OR length(COALESCE(p_content, '')) > 40000 THEN
        RAISE EXCEPTION 'version_content_too_large' USING ERRCODE = '22001';
    END IF;

    SELECT COALESCE(MAX(version_number), 0) + 1
      INTO next_version
      FROM public.co_loop_versions
     WHERE session_id = p_session_id;

    SELECT *
      INTO actor_profile
      FROM public.profiles
     WHERE id = p_actor_id;

    INSERT INTO public.co_loop_versions (
        session_id, version_number, title, content, hashtags, media_url,
        media_urls, media_type, co_authors, label, saved_by_id,
        saved_by_name, saved_by_avatar
    )
    VALUES (
        p_session_id,
        next_version,
        COALESCE(p_title, ''),
        COALESCE(p_content, ''),
        COALESCE(p_hashtags, '[]'::jsonb),
        p_media_url,
        COALESCE(p_media_urls, '[]'::jsonb),
        p_media_type,
        COALESCE(locked_session.co_authors, '[]'::jsonb),
        CASE
          WHEN NULLIF(BTRIM(p_label), '') IS NOT NULL THEN LEFT(BTRIM(p_label), 120)
          WHEN next_version = 1 THEN 'Initial Draft'
          ELSE 'Checkpoint #' || next_version::text
        END,
        p_actor_id,
        COALESCE(actor_profile.display_name, actor_profile.username, 'Collaborator'),
        actor_profile.avatar_url
    )
    RETURNING * INTO saved_version;

    UPDATE public.co_loop_sessions
       SET updated_at = NOW()
     WHERE session_id = p_session_id;

    RETURN TO_JSONB(saved_version);
END;
$$;

REVOKE ALL ON FUNCTION public.create_co_loop_version(
    TEXT, UUID, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_co_loop_version(
    TEXT, UUID, TEXT, TEXT, JSONB, TEXT, JSONB, TEXT, TEXT
) TO service_role;


-- Atomically reserve a collaborator slot and update the durable room roster.
-- The session row lock serializes simultaneous joins for the same Co-Loop.
CREATE OR REPLACE FUNCTION public.join_open_co_loop_session(
    p_session_id TEXT,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    room public.co_loop_sessions%ROWTYPE;
    profile public.profiles%ROWTYPE;
    existing_participant BOOLEAN;
    participant_count INTEGER;
    capacity INTEGER;
    co_author JSONB;
    final_roster JSONB;
BEGIN
    SELECT *
      INTO room
      FROM public.co_loop_sessions
     WHERE session_id = p_session_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF room.deleted_at IS NOT NULL THEN
        RAISE EXCEPTION 'session_deleted' USING ERRCODE = '55000';
    END IF;
    IF room.status <> 'active' THEN
        RAISE EXCEPTION 'session_inactive' USING ERRCODE = '55000';
    END IF;
    IF NOT COALESCE(room.is_open_invite, false) THEN
        RAISE EXCEPTION 'session_not_open' USING ERRCODE = '42501';
    END IF;

    capacity := LEAST(4, GREATEST(2, COALESCE(room.max_collaborators, 4)));

    SELECT *
      INTO profile
      FROM public.profiles
     WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
    END IF;

    SELECT COUNT(*)::INTEGER
      INTO participant_count
      FROM public.open_co_loop_participants
     WHERE session_id = p_session_id;

    IF room.owner_id = p_user_id THEN
        RETURN jsonb_build_object(
            'owner_id', room.owner_id,
            'owner_username', room.owner_username,
            'topic', COALESCE(room.open_invite_topic, ''),
            'current_count', participant_count + 1,
            'max', capacity,
            'is_full', participant_count + 1 >= capacity,
            'already_joined', true,
            'is_owner', true,
            'co_author_entry', NULL
        );
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM public.open_co_loop_participants
         WHERE session_id = p_session_id AND user_id = p_user_id
    ) INTO existing_participant;

    co_author := jsonb_build_object(
        'id', p_user_id::text,
        'username', COALESCE(profile.username, 'collaborator'),
        'display_name', COALESCE(profile.display_name, profile.username, 'Co-Author'),
        'avatar_url', profile.avatar_url,
        'role', 'Co-Author'
    );

    IF existing_participant THEN
        RETURN jsonb_build_object(
            'owner_id', room.owner_id,
            'owner_username', room.owner_username,
            'topic', COALESCE(room.open_invite_topic, ''),
            'current_count', participant_count + 1,
            'max', capacity,
            'is_full', participant_count + 1 >= capacity,
            'already_joined', true,
            'is_owner', false,
            'co_author_entry', co_author
        );
    END IF;

    IF participant_count + 1 >= capacity THEN
        RAISE EXCEPTION 'session_full' USING ERRCODE = '23514';
    END IF;

    INSERT INTO public.open_co_loop_participants(session_id, user_id)
    VALUES (p_session_id, p_user_id)
    ON CONFLICT (session_id, user_id) DO NOTHING;

    final_roster := CASE
        WHEN EXISTS (
            SELECT 1
              FROM jsonb_array_elements(
                    CASE WHEN jsonb_typeof(room.co_authors) = 'array'
                         THEN room.co_authors ELSE '[]'::jsonb END
              ) AS entry
             WHERE entry->>'id' = p_user_id::text
        )
        THEN COALESCE(room.co_authors, '[]'::jsonb)
        ELSE COALESCE(room.co_authors, '[]'::jsonb) || jsonb_build_array(co_author)
    END;

    UPDATE public.co_loop_sessions
       SET co_authors = final_roster,
           updated_at = NOW()
     WHERE session_id = p_session_id;

    participant_count := participant_count + 1;

    IF room.feed_post_id IS NOT NULL THEN
        UPDATE public.loops
           SET content_metadata =
               COALESCE(content_metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'is_open_coloop_invite', true,
                   'session_id', p_session_id,
                   'max_collaborators', capacity,
                   'topic', COALESCE(room.open_invite_topic, ''),
                   'current_participants', participant_count + 1,
                   'status', CASE WHEN participant_count + 1 >= capacity THEN 'full' ELSE 'open' END
               )
         WHERE id::text = room.feed_post_id;
    END IF;

    RETURN jsonb_build_object(
        'owner_id', room.owner_id,
        'owner_username', room.owner_username,
        'topic', COALESCE(room.open_invite_topic, ''),
        'current_count', participant_count + 1,
        'max', capacity,
        'is_full', participant_count + 1 >= capacity,
        'already_joined', false,
        'is_owner', false,
        'co_author_entry', co_author
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_open_co_loop_session(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_open_co_loop_session(TEXT, UUID) TO service_role;

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Best-effort hard delete of a circle and related rows.
 * Relies on ON DELETE CASCADE when present; otherwise deletes known children first.
 */
export async function hardDeleteCircle(supabase: SupabaseClient, circleId: string) {
  const childTables = [
    "circle_post_poll_votes",
    "circle_post_polls",
    "circle_post_interactions",
    "circle_post_comments",
    "circle_room_message_reactions",
    "circle_room_messages",
    "circle_room_presence",
    "circle_event_participants",
    "circle_events",
    "circle_rooms",
    "circle_posts",
    "circle_members",
    "circle_invitations",
    "circle_join_requests",
    "circle_bots",
    "circle_challenges",
    "circle_voice_channels",
  ]

  for (const table of childTables) {
    try {
      await supabase.from(table).delete().eq("circle_id", circleId)
    } catch {
      // Table may not exist — ignore
    }
  }

  // Also clear bio tags pointing at this circle (best-effort; jsonb contains)
  try {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, tagged_circles")
      .not("tagged_circles", "eq", "[]")
      .limit(500)

    for (const profile of profiles || []) {
      const tags = Array.isArray(profile.tagged_circles) ? profile.tagged_circles : []
      const next = tags.filter((t: any) => t?.id !== circleId)
      if (next.length !== tags.length) {
        await supabase.from("profiles").update({ tagged_circles: next }).eq("id", profile.id)
      }
    }
  } catch {
    // Column may not exist yet
  }

  const { error } = await supabase.from("circles").delete().eq("id", circleId)
  return { error }
}

export async function setCircleActive(
  supabase: SupabaseClient,
  circleId: string,
  isActive: boolean,
  actorId: string,
) {
  const { data, error } = await supabase
    .from("circles")
    .update({
      is_active: isActive,
      deactivated_at: isActive ? null : new Date().toISOString(),
      deactivated_by: isActive ? null : actorId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", circleId)
    .select("*")
    .single()

  return { data, error }
}

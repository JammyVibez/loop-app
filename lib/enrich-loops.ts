import { SupabaseClient } from "@supabase/supabase-js"

export async function enrichLoopsWithPollsAndDuels(supabase: SupabaseClient, loops: any[]) {
  if (!loops || loops.length === 0) return loops
  const loopIds = loops.map((l) => l.id).filter(Boolean)
  if (!loopIds.length) return loops

  const pollMap = new Map<string, any>()
  const duelMap = new Map<string, any>()

  try {
    const [pollsRes, duelsRes] = await Promise.all([
      supabase.from("loop_polls").select("*").in("loop_id", loopIds),
      supabase
        .from("loop_duels")
        .select(`
          *,
          creator:profiles!creator_id(id, username, display_name, avatar_url),
          opponent:profiles!opponent_id(id, username, display_name, avatar_url),
          entries:loop_duel_entries(id, side, title, content, media_url, votes_count, user_id)
        `)
        .in("loop_id", loopIds),
    ])

    pollsRes.data?.forEach((p: any) => pollMap.set(p.loop_id, p))
    duelsRes.data?.forEach((d: any) => duelMap.set(d.loop_id, d))
  } catch (err) {
    console.error("enrichLoopsWithPollsAndDuels error:", err)
  }

  return loops.map((loop) => {
    const poll = pollMap.get(loop.id) || loop.poll || loop.loop_polls || undefined
    const duel = duelMap.get(loop.id) || loop.duel || loop.loop_duels || undefined
    const post_type = loop.post_type || (poll ? "poll" : duel ? "duel" : loop.content_type || "standard")
    return {
      ...loop,
      poll,
      duel,
      post_type,
    }
  })
}

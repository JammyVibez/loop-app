import { createServerClient } from "@/lib/supabase"

export const BOT_CATEGORIES = [
  "moderation",
  "welcome",
  "notification",
  "ecommerce",
  "utility",
  "ai",
  "games",
  "custom",
] as const

export type BotRow = {
  id: string
  community_id: string
  owner_id: string
  name: string
  slug?: string | null
  description?: string | null
  avatar_url?: string | null
  category: string
  status: string
  deployment_type: string
  webhook_url?: string | null
  invite_link?: string | null
  source_url?: string | null
  auto_reply?: string | null
  commands: string[]
  secret_token: string
  is_listed: boolean
  price_coins: number
  allows_hosted: boolean
  allows_source: boolean
  rating_sum: number
  rating_count: number
  purchase_count: number
  last_active_at?: string | null
  created_at: string
  owner?: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string | null
    is_verified?: boolean
  } | null
  activity_count?: number
  chat_count?: number
}

/** Random secret used to manage a bot (owner-only). */
export function newBotToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`
}

export async function getCommunityMembership(supabase: ReturnType<typeof createServerClient>, communityId: string, userId: string) {
  const { data } = await supabase
    .from("circle_members")
    .select("id, role, status")
    .eq("circle_id", communityId)
    .eq("user_id", userId)
    .maybeSingle()
  return data
}

export async function isCommunityMember(supabase: ReturnType<typeof createServerClient>, communityId: string, userId: string) {
  const m = await getCommunityMembership(supabase, communityId, userId)
  return Boolean(m && (m.status === "active" || m.status === "approved"))
}

export async function canModerateCommunity(supabase: ReturnType<typeof createServerClient>, communityId: string, userId: string) {
  const m = await getCommunityMembership(supabase, communityId, userId)
  if (m && (m.role === "admin" || m.role === "moderator")) return true
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle()
  return Boolean(profile?.is_admin)
}

export async function getBot(supabase: ReturnType<typeof createServerClient>, botId: string): Promise<BotRow | null> {
  const { data } = await supabase
    .from("community_bots")
    .select(`
      *,
      owner:profiles!owner_id(id, username, display_name, avatar_url, is_verified)
    `)
    .eq("id", botId)
    .maybeSingle()
  return (data as BotRow) || null
}

export async function logBotActivity(
  supabase: ReturnType<typeof createServerClient>,
  args: { bot_id: string; community_id: string; actor_id?: string | null; type?: string; title?: string; message?: string | null },
) {
  await supabase.from("bot_activity").insert({
    bot_id: args.bot_id,
    community_id: args.community_id,
    actor_id: args.actor_id || null,
    type: args.type || "action",
    title: args.title || "",
    message: args.message || null,
  })
}
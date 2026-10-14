import type { Metadata } from "next"
import QuestDetailClient from "./quest-detail-client"
import { createClient } from "@/lib/supabase"
import { getAbsoluteAppUrl } from "@/lib/app-url"
import { buildOgMetadata } from "@/lib/og/metadata"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder",
)

interface QuestPageProps {
  params: Promise<{ questId: string }>
}

/** Quest shares get the challenge card: title, brief, type and reward. */
export async function generateMetadata({ params }: QuestPageProps): Promise<Metadata> {
  const { questId } = await params
  const baseUrl = await getAbsoluteAppUrl()
  const fallbackTitle = "Challenges on Loop"
  const fallbackDescription = "Take on challenges, earn Loop Coins and XP, and level up with the community."

  let title = fallbackTitle
  let description = fallbackDescription
  let questType = ""
  let reward = ""

  try {
    const { data: quest } = await supabase
      .from("quests")
      .select("title, description, quest_type, reward_coins, reward_xp, reward_label, is_active")
      .eq("id", questId)
      .maybeSingle()

    if (quest && (quest as any).is_active !== false) {
      title = String((quest as any).title || fallbackTitle)
      if ((quest as any).description) description = String((quest as any).description).slice(0, 170)
      questType = String((quest as any).quest_type || "")
      const coins = Number((quest as any).reward_coins || 0)
      const xp = Number((quest as any).reward_xp || 0)
      const label = String((quest as any).reward_label || "")
      reward = label || [coins > 0 ? `${coins} coins` : "", xp > 0 ? `${xp} XP` : ""].filter(Boolean).join(" + ")
    }
  } catch (err) {
    console.error("Error generating quest metadata:", err)
  }

  return buildOgMetadata({
    baseUrl,
    path: `/quests/${questId}`,
    type: "challenge",
    title,
    description,
    params: {
      category: questType,
      date: reward,
      name: title,
      url: `loopapp.me/quests/${questId}`,
    },
  })
}

export default async function QuestDetailPage({ params }: QuestPageProps) {
  const { questId } = await params
  return <QuestDetailClient questId={questId} />
}

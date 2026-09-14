import type { SupabaseClient } from "@supabase/supabase-js"
import { type Quest, type NativeAction, NATIVE_ACTIONS, recordQuestProgress } from "@/lib/quests"

/**
 * Server-side quest progress tracking for native action quests.
 * Call after the underlying action succeeded — never let quest failures
 * break the main flow. Matches all active native quests for the action.
 */
export async function trackQuestAction(
  supabase: SupabaseClient,
  userId: string,
  action: NativeAction,
  amount = 1,
): Promise<void> {
  try {
    if (!NATIVE_ACTIONS.includes(action)) return
    const { data: quests } = await supabase
      .from("quests")
      .select("*")
      .eq("is_active", true)
      .eq("quest_type", "native")
      .eq("native_action", action)

    const now = new Date()
    for (const quest of (quests || []) as Quest[]) {
      if (quest.cadence === "seasonal") {
        if (quest.starts_at && new Date(quest.starts_at) > now) continue
        if (quest.ends_at && new Date(quest.ends_at) < now) continue
      }
      await recordQuestProgress(supabase, quest, userId, amount)
    }
  } catch (error) {
    console.error("trackQuestAction failed (non-fatal):", error)
  }
}

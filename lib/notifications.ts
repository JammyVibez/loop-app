import type { SupabaseClient } from "@supabase/supabase-js"
import { sendWebPushToUser, sendWebPushToUsers, type PushCategory, type PushPayload } from "@/lib/web-push"

export type NotifyInput = {
  userId: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  actionUrl?: string
  actorId?: string | null
  /** Maps to profile.notification_settings push prefs */
  pushCategory?: PushCategory
  /** Skip inserting in-app row (push only) */
  pushOnly?: boolean
  /** Skip web push (in-app only) */
  inAppOnly?: boolean
}

/**
 * Create an in-app notification and deliver a real browser Web Push.
 * Safe to call from any API route — never throws to callers.
 */
export async function notifyUser(
  supabase: SupabaseClient,
  input: NotifyInput,
): Promise<{ notificationId?: string; pushDelivered: number }> {
  let notificationId: string | undefined
  let pushDelivered = 0

  try {
    if (!input.pushOnly) {
      const row: Record<string, unknown> = {
        user_id: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        data: {
          ...(input.data || {}),
          ...(input.actionUrl ? { url: input.actionUrl, action_url: input.actionUrl } : {}),
        },
        is_read: false,
      }
      if (input.actorId) row.actor_id = input.actorId
      if (input.actionUrl) row.action_url = input.actionUrl

      const { data, error } = await supabase.from("notifications").insert(row).select("id").maybeSingle()
      if (error) {
        // Retry without optional columns that may not exist on older schemas
        const { data: fallback, error: fallbackError } = await supabase
          .from("notifications")
          .insert({
            user_id: input.userId,
            type: input.type,
            title: input.title,
            message: input.message,
            data: row.data,
          })
          .select("id")
          .maybeSingle()
        if (fallbackError) {
          console.warn("notifyUser insert failed:", fallbackError.message)
        } else {
          notificationId = fallback?.id
        }
      } else {
        notificationId = data?.id
      }
    }

    if (!input.inAppOnly) {
      const payload: PushPayload = {
        title: input.title,
        body: input.message,
        url: input.actionUrl || "/",
        tag: `${input.type}-${input.userId}`,
        data: input.data,
      }
      const result = await sendWebPushToUser(input.userId, payload, {
        category: input.pushCategory || "system",
      })
      pushDelivered = result.delivered
    }
  } catch (err) {
    console.warn("notifyUser error:", err)
  }

  return { notificationId, pushDelivered }
}

export async function notifyUsers(
  supabase: SupabaseClient,
  userIds: string[],
  shared: Omit<NotifyInput, "userId">,
) {
  const unique = [...new Set(userIds.filter(Boolean))]
  await Promise.all(unique.map((userId) => notifyUser(supabase, { ...shared, userId })))
}

export async function pushOnlyToUsers(
  userIds: string[],
  payload: PushPayload,
  category: PushCategory = "system",
) {
  return sendWebPushToUsers(userIds, payload, { category })
}

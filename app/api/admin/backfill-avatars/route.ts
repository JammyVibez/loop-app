import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

/**
 * POST /api/admin/backfill-avatars
 *
 * One-time backfill: gives every user with a null/empty avatar_url
 * and banner_url a unique animated character avatar + cover.
 *
 * Admin-only.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const supabase = createServerClient()

    // Verify admin
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()

    if (!adminProfile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, "")

    // Fetch all users with null/empty avatar_url
    const { data: users, error: fetchError } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, banner_url")
      .or("avatar_url.is.null,avatar_url.eq.")

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ message: "All users already have avatars", updated: 0 })
    }

    let updated = 0
    let skipped = 0

    // Batch update in groups of 50 to avoid URL length limits
    const batchSize = 50
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize)

      const updates = batch
        .filter((u) => !u.avatar_url)
        .map((u) => {
          const name = u.display_name || u.username || "U"
          return {
            id: u.id,
            avatar_url: `${baseUrl}/api/default-avatar?id=${encodeURIComponent(u.id)}&name=${encodeURIComponent(name)}`,
            banner_url: u.banner_url || `${baseUrl}/api/default-avatar?id=${encodeURIComponent(u.id)}&name=${encodeURIComponent(name)}&type=banner`,
          }
        })

      if (updates.length === 0) {
        skipped += batch.length
        continue
      }

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(updates, { onConflict: "id" })

      if (upsertError) {
        console.error("Backfill batch error:", upsertError)
        continue
      }

      updated += updates.length
      skipped += batch.length - updates.length
    }

    return NextResponse.json({
      message: "Backfill complete",
      total: users.length,
      updated,
      skipped,
    })
  } catch (error: any) {
    console.error("Backfill avatars error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

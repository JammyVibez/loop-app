import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { getDiskUsage } from "@/lib/media/storage"
import { deleteMediaAsset, resolveUploadActor } from "@/lib/media/upload-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type StorageRow = {
  user_id: string | null
  username: string | null
  display_name: string | null
  media_count: number
  total_bytes: number
  last_upload: string | null
}

/** Storage usage per account, plus the disk figure the limit is based on. */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 100) || 100, 1), 500)

    let rows: StorageRow[] = []
    const { data: rpcData, error: rpcError } = await supabase.rpc("media_storage_by_user", { limit_rows: limit })
    if (!rpcError && Array.isArray(rpcData)) {
      rows = (rpcData as any[]).map((row) => ({
        user_id: row.user_id,
        username: row.username,
        display_name: row.display_name,
        media_count: Number(row.media_count || 0),
        total_bytes: Number(row.total_bytes || 0),
        last_upload: row.last_upload,
      }))
    } else {
      // Pre-migration fallback: aggregate in JS over the newest 5k VPS rows.
      const { data } = await supabase
        .from("media_uploads")
        .select("user_id, file_size, created_at")
        .eq("storage_provider", "vps")
        .order("created_at", { ascending: false })
        .limit(5000)
      const grouped = new Map<string, StorageRow>()
      for (const row of (data || []) as any[]) {
        const key = row.user_id || "unknown"
        const existing = grouped.get(key) || {
          user_id: row.user_id,
          username: null,
          display_name: null,
          media_count: 0,
          total_bytes: 0,
          last_upload: null,
        }
        existing.media_count += 1
        existing.total_bytes += Number(row.file_size || 0)
        if (!existing.last_upload || row.created_at > existing.last_upload) existing.last_upload = row.created_at
        grouped.set(key, existing)
      }
      rows = Array.from(grouped.values()).sort((a, b) => b.total_bytes - a.total_bytes).slice(0, limit)

      const ids = rows.map((row) => row.user_id).filter(Boolean) as string[]
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, username, display_name").in("id", ids)
        const byId = new Map((profiles || []).map((p: any) => [p.id, p]))
        rows = rows.map((row) => {
          const profile: any = row.user_id ? byId.get(row.user_id) : null
          return { ...row, username: profile?.username || null, display_name: profile?.display_name || null }
        })
      }
    }

    const disk = await getDiskUsage()
    return NextResponse.json({
      success: true,
      users: rows,
      disk,
      total_bytes: rows.reduce((sum, row) => sum + row.total_bytes, 0),
    })
  } catch (error) {
    console.error("[admin/media/storage] GET failed:", error)
    return NextResponse.json({ error: "Could not read storage usage" }, { status: 500 })
  }
}

/** Remove every stored file for one account (admin action, audited per file). */
export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request)
    if (response || !user) return response!

    const userId = request.nextUrl.searchParams.get("user_id")
    if (!userId) return NextResponse.json({ error: "user_id is required" }, { status: 400 })

    const supabase = createServerClient()
    const actor = await resolveUploadActor(user.id, supabase)

    const { data } = await supabase
      .from("media_uploads")
      .select("id")
      .eq("user_id", userId)
      .eq("storage_provider", "vps")
      .limit(2000)

    let deleted = 0
    const failed: string[] = []
    for (const row of (data || []) as any[]) {
      const result = await deleteMediaAsset({
        actor,
        id: row.id,
        confirmReferenced: true,
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
        userAgent: request.headers.get("user-agent"),
      })
      if (result.ok) deleted += 1
      else failed.push(row.id)
    }

    return NextResponse.json({ success: true, deleted, failed: failed.length })
  } catch (error) {
    console.error("[admin/media/storage] DELETE failed:", error)
    return NextResponse.json({ error: "Could not delete user media" }, { status: 500 })
  }
}

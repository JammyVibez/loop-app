import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"
import { getDiskUsage, measureStorageBytes } from "@/lib/media/storage"
import { getMediaPolicy } from "@/lib/media/policy"
import { findMediaReferences } from "@/lib/media/references"

export const dynamic = "force-dynamic"

/**
 * Media Library listing.
 *
 * One page of uploads with everything an admin needs to decide what a file is,
 * who uploaded it and whether it is still in use: detected type, stored size,
 * uploader, folder, processing state and reference count. Legacy Cloudinary
 * rows appear alongside VPS rows (filterable by provider) so old assets can be
 * audited before any migration.
 */
export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const params = request.nextUrl.searchParams
    const limit = Math.min(Math.max(Number(params.get("limit") || 40) || 40, 1), 200)
    const offset = Math.max(Number(params.get("offset") || 0) || 0, 0)
    const q = (params.get("q") || "").trim()
    const type = params.get("type") || ""
    const provider = params.get("provider") || ""
    const folder = params.get("folder") || ""
    const status = params.get("status") || ""
    const sort = params.get("sort") || "recent"
    const withReferences = params.get("references") === "1"

    let query = supabase
      .from("media_uploads")
      .select(
        "id, user_id, file_name, file_type, file_size, media_type, folder, format, width, height, duration, created_at, cloudinary_url, public_url, storage_provider, storage_path, thumb_url, poster_url, processing_status, processing_error, original_quality, purpose, uploaded_by_role",
        { count: "exact" },
      )

    if (q) {
      const escaped = q.replace(/[%,()]/g, "")
      query = query.or(`file_name.ilike.%${escaped}%,storage_path.ilike.%${escaped}%,folder.ilike.%${escaped}%`)
    }
    if (type) query = query.eq("media_type", type)
    if (provider) query = query.eq("storage_provider", provider)
    if (folder) query = query.eq("folder", folder)
    if (status) query = query.eq("processing_status", status)

    query = query
      .order(sort === "largest" ? "file_size" : "created_at", { ascending: sort === "oldest", nullsFirst: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) {
      return NextResponse.json({ error: "Could not read media library", details: error.message }, { status: 500 })
    }

    const rows = data || []
    const userIds = Array.from(new Set(rows.map((row: any) => row.user_id).filter(Boolean)))

    const uploaders: Record<string, { username?: string; display_name?: string }> = {}
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", userIds)
      for (const profile of profiles || []) {
        uploaders[(profile as any).id] = {
          username: (profile as any).username || undefined,
          display_name: (profile as any).display_name || undefined,
        }
      }
    }

    const items = await Promise.all(
      rows.map(async (row: any) => {
        const url = row.public_url || row.cloudinary_url
        const references =
          withReferences && row.storage_provider === "vps" && row.storage_path
            ? await findMediaReferences(supabase, row.storage_path, 3)
            : []
        return {
          id: row.id,
          url,
          thumb_url: row.thumb_url || row.poster_url || (row.media_type === "image" ? url : null),
          file_name: row.file_name,
          file_type: row.file_type,
          file_size: row.file_size,
          media_type: row.media_type,
          format: row.format,
          folder: row.folder,
          purpose: row.purpose,
          width: row.width,
          height: row.height,
          duration: row.duration,
          created_at: row.created_at,
          provider: row.storage_provider || "cloudinary",
          storage_path: row.storage_path,
          processing_status: row.processing_status || "ready",
          processing_error: row.processing_error,
          original_quality: Boolean(row.original_quality),
          uploaded_by_role: row.uploaded_by_role,
          user_id: row.user_id,
          uploader: row.user_id ? uploaders[row.user_id] || null : null,
          references,
          used_in: references.map((r) => r.label),
        }
      }),
    )

    const [disk, policy] = await Promise.all([getDiskUsage(), getMediaPolicy(supabase)])
    const { data: totals } = await supabase
      .from("media_uploads")
      .select("storage_provider, file_size")
      .eq("storage_provider", "vps")
      .limit(5000)
    const storedBytes = (totals || []).reduce((sum: number, row: any) => sum + Number(row.file_size || 0), 0)

    return NextResponse.json({
      success: true,
      items,
      total: count || items.length,
      limit,
      offset,
      storage: {
        disk,
        policy: {
          warn_percent: policy.disk_warn_percent,
          block_percent: policy.disk_block_percent,
        },
        vps_bytes_in_db: storedBytes,
        warning: disk.usedPercent >= policy.disk_warn_percent,
        blocked: disk.usedPercent >= policy.disk_block_percent,
      },
    })
  } catch (error) {
    console.error("[admin/media] list failed:", error)
    return NextResponse.json({ error: "Could not read media library" }, { status: 500 })
  }
}

/** Total bytes actually on disk (slow walk; used by the storage tab). */
export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response
    const [disk, measured] = await Promise.all([getDiskUsage(), measureStorageBytes()])
    return NextResponse.json({ success: true, disk, files_on_disk: measured.files, bytes_on_disk: measured.bytes })
  } catch (error) {
    console.error("[admin/media] measurement failed:", error)
    return NextResponse.json({ error: "Could not measure storage" }, { status: 500 })
  }
}

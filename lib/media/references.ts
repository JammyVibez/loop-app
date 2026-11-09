import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * "Where is this file used?" is answered by searching the columns that store
 * media URLs, not by trusting a denormalised counter. The filename token is a
 * random 32-hex string, so an `ilike` against those columns cannot collide with
 * unrelated content.
 *
 * Tables/columns are declared here instead of hard-coded in the admin route so
 * adding a new media-bearing feature means adding one row, and a column that
 * does not exist in an older schema is skipped rather than breaking the scan.
 */
type ReferenceTarget = {
  table: string
  columns: string[]
  label: string
  /** Human-friendly owner column used to describe the usage. */
  ownerColumn?: string
}

const REFERENCE_TARGETS: ReferenceTarget[] = [
  { table: "loops", columns: ["media_url", "content_media_url", "thumbnail_url", "media_urls"], label: "post", ownerColumn: "author_id" },
  { table: "reels", columns: ["video_url", "thumbnail_url", "media_url"], label: "reel", ownerColumn: "user_id" },
  { table: "messages", columns: ["media_url", "attachment_url", "image_url"], label: "message", ownerColumn: "sender_id" },
  { table: "profiles", columns: ["avatar_url", "banner_url", "cover_url", "background_url", "profile_theme_url"], label: "profile", ownerColumn: "id" },
  { table: "circles", columns: ["icon_url", "banner_url", "image_url"], label: "circle", ownerColumn: "owner_id" },
  { table: "shop_items", columns: ["image_url", "preview_url", "asset_url"], label: "shop item", ownerColumn: "id" },
  { table: "ads", columns: ["image_url", "video_url", "media_url", "creative_url"], label: "ad", ownerColumn: "advertiser_id" },
  { table: "verification_badges", columns: ["image_url", "icon_url"], label: "badge" },
  { table: "achievements", columns: ["icon_url", "image_url"], label: "achievement" },
  { table: "moments", columns: ["media_url", "thumbnail_url"], label: "moment", ownerColumn: "user_id" },
  { table: "circles_posts", columns: ["media_url", "image_url"], label: "circle post", ownerColumn: "author_id" },
  { table: "live_streams", columns: ["thumbnail_url", "cover_url"], label: "stream", ownerColumn: "host_id" },
  { table: "music_tracks", columns: ["audio_url", "cover_url"], label: "music track" },
  { table: "loop_duels", columns: ["video_url", "thumbnail_url"], label: "duel", ownerColumn: "user_id" },
]

export type MediaReference = {
  table: string
  label: string
  id: string
  ownerId?: string | null
}

function filenameToken(storagePath: string): string {
  const base = storagePath.split("/").pop() || storagePath
  // Strip the rendition suffix so `abc-480.webp` and `abc.webp` resolve to the
  // same owning upload.
  return base
    .replace(/\.(webp|png|jpe?g|gif|avif|mp4|mov|webm|m4a|mp3|wav|ogg|flac|svg|json)$/i, "")
    .replace(/-(thumb|poster|1024|480)$/i, "")
}

/**
 * Find database rows that still point at this upload. Any hit means deleting
 * the file would leave a broken image/video behind, so the admin has to
 * confirm explicitly.
 */
export async function findMediaReferences(
  supabase: SupabaseClient,
  storagePath: string,
  limitPerTable = 5,
): Promise<MediaReference[]> {
  const token = filenameToken(storagePath)
  if (!token || token.length < 8) return []

  const results = await Promise.all(
    REFERENCE_TARGETS.map(async (target) => {
      const select = ["id", target.ownerColumn].filter(Boolean).join(",")
      const filters = target.columns.map((column) => `${column}.ilike.%${token}%`)

      const collect = (rows: any[]) =>
        rows.map((row) => ({
          table: target.table,
          label: target.label,
          id: String(row.id),
          ownerId: target.ownerColumn ? row[target.ownerColumn] : undefined,
        }))

      try {
        const combined = await supabase
          .from(target.table)
          .select(select)
          .or(filters.join(","))
          .limit(limitPerTable)
        if (!combined.error) return collect(combined.data || [])
      } catch {
        /* fall through to per-column */
      }

      // One bad column (a JSONB/array `media_urls`, or a column an older schema
      // never had) makes the whole OR fail, which would silently hide real
      // references. Retry column by column and keep whatever succeeds.
      const seen = new Set<string>()
      const found: MediaReference[] = []
      for (const filter of filters) {
        try {
          const { data, error } = await supabase
            .from(target.table)
            .select(select)
            .or(filter)
            .limit(limitPerTable)
          if (error) continue
          for (const ref of collect(data || [])) {
            if (seen.has(ref.id)) continue
            seen.add(ref.id)
            found.push(ref)
          }
        } catch {
          /* skip this column */
        }
      }
      return found
    }),
  )

  return results.flat()
}

export function describeReferences(refs: MediaReference[]): string {
  if (!refs.length) return ""
  const labels = Array.from(new Set(refs.map((r) => r.label)))
  return labels.join(", ")
}

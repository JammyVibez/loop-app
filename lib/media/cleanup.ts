import "server-only"
import { createServerClient } from "@/lib/supabase"
import { isOurMediaUrl, storagePathFromUrl } from "./storage"
import { purgeMediaAsset } from "./upload-service"
import { findMediaReferences } from "./references"

/**
 * Media cleanup hooks used when content is deleted.
 *
 * A post, message or account disappearing must not leave its files paying rent
 * on the VPS forever. Only files we own are touched — legacy Cloudinary URLs are
 * skipped, because those records are read-only here.
 */

function normalizeUrl(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null
  return isOurMediaUrl(url) ? url : null
}

/** Flatten `media` payloads that contain arrays, strings or nested URLs. */
export function collectMediaUrls(value: unknown, into: Set<string> = new Set<string>()): Set<string> {
  if (!value) return into
  if (typeof value === "string") {
    if (value.includes("/media/")) into.add(value)
    return into
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectMediaUrls(entry, into)
    return into
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) collectMediaUrls(entry, into)
  }
  return into
}

/**
 * Delete every VPS file whose public URL appears in `urls`. Returns how many
 * rows were removed; failures are logged, never thrown, so a broken file cannot
 * block deleting a post.
 */
export async function deleteMediaByUrls(
  urls: Iterable<string>,
  options: { force?: boolean } = {},
): Promise<number> {
  const targets = Array.from(new Set(Array.from(urls).map(normalizeUrl).filter(Boolean) as string[]))
  if (!targets.length) return 0

  const supabase = createServerClient()

  // URL → storage path, so a variant URL still resolves to its owning record.
  const storagePaths = new Set<string>()
  for (const url of targets) {
    const path = storagePathFromUrl(url)
    if (!path) continue
    storagePaths.add(path)
    storagePaths.add(path.replace(/-(thumb|poster|480|1024)\.(webp|jpe?g|png)$/i, (match, _label, ext) => `.${ext}`))
  }

  const rows = new Map<string, string>()
  const pathList = Array.from(storagePaths)
  for (let index = 0; index < pathList.length; index += 100) {
    const slice = pathList.slice(index, index + 100)
    try {
      const { data } = await supabase
        .from("media_uploads")
        .select("id, storage_path")
        .in("storage_path", slice)
        .eq("storage_provider", "vps")
      for (const row of (data || []) as any[]) rows.set(row.id, row.storage_path)
    } catch {
      /* pre-migration schema */
    }
  }

  // A post may store only a rendition URL (`-poster.jpg`, `-480.webp`), whose
  // filename differs from the row's storage_path. Fall back to the random
  // basename token, which is unique per upload.
  const matchedPaths = new Set(rows.values())
  for (const storagePath of pathList) {
    if (matchedPaths.has(storagePath)) continue
    const token = (storagePath.split("/").pop() || "")
      .replace(/\.[^.]+$/, "")
      .replace(/-(thumb|poster|480|1024)$/i, "")
    if (token.length < 8) continue
    try {
      const { data } = await supabase
        .from("media_uploads")
        .select("id, storage_path")
        .ilike("storage_path", `%${token}%`)
        .eq("storage_provider", "vps")
        .limit(2)
      for (const row of (data || []) as any[]) rows.set(row.id, row.storage_path)
    } catch {
      /* pre-migration schema */
    }
  }

  let deleted = 0
  for (const [id, storagePath] of rows) {
    if (!options.force) {
      // The content that referenced this file is already gone; anything the
      // scan still finds is another post, profile or badge using the same file.
      const stillUsed = await findMediaReferences(supabase, storagePath, 1)
      if (stillUsed.length) continue
    }
    const result = await purgeMediaAsset(id)
    if (result.ok) deleted += 1
    else console.warn("[media-cleanup] could not purge", id, result.message)
  }
  return deleted
}

/**
 * Delete every file an account ever uploaded. Used when an account is deleted:
 * the profile is being erased, so there is no content left to keep the files
 * for, and the quota should not stay consumed by a departed user.
 */
export async function deleteAllUserMedia(userId: string, limit = 2000): Promise<number> {
  const supabase = createServerClient()
  let deleted = 0
  try {
    const { data } = await supabase
      .from("media_uploads")
      .select("id")
      .eq("user_id", userId)
      .eq("storage_provider", "vps")
      .limit(limit)
    for (const row of (data || []) as any[]) {
      const result = await purgeMediaAsset(row.id)
      if (result.ok) deleted += 1
    }
  } catch (error) {
    console.warn("[media-cleanup] account cleanup failed:", error)
  }
  return deleted
}

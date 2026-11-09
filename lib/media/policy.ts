import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Upload policy for the VPS media store.
 *
 * Everything here is enforced server-side on every upload and can be changed
 * from the Admin Dashboard (Admin → Media → Upload rules) without a redeploy.
 * Values live in `admin_settings` under `media_upload_policy` and are cached
 * in-process for a few seconds so hot upload paths don't pay a DB round-trip.
 *
 * Limits are in megabytes because that is what admins type; the server converts
 * to bytes before comparing. `hard_max_mb` is a ceiling no other limit or admin
 * override can exceed.
 */
export const MEDIA_POLICY_KEY = "media_upload_policy"

export const MEDIA_POLICY_DEFAULTS = {
  /** Absolute per-file ceiling, for every account including admins. */
  hard_max_mb: 500,
  /** Regular users. */
  image_max_mb: 10,
  video_free_mb: 100,
  video_pro_mb: 250,
  voice_max_mb: 10,
  /** New / inactive accounts get a tighter video cap (anti-troll). */
  new_account_video_mb: 25,
  new_account_min_age_hours: 24,
  new_account_min_posts: 1,
  /** Files attached to a single post. */
  post_files_free: 4,
  post_files_pro: 10,
  /** Total stored bytes per account. */
  quota_free_mb: 2048,
  quota_pro_mb: 10240,
  /** Abuse caps. */
  uploads_per_hour: 20,
  daily_upload_mb_free: 500,
  daily_upload_mb_pro: 2000,
  /** Admins may upload larger still images (ad creatives, badges). */
  admin_image_max_mb: 25,
  /** Disk safety. */
  disk_warn_percent: 80,
  disk_block_percent: 90,
} as const

export type MediaPolicy = {
  hard_max_mb: number
  image_max_mb: number
  video_free_mb: number
  video_pro_mb: number
  voice_max_mb: number
  new_account_video_mb: number
  new_account_min_age_hours: number
  new_account_min_posts: number
  post_files_free: number
  post_files_pro: number
  quota_free_mb: number
  quota_pro_mb: number
  uploads_per_hour: number
  daily_upload_mb_free: number
  daily_upload_mb_pro: number
  admin_image_max_mb: number
  disk_warn_percent: number
  disk_block_percent: number
}

export const MB = 1024 * 1024

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  return Math.round(clampNumber(value, fallback, min, max))
}

export function normalizeMediaPolicy(raw: unknown): MediaPolicy {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
  const hardMax = clampInt(src.hard_max_mb, MEDIA_POLICY_DEFAULTS.hard_max_mb, 1, 2048)

  const policy: MediaPolicy = {
    hard_max_mb: hardMax,
    image_max_mb: clampInt(src.image_max_mb, MEDIA_POLICY_DEFAULTS.image_max_mb, 1, hardMax),
    video_free_mb: clampInt(src.video_free_mb, MEDIA_POLICY_DEFAULTS.video_free_mb, 1, hardMax),
    video_pro_mb: clampInt(src.video_pro_mb, MEDIA_POLICY_DEFAULTS.video_pro_mb, 1, hardMax),
    voice_max_mb: clampInt(src.voice_max_mb, MEDIA_POLICY_DEFAULTS.voice_max_mb, 1, hardMax),
    new_account_video_mb: clampInt(src.new_account_video_mb, MEDIA_POLICY_DEFAULTS.new_account_video_mb, 1, hardMax),
    new_account_min_age_hours: clampInt(src.new_account_min_age_hours, MEDIA_POLICY_DEFAULTS.new_account_min_age_hours, 0, 720),
    new_account_min_posts: clampInt(src.new_account_min_posts, MEDIA_POLICY_DEFAULTS.new_account_min_posts, 0, 100),
    post_files_free: clampInt(src.post_files_free, MEDIA_POLICY_DEFAULTS.post_files_free, 1, 30),
    post_files_pro: clampInt(src.post_files_pro, MEDIA_POLICY_DEFAULTS.post_files_pro, 1, 30),
    quota_free_mb: clampInt(src.quota_free_mb, MEDIA_POLICY_DEFAULTS.quota_free_mb, 100, 1048576),
    quota_pro_mb: clampInt(src.quota_pro_mb, MEDIA_POLICY_DEFAULTS.quota_pro_mb, 100, 1048576),
    uploads_per_hour: clampInt(src.uploads_per_hour, MEDIA_POLICY_DEFAULTS.uploads_per_hour, 1, 1000),
    daily_upload_mb_free: clampInt(src.daily_upload_mb_free, MEDIA_POLICY_DEFAULTS.daily_upload_mb_free, 10, 1048576),
    daily_upload_mb_pro: clampInt(src.daily_upload_mb_pro, MEDIA_POLICY_DEFAULTS.daily_upload_mb_pro, 10, 1048576),
    admin_image_max_mb: clampInt(src.admin_image_max_mb, MEDIA_POLICY_DEFAULTS.admin_image_max_mb, 1, hardMax),
    disk_warn_percent: clampInt(src.disk_warn_percent, MEDIA_POLICY_DEFAULTS.disk_warn_percent, 50, 99),
    disk_block_percent: clampInt(src.disk_block_percent, MEDIA_POLICY_DEFAULTS.disk_block_percent, 50, 100),
  }

  // Quotas must never shrink below what a Pro user is promised.
  if (policy.quota_pro_mb < policy.quota_free_mb) policy.quota_pro_mb = policy.quota_free_mb
  if (policy.video_pro_mb < policy.video_free_mb) policy.video_pro_mb = policy.video_free_mb
  if (policy.post_files_pro < policy.post_files_free) policy.post_files_pro = policy.post_files_free
  if (policy.daily_upload_mb_pro < policy.daily_upload_mb_free) policy.daily_upload_mb_pro = policy.daily_upload_mb_free
  if (policy.disk_block_percent < policy.disk_warn_percent) policy.disk_block_percent = policy.disk_warn_percent

  return policy
}

let cachedPolicy: MediaPolicy | null = null
let cachedAt = 0
const CACHE_TTL_MS = 10_000

function readFallbackPolicy(): MediaPolicy {
  return normalizeMediaPolicy(MEDIA_POLICY_DEFAULTS)
}

async function loadPolicy(supabase: SupabaseClient): Promise<MediaPolicy> {
  try {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", MEDIA_POLICY_KEY)
      .maybeSingle()
    if (error || !data?.setting_value) return readFallbackPolicy()
    return normalizeMediaPolicy(data.setting_value)
  } catch {
    return readFallbackPolicy()
  }
}

export async function getMediaPolicy(supabase: SupabaseClient): Promise<MediaPolicy> {
  const now = Date.now()
  if (cachedPolicy && now - cachedAt < CACHE_TTL_MS) return cachedPolicy
  cachedPolicy = await loadPolicy(supabase)
  cachedAt = Date.now()
  return cachedPolicy
}

export async function refreshMediaPolicy(supabase: SupabaseClient): Promise<MediaPolicy> {
  cachedPolicy = await loadPolicy(supabase)
  cachedAt = Date.now()
  return cachedPolicy
}

export async function saveMediaPolicy(
  supabase: SupabaseClient,
  patch: Partial<MediaPolicy>,
): Promise<MediaPolicy> {
  const merged = normalizeMediaPolicy({ ...(await loadPolicy(supabase)), ...patch })
  const { error } = await supabase.from("admin_settings").upsert(
    {
      setting_key: MEDIA_POLICY_KEY,
      setting_value: merged,
      description: "VPS media upload limits and disk safety thresholds",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "setting_key" },
  )
  if (error) throw error
  cachedPolicy = merged
  cachedAt = Date.now()
  return merged
}

/** Human labels for the admin form, grouped by section. */
export const MEDIA_POLICY_FIELDS: {
  key: keyof MediaPolicy
  label: string
  unit: string
  group: "Per-file limits" | "Posts & quota" | "Abuse caps" | "Disk safety"
  hint?: string
}[] = [
  { key: "hard_max_mb", label: "Absolute per-file ceiling", unit: "MB", group: "Per-file limits", hint: "No account, type or admin override can exceed this." },
  { key: "image_max_mb", label: "Images", unit: "MB", group: "Per-file limits" },
  { key: "admin_image_max_mb", label: "Admin images", unit: "MB", group: "Per-file limits", hint: "Badges, frames, ad creatives uploaded with original quality." },
  { key: "video_free_mb", label: "Video — free", unit: "MB", group: "Per-file limits" },
  { key: "video_pro_mb", label: "Video — Pro", unit: "MB", group: "Per-file limits" },
  { key: "voice_max_mb", label: "Voice messages", unit: "MB", group: "Per-file limits" },
  { key: "new_account_video_mb", label: "Video — new accounts", unit: "MB", group: "Per-file limits", hint: "Anti-troll cap for accounts younger than the threshold below." },
  { key: "new_account_min_age_hours", label: "New-account age threshold", unit: "hours", group: "Per-file limits" },
  { key: "new_account_min_posts", label: "Posts needed for full limits", unit: "posts", group: "Per-file limits" },
  { key: "post_files_free", label: "Files per post — free", unit: "files", group: "Posts & quota" },
  { key: "post_files_pro", label: "Files per post — Pro", unit: "files", group: "Posts & quota" },
  { key: "quota_free_mb", label: "Storage quota — free", unit: "MB", group: "Posts & quota" },
  { key: "quota_pro_mb", label: "Storage quota — Pro", unit: "MB", group: "Posts & quota" },
  { key: "uploads_per_hour", label: "Uploads per hour", unit: "uploads", group: "Abuse caps" },
  { key: "daily_upload_mb_free", label: "Daily bytes — free", unit: "MB/day", group: "Abuse caps" },
  { key: "daily_upload_mb_pro", label: "Daily bytes — Pro", unit: "MB/day", group: "Abuse caps" },
  { key: "disk_warn_percent", label: "Warn in Health at", unit: "% disk", group: "Disk safety" },
  { key: "disk_block_percent", label: "Refuse uploads at", unit: "% disk", group: "Disk safety" },
]

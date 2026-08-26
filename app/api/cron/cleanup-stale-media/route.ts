import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/cleanup-stale-media
 *
 * Scans avatar_url, banner_url, media_url, and content_media_url across
 * profiles, loops, and messages. For every URL found, it sends a HEAD
 * request to check liveness. Broken URLs (4xx/5xx/network error) are
 * reported and optionally nullled out when ?fix=true is passed.
 *
 * Protected by CRON_SECRET — call from Vercel Cron or manually:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://loopapp.me/api/cron/cleanup-stale-media?fix=true"
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

function getClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY)
}

async function checkUrl(url: string, timeoutMs = 5000): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" })
    clearTimeout(timer)
    return { ok: res.ok, status: res.status }
  } catch (e: any) {
    return { ok: false, error: e?.message || "fetch failed" }
  }
}

interface StaleRecord {
  table: string
  id: string
  column: string
  url: string
  status?: number
  error?: string
}

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const fix = request.nextUrl.searchParams.get("fix") === "true"
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || "500"), 2000)

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 })
  }

  const supabase = getClient()
  const stale: StaleRecord[] = []
  const checked = { total: 0, broken: 0, ok: 0 }

  // ── 1. Profiles: avatar_url, banner_url ──────────────────────────────
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, avatar_url, banner_url")
    .not("avatar_url", "is", null)
    .not("avatar_url", "eq", "")
    .limit(limit)

  for (const p of profiles || []) {
    for (const col of ["avatar_url", "banner_url"] as const) {
      const url = (p as any)[col] as string | null
      if (!url || url.startsWith("data:") || url.startsWith("/")) continue
      // Skip DiceBear / Gravatar — they're CORS-friendly and stable
      if (url.includes("dicebear.com") || url.includes("gravatar.com")) continue
      checked.total++
      const result = await checkUrl(url)
      if (result.ok) {
        checked.ok++
      } else {
        checked.broken++
        stale.push({ table: "profiles", id: p.id, column: col, url, status: result.status, error: result.error })
      }
    }
  }

  // ── 2. Loops: media_url, content_media_url ───────────────────────────
  const { data: loops } = await supabase
    .from("loops")
    .select("id, media_url, content_media_url")
    .or("media_url.is.not.null,content_media_url.is.not.null")
    .limit(limit)

  for (const l of loops || []) {
    for (const col of ["media_url", "content_media_url"] as const) {
      const url = (l as any)[col] as string | null
      if (!url || url.startsWith("data:") || url.startsWith("/")) continue
      checked.total++
      const result = await checkUrl(url)
      if (result.ok) {
        checked.ok++
      } else {
        checked.broken++
        stale.push({ table: "loops", id: l.id, column: col, url, status: result.status, error: result.error })
      }
    }
  }

  // ── 3. Messages: media_url ───────────────────────────────────────────
  const { data: msgs } = await supabase
    .from("messages")
    .select("id, media_url")
    .not("media_url", "is", null)
    .not("media_url", "eq", "")
    .limit(limit)

  for (const m of msgs || []) {
    const url = (m as any).media_url as string | null
    if (!url || url.startsWith("data:") || url.startsWith("/")) continue
    checked.total++
    const result = await checkUrl(url)
    if (result.ok) {
      checked.ok++
    } else {
      checked.broken++
      stale.push({ table: "messages", id: m.id, column: "media_url", url, status: result.status, error: result.error })
    }
  }

  // ── 4. Optionally null out broken URLs ───────────────────────────────
  const fixed: StaleRecord[] = []
  if (fix && stale.length > 0) {
    for (const s of stale) {
      const { error } = await supabase.from(s.table).update({ [s.column]: null }).eq("id", s.id)
      if (!error) fixed.push(s)
    }
  }

  return NextResponse.json({
    scanned: { profiles: profiles?.length || 0, loops: loops?.length || 0, messages: msgs?.length || 0 },
    checked: checked.total,
    broken: checked.broken,
    ok: checked.ok,
    fixMode: fix,
    fixed: fixed.length,
    stale: stale.slice(0, 100), // Cap response size
  })
}

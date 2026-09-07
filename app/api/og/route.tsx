import { ImageResponse } from "next/og"
import type { NextRequest } from "next/server"
import { OgImage, loadOgFonts } from "@/lib/og-image"

export const runtime = "edge"

// In-memory cache for generated OG images (keyed by full URL).
// Combined with CDN-level s-maxage this keeps repeated shares fast.
const ogCache = new Map<string, { buf: ArrayBuffer; ts: number }>()
const OG_CACHE_TTL_MS = 1000 * 60 * 30 // 30 minutes
const OG_CACHE_MAX = 200

const CACHE_HEADERS = {
  "content-type": "image/png",
  "cache-control":
    "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
}

/**
 * Dynamic Open Graph image endpoint.
 *
 * Usage:
 *   /api/og?type=home&title=...&description=...
 *   /api/og?type=community&id=...
 *   /api/og?type=profile&username=...
 *   /api/og?type=loop&id=...
 *   /api/og?type=coloop&id=...
 *   /api/og?type=duel&id=...
 *   /api/og?type=reel&id=...
 *   /api/og?type=live&id=...
 *   /api/og?type=project&id=...
 *   /api/og?type=event&id=...
 *   /api/og?type=challenge&id=...
 *
 * For community/profile/loop/coloop types, the route fetches real data
 * from Supabase when an `id` or `username` is provided without explicit title.
 * Falls back to query params for manual overrides.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Check in-memory cache first
    const cacheKey = request.url
    const cached = ogCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < OG_CACHE_TTL_MS) {
      return new Response(cached.buf, { headers: CACHE_HEADERS })
    }

    const type = searchParams.get("type") || "home"
    const id = searchParams.get("id") || undefined
    const title = searchParams.get("title") || undefined
    const description = searchParams.get("description") || undefined
    const username = searchParams.get("username") || undefined
    const verified = searchParams.get("verified") === "true"
    const stat = searchParams.get("stat") || undefined
    const statLabel = searchParams.get("stat_label") || undefined
    let avatar = searchParams.get("avatar") || undefined

    if (avatar && !avatar.startsWith("http://") && !avatar.startsWith("https://")) {
      avatar = undefined
    }

    // Fetch real data from Supabase when an ID/username is given but no explicit title
    let ogProps: Record<string, any> = {
      type,
      title,
      description,
      username,
      avatar,
      verified,
      stat,
      statLabel,
    }

    if (id && !title) {
      try {
        ogProps = { ...ogProps, ...(await fetchTypeData(type, id)) }
      } catch (err) {
        console.error("[og] Failed to fetch data for", type, id, err)
      }
    } else if (username && !title) {
      try {
        ogProps = { ...ogProps, ...(await fetchProfileData(username)) }
      } catch (err) {
        console.error("[og] Failed to fetch profile data for", username, err)
      }
    }

    const fonts = await loadOgFonts()

    const imageResponse = new ImageResponse(
      <OgImage {...ogProps} />,
      {
        width: 1200,
        height: 630,
        fonts,
      },
    )

    const buf = await imageResponse.arrayBuffer()

    // Store in LRU-style cache
    ogCache.set(cacheKey, { buf, ts: Date.now() })
    if (ogCache.size > OG_CACHE_MAX) {
      const oldestKey = ogCache.keys().next().value
      if (oldestKey) ogCache.delete(oldestKey)
    }

    return new Response(buf, { headers: CACHE_HEADERS })
  } catch (error) {
    console.error("OG image generation failed:", error)

    // Crawlers cache failure responses aggressively — a hard 500 here is why
    // shares sometimes show no preview even after the route is fixed. Render a
    // simple branded fallback instead of erroring so every share still gets an
    // image. Font-free on purpose: the full template run already failed, so
    // keep the fallback dependency-light.
    try {
      const { searchParams } = new URL(request.url)
      const fallbackTitle = (searchParams.get("title") || "Loop — Build Together").slice(0, 80)
      const fallback = new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(160deg, #0a0819 0%, #141033 38%, #1c1248 64%, #0c0a24 100%)",
              color: "#ffffff",
              fontFamily: "system-ui, sans-serif",
              textAlign: "center",
              padding: 64,
            }}
          >
            <div style={{ fontSize: 28, color: "#67e8f9", marginBottom: 24 }}>loopapp.me</div>
            <div style={{ fontSize: 52, fontWeight: 700, maxWidth: 900 }}>{fallbackTitle}</div>
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.65)", marginTop: 24 }}>
              Build together — not just post into the void.
            </div>
          </div>
        ),
        { width: 1200, height: 630 },
      )
      const fallbackBuf = await fallback.arrayBuffer()
      return new Response(fallbackBuf, { headers: CACHE_HEADERS })
    } catch (fallbackError) {
      console.error("OG fallback image also failed:", fallbackError)
      return new Response("OG image generation failed", { status: 500 })
    }
  }
}

// ── Data fetchers ───────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

function sbQuery(table: string, params: string) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`
  return fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(3000),
  })
}

function sbSingle(table: string, params: string) {
  const p = sbQuery(table, params)
  if (!p) return null
  return p.then((r) => (r.ok ? r.json().then((d) => d?.[0] || null) : null))
}

async function fetchTypeData(type: string, id: string): Promise<Record<string, any>> {
  const normalized = type === "circle" ? "community" : type

  switch (normalized) {
    case "community": {
      const [circle, memberCount] = await Promise.all([
        sbSingle("circles", `select=name,description,avatar_url,category,cover_url,banner_url,is_private,is_verified&id=eq.${encodeURIComponent(id)}&limit=1`),
        fetchMemberCount(id),
      ])
      if (!circle) return {}
      const categoryLabel = circle.category || "general"
      return {
        title: circle.name,
        description: circle.description || `Join ${circle.name} on Loop Social OS`,
        avatar: circle.avatar_url || undefined,
        banner: circle.cover_url || circle.banner_url || undefined,
        category: categoryLabel,
        isPrivate: circle.is_private,
        verified: circle.is_verified,
        memberCount: memberCount,
      }
    }

    case "coloop": {
      const session = await sbSingle("co_loop_sessions", `select=topic,description,co_authors&session_id=eq.${encodeURIComponent(id)}&limit=1`)
      if (!session) return {}
      const coAuthors = session.co_authors || []
      const contributorAvatars: string[] = []
      // Fetch profiles for co-authors
      if (coAuthors.length > 0) {
        const userIds = coAuthors.map((a: any) => a.user_id || a).filter(Boolean).slice(0, 5)
        if (userIds.length > 0) {
          const profiles = await sbQuery("profiles", `select=avatar_url&id=in.(${userIds.join(",")})`)
          if (profiles) {
            const data = await profiles.json()
            for (const p of data || []) {
              if (p.avatar_url) contributorAvatars.push(p.avatar_url)
            }
          }
        }
      }
      return {
        title: session.topic || "Co-Loop",
        description: session.description || "Collaboratively created on Loop",
        contributorCount: coAuthors.length,
        contributorAvatars,
      }
    }

    case "duel": {
      const duel = await sbSingle("duels", `select=topic,option_a,option_b,total_votes&id=eq.${encodeURIComponent(id)}&limit=1`)
      if (!duel) return {}
      return {
        title: duel.topic || "Community Duel",
        description: `${duel.option_a || "Option A"} vs ${duel.option_b || "Option B"}`,
        voteCount: Number(duel.total_votes || 0),
      }
    }

    case "loop":
    case "developer": {
      const loop = await sbSingle("loops", `select=content_title,content,content_type,profiles!author_id(username,display_name,avatar_url,is_verified)&id=eq.${encodeURIComponent(id)}&limit=1`)
      if (!loop) return {}
      const author = loop.profiles || {}
      return {
        title: loop.content_title || (loop.content || "").slice(0, 60),
        description: (loop.content || "").slice(0, 200),
        username: author.username,
        avatar: author.avatar_url,
        verified: Boolean(author.is_verified),
      }
    }

    case "project": {
      const project = await sbSingle("community_projects", `select=title,description,status,progress,contributor_count&circle_project_id=eq.${encodeURIComponent(id)}&limit=1`)
      if (!project) return {}
      return {
        title: project.title || "Community Project",
        description: project.description || "",
        contributorCount: Number(project.contributor_count || 0),
        progress: Number(project.progress || 0),
        status: project.status || "active",
      }
    }

    case "event": {
      const event = await sbSingle("circle_events", `select=title,description,starts_at&circle_event_id=eq.${encodeURIComponent(id)}&limit=1`)
      if (!event) return {}
      return {
        title: event.title || "Community Event",
        description: event.description || "",
        startDate: event.starts_at,
      }
    }

    case "challenge": {
      const challenge = await sbSingle("circle_challenges", `select=title,description,ends_at,participant_count&circle_challenge_id=eq.${encodeURIComponent(id)}&limit=1`)
      if (!challenge) return {}
      return {
        title: challenge.title || "Community Challenge",
        description: challenge.description || "",
        endsAt: challenge.ends_at,
        participantCount: Number(challenge.participant_count || 0),
      }
    }

    default:
      return {}
  }
}

async function fetchProfileData(username: string): Promise<Record<string, any>> {
  const profile = await sbSingle(
    "profiles",
    `select=display_name,bio,avatar_url,is_verified,is_premium,followers_count&username=eq.${encodeURIComponent(username)}&limit=1`,
  )
  if (!profile) return {}
  return {
    title: profile.display_name || username,
    description: profile.bio || `Check out @${username} on Loop Social OS`,
    username,
    avatar: profile.avatar_url,
    verified: Boolean(profile.is_verified),
    isPremium: Boolean(profile.is_premium),
    followersCount: Number(profile.followers_count || 0),
  }
}

async function fetchMemberCount(circleId: string): Promise<number> {
  const res = await sbQuery(
    "circle_members",
    `select=id&circle_id=eq.${encodeURIComponent(circleId)}&status=eq.active&head=true`,
  )
  if (!res) return 0
  const contentRange = res.headers.get("content-range")
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)$/)
    if (match) return parseInt(match[1], 10)
  }
  const data = await res.json().catch(() => null)
  return Array.isArray(data) ? data.length : 0
}

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { normalizeProfileLayout, validateProfileLayout } from "@/lib/profile-layout"
import { sanitizeProfileCustomCss } from "@/lib/profile-custom-css"

export const dynamic = "force-dynamic"

const CATEGORIES = new Set(["minimal", "editorial", "creative", "portfolio", "gaming", "community", "other"])

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "profile-design"
}

function safeCoverUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return url.toString()
  } catch {
    return null
  }
}

function safeThemeTokens(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const input = value as Record<string, unknown>
  const tokens: Record<string, string> = {}
  for (const key of ["primary", "secondary", "accent", "background", "surface", "text"]) {
    const color = input[key]
    if (typeof color === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
      tokens[key] = color
    }
  }
  return tokens
}

async function staffAccess(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin, is_moderator, staff_role")
    .eq("id", userId)
    .maybeSingle()
  return Boolean(data?.is_admin || data?.is_moderator || data?.staff_role === "admin" || data?.staff_role === "moderator")
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const user = await getUserFromRequest(request)
    const params = request.nextUrl.searchParams
    const mode = params.get("mode") || "explore"
    const category = params.get("category")
    const queryText = (params.get("q") || "").trim().toLowerCase().slice(0, 80)

    if (mode === "purchased") {
      if (!user) return NextResponse.json({ error: "Sign in to view your library." }, { status: 401 })
      const { data, error } = await supabase
        .from("profile_design_purchases")
        .select("id, listing_id, creator_id, title_snapshot, layout_snapshot, css_snapshot, theme_snapshot, price_coins, purchased_at")
        .eq("buyer_id", user.id)
        .order("purchased_at", { ascending: false })
        .limit(100)
      if (error) throw error
      return NextResponse.json({ success: true, items: data || [] })
    }

    let builder = supabase
      .from("profile_design_listings")
      .select("*")
      .order("featured", { ascending: false })
      .order("purchase_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100)

    if (mode === "mine") {
      if (!user) return NextResponse.json({ error: "Sign in to view your designs." }, { status: 401 })
      builder = builder.eq("creator_id", user.id)
    } else if (mode === "review") {
      if (!user || !(await staffAccess(supabase, user.id))) {
        return NextResponse.json({ error: "Moderator access required." }, { status: 403 })
      }
      builder = builder.eq("status", "pending").order("created_at", { ascending: true })
    } else {
      builder = builder.eq("status", "published")
    }

    if (category && category !== "all") builder = builder.eq("category", category)
    const { data: listings, error } = await builder
    if (error) throw error

    const filtered = (listings || []).filter((listing) => {
      if (!queryText) return true
      return `${listing.title} ${listing.summary} ${listing.description} ${(listing.tags || []).join(" ")}`.toLowerCase().includes(queryText)
    })

    const creatorIds = [...new Set(filtered.map((listing) => listing.creator_id))]
    const { data: creators } = creatorIds.length
      ? await supabase.from("profiles").select("id, username, display_name, avatar_url, is_verified").in("id", creatorIds)
      : { data: [] as any[] }
    const creatorById = new Map((creators || []).map((creator) => [creator.id, creator]))
    const items = filtered.map((listing) => ({
      ...listing,
      design_layout: normalizeProfileLayout(listing.design_layout),
      creator: creatorById.get(listing.creator_id) || null,
    }))

    if (mode === "mine" && user) {
      const { data: sales } = await supabase
        .from("profile_design_purchases")
        .select("creator_earning_coins")
        .eq("creator_id", user.id)
      const earnings = (sales || []).reduce((total, sale) => total + Number(sale.creator_earning_coins || 0), 0)
      return NextResponse.json({ success: true, items, earnings, sales: (sales || []).length })
    }

    return NextResponse.json({ success: true, items })
  } catch (error) {
    console.error("Profile marketplace error:", error)
    return NextResponse.json({ error: "Could not load the profile marketplace." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to publish a design." }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid design submission." }, { status: 400 })
    }

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const summary = typeof body.summary === "string" ? body.summary.trim() : ""
    const description = typeof body.description === "string" ? body.description.trim() : ""
    if (title.length < 3 || title.length > 72) {
      return NextResponse.json({ error: "Title must be between 3 and 72 characters." }, { status: 400 })
    }
    if (summary.length < 12 || summary.length > 180) {
      return NextResponse.json({ error: "Summary must be between 12 and 180 characters." }, { status: 400 })
    }
    if (description.length < 30 || description.length > 1600) {
      return NextResponse.json({ error: "Description must be between 30 and 1,600 characters." }, { status: 400 })
    }

    const category = CATEGORIES.has(body.category) ? body.category : "other"
    const price = Number(body.price_coins)
    if (!Number.isInteger(price) || price < 0 || price > 100000) {
      return NextResponse.json({ error: "Price must be a whole number between 0 and 100,000 Loop Coins." }, { status: 400 })
    }

    let layout
    let css
    try {
      layout = validateProfileLayout(body.design_layout)
      css = sanitizeProfileCustomCss(typeof body.design_css === "string" ? body.design_css : "")
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid design data." }, { status: 400 })
    }

    const tags = Array.isArray(body.tags)
      ? [...new Set(body.tags.filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => tag.trim().toLowerCase().replace(/[^a-z0-9 -]/g, "").slice(0, 24)).filter(Boolean))].slice(0, 8)
      : []
    const coverUrl = safeCoverUrl(body.cover_url)
    const themeTokens = safeThemeTokens(body.theme_tokens)
    const slug = slugify(title) + "-" + crypto.randomUUID().slice(0, 8)

    const supabase = createServerClient()
    const { data: listing, error } = await supabase
      .from("profile_design_listings")
      .insert({
        creator_id: user.id,
        slug,
        title,
        summary,
        description,
        category,
        tags,
        cover_url: coverUrl,
        price_coins: price,
        design_layout: layout,
        design_css: css,
        theme_tokens: themeTokens,
        status: "pending",
      })
      .select("*")
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, listing, message: "Submitted for review." }, { status: 201 })
  } catch (error) {
    console.error("Profile design submission error:", error)
    return NextResponse.json({ error: "Could not submit this design." }, { status: 500 })
  }
}

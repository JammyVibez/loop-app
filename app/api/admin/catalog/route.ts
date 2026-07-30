import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAdmin(token: string | null) {
  if (!token) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token)
  if (authError || !user) return { error: NextResponse.json({ error: "Invalid authentication" }, { status: 401 }) }
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  return { user }
}

const THEME_PRESETS: Record<string, any> = {
  aurora: {
    colors: { primary: "#22d3ee", secondary: "#a78bfa", accent: "#34d399", background: "#020617", surface: "#0f172a", text: "#e2e8f0" },
    effects: { glow: true, particles: true, animations: true },
  },
  ember: {
    colors: { primary: "#f97316", secondary: "#ef4444", accent: "#fbbf24", background: "#1c1917", surface: "#292524", text: "#ffedd5" },
    effects: { glow: true, particles: false, animations: true },
  },
  mint: {
    colors: { primary: "#10b981", secondary: "#14b8a6", accent: "#84cc16", background: "#ecfdf5", surface: "#d1fae5", text: "#064e3b" },
    effects: { glow: false, particles: false, animations: true },
  },
  midnight: {
    colors: { primary: "#6366f1", secondary: "#8b5cf6", accent: "#ec4899", background: "#030712", surface: "#111827", text: "#f9fafb" },
    effects: { glow: true, particles: true, animations: true },
  },
}

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
  const auth = await requireAdmin(token)
  if (auth.error) return auth.error

  const { data: items, error } = await supabase
    .from("shop_items")
    .select("*")
    .in("category", ["theme", "effect", "animation", "avatar", "badge"])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, items: items || [] })
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "") ?? null
    const auth = await requireAdmin(token)
    if (auth.error) return auth.error

    const body = await request.json()
    const name = String(body.name || "").trim()
    const category = body.category === "effect" || body.category === "animation" ? body.category : "theme"
    const rarity = ["common", "rare", "epic", "legendary"].includes(body.rarity) ? body.rarity : "common"
    const priceCoins = Number(body.price_coins || 0)
    const presetKey = body.preset || "aurora"
    const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.aurora

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const itemType =
      category === "theme" ? "profile_theme" : category === "animation" ? "avatar_effect" : "aura_effect"

    const itemData =
      body.item_data ||
      (category === "theme"
        ? preset
        : {
            colors: preset.colors,
            effects: { ...(preset.effects || {}), kind: category, intensity: body.intensity || "medium" },
          })

    const { data: item, error } = await supabase
      .from("shop_items")
      .insert({
        name,
        description: body.description || `${name} ${category} for Loop profiles`,
        category,
        item_type: itemType,
        rarity,
        price_coins: priceCoins,
        price_usd: Number(body.price_usd || 0),
        premium_only: Boolean(body.premium_only),
        is_active: body.is_active !== false,
        item_data: itemData,
        preview_data: {
          preview: `linear-gradient(45deg, ${itemData.colors?.primary || "#8b5cf6"}, ${itemData.colors?.secondary || "#3b82f6"})`,
          colors: itemData.colors || {},
        },
        created_by: auth.user!.id,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single()

    if (error) {
      // Unique name conflict
      if (/unique|duplicate/i.test(error.message || "")) {
        return NextResponse.json({ error: "An item with that name already exists" }, { status: 400 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also mirror themes into themes table when category is theme
    if (category === "theme") {
      await supabase.from("themes").insert({
        creator_id: auth.user!.id,
        name,
        description: body.description || "",
        price_coins: priceCoins,
        rarity,
        theme_data: itemData,
        tags: body.tags || [category],
        is_active: true,
      })
    }

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error("Admin catalog create error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

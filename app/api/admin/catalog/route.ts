import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

async function requireAdmin(request: NextRequest) {
  const user = await getUserFromRequest(request)
  if (!user) return { error: NextResponse.json({ error: "Authentication required" }, { status: 401 }) }
  const supabase = createServerClient()
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
  if (!profile?.is_admin) {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }
  return { user }
}

/** Curated, no-signup-required Google Fonts for the "font" cosmetic category. */
const FONT_PRESETS: Record<string, string> = {
  inter: "'Inter', sans-serif",
  poppins: "'Poppins', sans-serif",
  playfair: "'Playfair Display', serif",
  space_grotesk: "'Space Grotesk', sans-serif",
  jetbrains_mono: "'JetBrains Mono', monospace",
  fira_code: "'Fira Code', monospace",
  pacifico: "'Pacifico', cursive",
  bebas: "'Bebas Neue', sans-serif",
  righteous: "'Righteous', sans-serif",
  caveat: "'Caveat', cursive",
  dancing_script: "'Dancing Script', cursive",
  unbounded: "'Unbounded', sans-serif",
  cinzel: "'Cinzel', serif",
  orbitron: "'Orbitron', sans-serif",
  press_start: "'Press Start 2P', monospace",
  lobster: "'Lobster', cursive",
  fredoka: "'Fredoka', sans-serif",
  sora: "'Sora', sans-serif",
  manrope: "'Manrope', sans-serif",
  amatic: "'Amatic SC', cursive",
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
  sakura: {
    colors: { primary: "#f472b6", secondary: "#fb7185", accent: "#fbcfe8", background: "#1c0f18", surface: "#2a1522", text: "#fce7f3" },
    effects: { glow: true, particles: true, animations: true },
  },
  forest: {
    colors: { primary: "#16a34a", secondary: "#22c55e", accent: "#a3e635", background: "#07130a", surface: "#0e2013", text: "#dcfce7" },
    effects: { glow: true, particles: true, animations: true },
  },
  ocean: {
    colors: { primary: "#0ea5e9", secondary: "#06b6d4", accent: "#67e8f9", background: "#020617", surface: "#0c2233", text: "#e0f2fe" },
    effects: { glow: true, particles: true, animations: true },
  },
  sunset: {
    colors: { primary: "#ff6b6b", secondary: "#ffa94d", accent: "#ff1744", background: "#1c0f0a", surface: "#2a1710", text: "#fff3e0" },
    effects: { glow: true, particles: true, animations: true },
  },
  royal: {
    colors: { primary: "#8b5cf6", secondary: "#fbbf24", accent: "#c4b5fd", background: "#0b0714", surface: "#170f2b", text: "#f3e8ff" },
    effects: { glow: true, particles: true, animations: true },
  },
  cyber: {
    colors: { primary: "#00ff88", secondary: "#00ccff", accent: "#ff0080", background: "#050b0a", surface: "#0d1a16", text: "#eafff5" },
    effects: { glow: true, particles: true, animations: true },
  },
  arctic: {
    colors: { primary: "#7dd3fc", secondary: "#e0f2fe", accent: "#38bdf8", background: "#020617", surface: "#0f1b2e", text: "#f0f9ff" },
    effects: { glow: true, particles: false, animations: true },
  },
  candy: {
    colors: { primary: "#f9a8d4", secondary: "#a5b4fc", accent: "#fde68a", background: "#150b18", surface: "#22142a", text: "#fdf2f8" },
    effects: { glow: true, particles: true, animations: true },
  },
}

const CATALOG_CATEGORIES = ["theme", "effect", "animation", "font", "card_effect"] as const
type CatalogCategory = (typeof CATALOG_CATEGORIES)[number]

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error

  const supabase = createServerClient()
  const { data: items, error } = await supabase
    .from("shop_items")
    .select("*")
    .in("category", ["theme", "effect", "animation", "font", "card_effect", "avatar", "badge"])
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, items: items || [] })
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if (auth.error) return auth.error

    const supabase = createServerClient()
    const body = await request.json()
    const name = String(body.name || "").trim()
    const category: CatalogCategory = CATALOG_CATEGORIES.includes(body.category) ? body.category : "theme"
    const rarity = ["common", "rare", "epic", "legendary"].includes(body.rarity) ? body.rarity : "common"
    const priceCoins = Number(body.price_coins || 0)
    const presetKey = body.preset || "aurora"
    const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.aurora

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const itemType =
      category === "theme"
        ? "profile_theme"
        : category === "animation"
          ? "avatar_effect"
          : category === "font"
            ? "display_font"
            : category === "card_effect"
              ? "post_card_effect"
              : "aura_effect"

    const fontFamily =
      category === "font" ? FONT_PRESETS[body.font_preset as string] || body.font_family || FONT_PRESETS.inter : undefined

    // Animated variant hints (pure data — the render layer resolves these
    // from item_data, so new variants work without a redeploy):
    //   animation/effect -> frame_variant (avatar), pfp_interaction (tap/hover)
    //   card_effect       -> card_variant (post card edge)
    const variantHints: Record<string, string> = {}
    if (["animation", "effect"].includes(category)) {
      if (["ring_rotate", "orbit_particles", "pulse_glow", "tilt_3d"].includes(body.frame_variant)) {
        variantHints.frame_variant = body.frame_variant
      }
      if (["burst", "bounce", "pulse"].includes(body.pfp_interaction)) {
        variantHints.pfp_interaction = body.pfp_interaction
      }
    }
    if (category === "card_effect") {
      if (["gradient_border", "shimmer", "pulse_edge"].includes(body.card_variant)) {
        variantHints.card_variant = body.card_variant
      }
    }

    const itemData =
      body.item_data ||
      (category === "theme"
        ? preset
        : category === "font"
          ? { font_family: fontFamily, font_preset: body.font_preset || "inter" }
          : {
              colors: preset.colors,
              effects: { ...(preset.effects || {}), kind: category, intensity: body.intensity || "medium" },
              ...variantHints,
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

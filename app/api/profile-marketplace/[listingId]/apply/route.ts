import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { normalizeProfileLayout } from "@/lib/profile-layout"
import { sanitizeProfileCustomCss } from "@/lib/profile-custom-css"
import { hexToHslComponents } from "@/lib/theme-css"

export const dynamic = "force-dynamic"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const user = await getUserFromRequest(_request)
    if (!user) return NextResponse.json({ error: "Sign in to apply a design." }, { status: 401 })
    const { listingId } = await params
    const supabase = createServerClient()
    const { data: purchase, error: purchaseError } = await supabase
      .from("profile_design_purchases")
      .select("layout_snapshot, css_snapshot, theme_snapshot")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .maybeSingle()
    if (purchaseError || !purchase) {
      return NextResponse.json({ error: "Purchase this design before applying it." }, { status: 403 })
    }

    const layout = normalizeProfileLayout(purchase.layout_snapshot)
    const tokens = purchase.theme_snapshot && typeof purchase.theme_snapshot === "object"
      ? purchase.theme_snapshot as Record<string, unknown>
      : {}
    const themeVariables: Record<string, string[]> = {
      primary: ["--primary", "--ring"],
      secondary: ["--secondary"],
      accent: ["--accent"],
      background: ["--background"],
      surface: ["--card", "--popover", "--muted", "--input", "--border"],
      text: ["--foreground", "--card-foreground", "--popover-foreground"],
    }
    const themeCss = Object.entries(themeVariables).flatMap(([token, properties]) => {
      const color = tokens[token]
      if (typeof color !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return []
      const hsl = hexToHslComponents(color)
      return hsl ? properties.map((property) => `${property}: ${hsl};`) : []
    })
    const themeRule = themeCss.length
      ? `.loop-profile-custom-css { ${themeCss.join(" ")} }`
      : ""
    const css = sanitizeProfileCustomCss([themeRule, purchase.css_snapshot || ""].filter(Boolean).join("\n"))
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        profile_layout: layout,
        profile_design_css: css,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select("profile_layout, profile_design_css")
      .single()
    if (error) throw error

    return NextResponse.json({ success: true, profile })
  } catch (error) {
    console.error("Apply profile design error:", error)
    return NextResponse.json({ error: "Could not apply this design." }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { normalizeProfileLayout } from "@/lib/profile-layout"
import { sanitizeProfileCustomCss } from "@/lib/profile-custom-css"

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
    const css = sanitizeProfileCustomCss(purchase.css_snapshot || "")
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

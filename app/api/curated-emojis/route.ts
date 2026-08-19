import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: emojis, error } = await supabase
      .from("curated_emojis")
      .select("shortcode, url, preview_url, category")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, emojis: emojis || [] })
  } catch (error: any) {
    console.error("Curated emojis GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: badges, error } = await supabase
      .from("verification_badges")
      .select("id, name, label, icon, colors, description")
      .eq("is_active", true)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ success: true, badges: [] })
    return NextResponse.json({ success: true, badges: badges || [] })
  } catch {
    return NextResponse.json({ success: true, badges: [] })
  }
}

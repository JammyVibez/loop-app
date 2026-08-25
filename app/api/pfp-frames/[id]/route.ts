import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createServerClient()
    const { id: frameId } = await params

    const { data: frame, error } = await supabase
      .from("pfp_frames")
      .select("id, name, image_url, image_type")
      .eq("id", frameId)
      .eq("is_active", true)
      .single()

    if (error || !frame) {
      return NextResponse.json({ error: "Frame not found" }, { status: 404 })
    }

    return NextResponse.json({ frame })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

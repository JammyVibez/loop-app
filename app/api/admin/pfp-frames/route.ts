import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

async function requireAdmin(supabase: any, token: string) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles").select("is_admin").eq("id", user.id).single()
  if (!profile?.is_admin) return null
  return user
}

// GET /api/admin/pfp-frames — list all frames
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = await requireAdmin(supabase, authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Admin required" }, { status: 403 })

    const { data: frames, error } = await supabase
      .from("pfp_frames")
      .select("*")
      .order("sort_order", { ascending: true })

    if (error) throw error

    // Get usage counts
    const { data: usage } = await supabase
      .from("user_pfp_frames")
      .select("frame_id, equipped")
      .eq("equipped", true)

    const usageMap: Record<number, number> = {}
    usage?.forEach((u: any) => {
      usageMap[u.frame_id] = (usageMap[u.frame_id] || 0) + 1
    })

    return NextResponse.json({
      frames: frames?.map((f: any) => ({
        ...f,
        equipped_count: usageMap[f.id] || 0,
      })) || [],
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/admin/pfp-frames — create a frame
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = await requireAdmin(supabase, authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Admin required" }, { status: 403 })

    const body = await request.json()
    const { name, description, image_url, image_type, is_premium, price_coins, sort_order } = body

    if (!name || !image_url) {
      return NextResponse.json({ error: "name and image_url required" }, { status: 400 })
    }

    const { data: frame, error } = await supabase
      .from("pfp_frames")
      .insert({
        name,
        description: description || null,
        image_url,
        image_type: image_type || "image/png",
        is_premium: is_premium || false,
        price_coins: price_coins || 0,
        sort_order: sort_order || 0,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ frame })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/admin/pfp-frames?id=X — delete a frame
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient()
    const authHeader = request.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const user = await requireAdmin(supabase, authHeader.replace("Bearer ", ""))
    if (!user) return NextResponse.json({ error: "Admin required" }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const frameId = searchParams.get("id")
    if (!frameId) return NextResponse.json({ error: "Frame ID required" }, { status: 400 })

    const { error } = await supabase
      .from("pfp_frames")
      .delete()
      .eq("id", frameId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

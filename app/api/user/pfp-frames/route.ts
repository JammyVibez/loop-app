import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth";

// GET /api/user/pfp-frames — list all frames + user's inventory
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    // Get all active frames
    const { data: frames, error: framesErr } = await supabase
      .from("pfp_frames")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (framesErr) throw framesErr

    // Get user's acquired frames
    const { data: inventory } = await supabase
      .from("user_pfp_frames")
      .select("frame_id, equipped")
      .eq("user_id", user.id)

    // Get user's current equipped frame from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("equipped_frame_id, loop_coins")
      .eq("id", user.id)
      .single()

    const inventoryMap: Record<number, { equipped: boolean }> = {}
    inventory?.forEach((item: any) => {
      inventoryMap[item.frame_id] = { equipped: item.equipped }
    })

    return NextResponse.json({
      frames: frames?.map((f: any) => ({
        ...f,
        owned: !!inventoryMap[f.id],
        equipped: inventoryMap[f.id]?.equipped || false,
      })) || [],
      equipped_frame_id: profile?.equipped_frame_id || null,
      coins: profile?.loop_coins || 0,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/user/pfp-frames — acquire or equip a frame
// Body: { frame_id: number, action: "acquire" | "equip" | "unequip" }
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 })

    const { frame_id, action } = await request.json()
    if (!frame_id || !action) {
      return NextResponse.json({ error: "frame_id and action required" }, { status: 400 })
    }

    // Get frame details
    const { data: frame } = await supabase
      .from("pfp_frames")
      .select("*")
      .eq("id", frame_id)
      .single()

    if (!frame) return NextResponse.json({ error: "Frame not found" }, { status: 404 })

    // Get user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins, equipped_frame_id")
      .eq("id", user.id)
      .single()

    if (action === "acquire") {
      // Check if already owned
      const { data: existing } = await supabase
        .from("user_pfp_frames")
        .select("id")
        .eq("user_id", user.id)
        .eq("frame_id", frame_id)
        .single()

      if (existing) {
        return NextResponse.json({ error: "Already owned" }, { status: 400 })
      }

      // Free frames can be acquired instantly
      if (frame.price_coins > 0) {
        if ((profile?.loop_coins || 0) < frame.price_coins) {
          return NextResponse.json({ error: "Insufficient coins" }, { status: 400 })
        }
        // Deduct coins
        const { error: deductErr } = await supabase
          .from("profiles")
          .update({ loop_coins: (profile!.loop_coins || 0) - frame.price_coins })
          .eq("id", user.id)
        if (deductErr) throw deductErr
      }

      // Add to inventory
      const { error: insertErr } = await supabase
        .from("user_pfp_frames")
        .insert({ user_id: user.id, frame_id, equipped: false })
      if (insertErr) throw insertErr

      return NextResponse.json({ success: true, message: "Frame acquired!" })
    }

    if (action === "equip" || action === "unequip") {
      const shouldEquip = action === "equip"

      // Verify user owns the frame (or it's the "None" frame)
      if (frame.price_coins > 0 || frame.name !== "None") {
        const { data: ownership } = await supabase
          .from("user_pfp_frames")
          .select("id")
          .eq("user_id", user.id)
          .eq("frame_id", frame_id)
          .single()

        if (!ownership) {
          return NextResponse.json({ error: "You don't own this frame. Acquire it first." }, { status: 400 })
        }
      }

      // Unequip all current frames
      await supabase
        .from("user_pfp_frames")
        .update({ equipped: false })
        .eq("user_id", user.id)
        .eq("equipped", true)

      if (shouldEquip) {
        // Equip new frame
        const { error: equipErr } = await supabase
          .from("user_pfp_frames")
          .upsert({ user_id: user.id, frame_id, equipped: true }, { onConflict: "user_id,frame_id" })
        if (equipErr) throw equipErr
      }

      // Update profile's equipped_frame_id
      await supabase
        .from("profiles")
        .update({ equipped_frame_id: shouldEquip ? frame_id : null })
        .eq("id", user.id)

      return NextResponse.json({ success: true, equipped: shouldEquip })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

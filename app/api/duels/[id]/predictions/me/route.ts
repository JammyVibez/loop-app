import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: duelId } = await params
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ success: true, prediction: null }, { status: 200 })

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) return NextResponse.json({ success: true, prediction: null }, { status: 200 })

    const { data: prediction } = await supabase
      .from("clutch_duel_predictions")
      .select("*")
      .eq("duel_id", duelId)
      .eq("user_id", authData.user.id)
      .maybeSingle()

    return NextResponse.json({ success: true, prediction })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

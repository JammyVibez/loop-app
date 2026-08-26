
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    

    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Call the distribute_weekly_bonus function
    const { data, error } = await supabase.rpc('distribute_weekly_bonus')

    if (error) {
      console.error('Bonus distribution error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      users_count: data,
      message: `Weekly bonus distributed to ${data} users`
    })

  } catch (error) {
    console.error("Distribute bonus error:", error)
    return NextResponse.json({ error: "Failed to distribute bonus" }, { status: 500 })
  }
}

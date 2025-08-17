
```typescript
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user has already claimed weekly bonus this week
    const startOfWeek = new Date()
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const { data: existingClaim, error: claimError } = await supabase
      .from("weekly_bonus_claims")
      .select("*")
      .eq("user_id", user.id)
      .gte("claimed_at", startOfWeek.toISOString())
      .single()

    if (existingClaim) {
      return NextResponse.json(
        {
          error: "Weekly bonus already claimed this week",
          next_available: new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { status: 400 }
      )
    }

    // Award the weekly bonus using the function
    const { error: updateError } = await supabase.rpc("distribute_weekly_bonus")

    if (updateError) {
      console.error("Error awarding weekly bonus:", updateError)
      
      // Fallback to manual update if function doesn't exist
      const { error: manualError } = await supabase
        .from('profiles')
        .update({ loop_coins: supabase.raw('loop_coins + 500') })
        .eq('id', user.id)

      if (manualError) {
        return NextResponse.json({ error: "Failed to award weekly bonus" }, { status: 500 })
      }

      // Record the claim manually
      await supabase.from("weekly_bonus_claims").insert({
        user_id: user.id,
        bonus_amount: 500
      })

      // Record transaction
      await supabase.from("coin_transactions").insert({
        user_id: user.id,
        amount: 500,
        transaction_type: 'weekly_bonus',
        description: 'Weekly bonus coins'
      })
    }

    return NextResponse.json({
      success: true,
      bonus_amount: 500,
      message: "Weekly bonus of 500 Loop Coins awarded!",
    })
  } catch (error) {
    console.error("Error claiming weekly bonus:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

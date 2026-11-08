import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in to leave a review." }, { status: 401 })
    const { listingId } = await params
    const body = await request.json().catch(() => ({}))
    const rating = Number(body.rating)
    const review = typeof body.review === "string" ? body.review.trim().slice(0, 1000) : ""
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Choose a rating from 1 to 5." }, { status: 400 })
    }

    const supabase = createServerClient()
    const { data: purchase } = await supabase
      .from("profile_design_purchases")
      .select("id")
      .eq("listing_id", listingId)
      .eq("buyer_id", user.id)
      .maybeSingle()
    if (!purchase) return NextResponse.json({ error: "Only verified buyers can review a design." }, { status: 403 })

    const { error } = await supabase
      .from("profile_design_reviews")
      .upsert(
        { listing_id: listingId, buyer_id: user.id, rating, review, updated_at: new Date().toISOString() },
        { onConflict: "listing_id,buyer_id" },
      )
    if (error) throw error

    const { data: allReviews } = await supabase
      .from("profile_design_reviews")
      .select("rating")
      .eq("listing_id", listingId)
    const rows = allReviews || []
    const ratingCount = rows.length
    const ratingAverage = ratingCount
      ? rows.reduce((sum, row) => sum + Number(row.rating || 0), 0) / ratingCount
      : 0
    await supabase
      .from("profile_design_listings")
      .update({ rating_average: ratingAverage, rating_count: ratingCount, updated_at: new Date().toISOString() })
      .eq("id", listingId)

    return NextResponse.json({ success: true, rating_average: ratingAverage, rating_count: ratingCount })
  } catch (error) {
    console.error("Profile design review error:", error)
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 })
  }
}

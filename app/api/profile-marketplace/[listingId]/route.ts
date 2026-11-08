import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"
import { validateProfileLayout } from "@/lib/profile-layout"
import { sanitizeProfileCustomCss } from "@/lib/profile-custom-css"

export const dynamic = "force-dynamic"

async function isStaff(supabase: ReturnType<typeof createServerClient>, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin, is_moderator, staff_role")
    .eq("id", userId)
    .maybeSingle()
  return Boolean(data?.is_admin || data?.is_moderator || data?.staff_role === "admin" || data?.staff_role === "moderator")
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const { listingId } = await params
    const supabase = createServerClient()
    const { data: listing, error } = await supabase
      .from("profile_design_listings")
      .select("*")
      .eq("id", listingId)
      .maybeSingle()
    if (error || !listing) return NextResponse.json({ error: "Design not found." }, { status: 404 })

    const user = await getUserFromRequest(_request)
    const isCreator = listing.creator_id === user?.id
    const isModerator = Boolean(user && await isStaff(supabase, user.id))
    let isBuyer = false
    if (user && listing.status !== "published" && !isCreator && !isModerator) {
      const { data: purchase } = await supabase
        .from("profile_design_purchases")
        .select("id")
        .eq("listing_id", listingId)
        .eq("buyer_id", user.id)
        .maybeSingle()
      isBuyer = Boolean(purchase)
    }
    if (listing.status !== "published" && !isCreator && !isModerator && !isBuyer) {
      return NextResponse.json({ error: "Design not found." }, { status: 404 })
    }

    const [{ data: creator }, { data: reviews }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, avatar_url, is_verified").eq("id", listing.creator_id).maybeSingle(),
      supabase.from("profile_design_reviews").select("id, buyer_id, rating, review, created_at").eq("listing_id", listingId).order("created_at", { ascending: false }).limit(30),
    ])
    const { design_css: _designCss, design_layout: _designLayout, ...publicListing } = listing
    const includeDesignPackage = isCreator || isModerator || isBuyer
    return NextResponse.json({
      success: true,
      listing: {
        ...publicListing,
        ...(includeDesignPackage ? { design_css: listing.design_css, design_layout: listing.design_layout } : {}),
        creator,
        reviews: reviews || [],
      },
    })
  } catch (error) {
    console.error("Profile design detail error:", error)
    return NextResponse.json({ error: "Could not load this design." }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listingId: string }> },
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 })
    const { listingId } = await params
    const supabase = createServerClient()
    const { data: listing, error: lookupError } = await supabase
      .from("profile_design_listings")
      .select("*")
      .eq("id", listingId)
      .maybeSingle()
    if (lookupError || !listing) return NextResponse.json({ error: "Design not found." }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const staff = await isStaff(supabase, user.id)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (staff && ["published", "rejected", "archived"].includes(body.status)) {
      updates.status = body.status
      updates.moderation_note = typeof body.moderation_note === "string" ? body.moderation_note.trim().slice(0, 500) : null
      if (typeof body.featured === "boolean") updates.featured = body.featured
    } else {
      if (listing.creator_id !== user.id) return NextResponse.json({ error: "Creator access required." }, { status: 403 })
      if (!["pending", "rejected", "draft"].includes(listing.status)) {
        return NextResponse.json({ error: "Published designs cannot be changed after purchase. Archive and submit a new version." }, { status: 409 })
      }
      if (typeof body.title === "string") {
        const title = body.title.trim()
        if (title.length < 3 || title.length > 72) return NextResponse.json({ error: "Title must be between 3 and 72 characters." }, { status: 400 })
        updates.title = title
      }
      if (typeof body.summary === "string") {
        const summary = body.summary.trim()
        if (summary.length < 12 || summary.length > 180) return NextResponse.json({ error: "Summary must be between 12 and 180 characters." }, { status: 400 })
        updates.summary = summary
      }
      if (typeof body.description === "string") updates.description = body.description.trim().slice(0, 1600)
      if (body.design_layout !== undefined) updates.design_layout = validateProfileLayout(body.design_layout)
      if (body.design_css !== undefined) updates.design_css = sanitizeProfileCustomCss(body.design_css)
      updates.status = "pending"
      updates.moderation_note = null
    }

    const { data: updated, error } = await supabase
      .from("profile_design_listings")
      .update(updates)
      .eq("id", listingId)
      .select("*")
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, listing: updated })
  } catch (error) {
    console.error("Profile design update error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update this design." }, { status: 500 })
  }
}

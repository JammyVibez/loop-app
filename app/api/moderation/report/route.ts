import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { contentId, contentType, reason, details } = body

    if (!contentId || !contentType || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Validate content type
    const validTypes = ["loop", "comment", "message", "profile"]
    if (!validTypes.includes(contentType)) {
      return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    // Validate reason
    const validReasons = [
      "spam", "harassment", "hate_speech", "violence",
      "nudity", "misinformation", "copyright", "self_harm", "other",
    ]
    if (!validReasons.includes(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 })
    }

    // Prevent self-reporting
    if (contentType === "profile" && contentId === user.id) {
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 })
    }

    const supabase = createServerClient()

    // Check for duplicate reports (same user, same content, within 24h)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: existingReport } = await supabase
      .from("content_reports")
      .select("id")
      .eq("reporter_id", user.id)
      .eq("content_id", contentId)
      .eq("content_type", contentType)
      .gte("created_at", oneDayAgo)
      .maybeSingle()

    if (existingReport) {
      return NextResponse.json({ error: "You've already reported this content" }, { status: 409 })
    }

    // Insert report
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      content_id: contentId,
      content_type: contentType,
      reason,
      details: details?.slice(0, 1000) || null,
      status: "pending",
    })

    if (error) {
      console.error("Report insert error:", error)
      return NextResponse.json({ error: "Failed to submit report" }, { status: 500 })
    }

    // Log to audit
    try {
      await supabase.from("security_audit_log").insert({
        user_id: user.id,
        action: "content_reported",
        details: JSON.stringify({ contentId, contentType, reason }),
      })
    } catch {
      // Non-critical
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Moderation report error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

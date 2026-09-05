import { type NextRequest, NextResponse } from "next/server"
import { communityClient, logCommunityActivity, canModerate, canAdmin } from "@/lib/community-engine"
import { getUserFromRequest } from "@/lib/server-auth"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const { data: membership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", user.id).maybeSingle()
    if (!canModerate(membership?.role)) return NextResponse.json({ error: "Moderator access required" }, { status: 403 })

    const [{ data: reports }, { data: log }, { data: pendingPosts }, { data: circleRow }] = await Promise.all([
      sb
        .from("community_reports")
        .select(`
          *,
          reporter:profiles!reporter_id(id, username, display_name, avatar_url),
          target_author:profiles!target_author_id(id, username, display_name, avatar_url)
        `)
        .eq("circle_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("community_moderation_logs")
        .select(`
          *,
          moderator:profiles!moderator_id(id, username, display_name, avatar_url),
          target:profiles!target_user_id(id, username, display_name, avatar_url)
        `)
        .eq("circle_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      sb
        .from("circle_posts")
        .select(`
          *,
          author:profiles!author_id(id, username, display_name, avatar_url, is_verified)
        `)
        .eq("circle_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(30),
      sb.from("circles").select("moderation_settings, settings").eq("id", id).maybeSingle(),
    ])

    return NextResponse.json({
      reports: reports || [],
      log: log || [],
      pending: pendingPosts || [],
      role: membership?.role || "member",
      settings: {
        moderation_settings: (circleRow as any)?.moderation_settings || {},
        settings: (circleRow as any)?.settings || {},
      },
    })
  } catch (e: any) {
    console.error("[moderation] GET error:", e)
    return NextResponse.json({ error: e.message || "Failed to load moderation" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const actor = await getUserFromRequest(request)
    if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const sb = communityClient()

    const body = await request.json()
    const { action } = body

    // Members can report content
    if (action === "report") {
      const { target_type, target_id, reason = "", details = "", target_author_id } = body
      if (!target_type || !target_id) return NextResponse.json({ error: "Missing report target" }, { status: 400 })
      const { data: report, error } = await sb
        .from("community_reports")
        .insert({
          circle_id: id,
          reporter_id: actor.id,
          target_type,
          target_id: String(target_id),
          target_author_id: target_author_id || null,
          reason: reason.slice(0, 200),
          details: details.slice(0, 1000),
        })
        .select()
        .single()
      if (error || !report) return NextResponse.json({ error: "Failed to submit report" }, { status: 500 })
      return NextResponse.json({ report }, { status: 201 })
    }

    // Everything below requires moderation
    const { data: membership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", actor.id).maybeSingle()
    if (!canModerate(membership?.role)) return NextResponse.json({ error: "Moderator access required" }, { status: 403 })

    if (action === "resolve_report") {
      const { report_id, resolution = "resolved" } = body
      const { error } = await sb
        .from("community_reports")
        .update({ status: resolution, resolved_by: actor.id, resolution: body.note || "", resolved_at: new Date().toISOString() })
        .eq("id", report_id)
        .eq("circle_id", id)
      if (error) return NextResponse.json({ error: "Failed to resolve report" }, { status: 500 })
      await logCommunityActivity(sb, id, actor.id, "report_resolved", "report", report_id)
      return NextResponse.json({ success: true })
    }

    if (action === "warn" || action === "mute" || action === "ban" || action === "unban") {
      const { user_id, reason = "", duration_hours } = body
      if (!user_id) return NextResponse.json({ error: "Missing member" }, { status: 400 })

      const { data: targetMembership } = await sb.from("circle_members").select("role").eq("circle_id", id).eq("user_id", user_id).maybeSingle()
      if (!targetMembership) return NextResponse.json({ error: "Member not found" }, { status: 404 })
      if (targetMembership.role === "owner") return NextResponse.json({ error: "You can't moderate the founder" }, { status: 403 })
      if (action === "ban" && !canAdmin(membership?.role)) return NextResponse.json({ error: "Only admins can ban" }, { status: 403 })

      const updates: Record<string, any> = { ban_reason: reason || null }
      if (action === "ban") {
        updates.status = "banned"
        updates.banned_until = duration_hours ? new Date(Date.now() + Number(duration_hours) * 3600000).toISOString() : null
      } else if (action === "unban") {
        updates.status = "active"
        updates.banned_until = null
      } else if (action === "mute") {
        updates.banned_until = duration_hours ? new Date(Date.now() + Number(duration_hours) * 3600000).toISOString() : null
      }

      const { error } = await sb.from("circle_members").update(updates).eq("circle_id", id).eq("user_id", user_id)
      if (error) return NextResponse.json({ error: "Failed to apply moderation action" }, { status: 500 })

      await sb.from("community_moderation_logs").insert({
        circle_id: id,
        moderator_id: actor.id,
        action,
        target_user_id: user_id,
        reason: reason.slice(0, 300),
        details: { duration_hours: duration_hours ? Number(duration_hours) : null },
      })
      await logCommunityActivity(sb, id, actor.id, `member_${action}`, "member", user_id, { reason })
      return NextResponse.json({ success: true })
    }

    if (action === "approve_post" || action === "reject_post") {
      const { post_id, reason = "" } = body
      if (!post_id) return NextResponse.json({ error: "Missing post" }, { status: 400 })
      const { data: post } = await sb
        .from("circle_posts")
        .select("author_id, content, status")
        .eq("id", post_id)
        .eq("circle_id", id)
        .maybeSingle()
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })

      if (action === "approve_post") {
        if (post.status !== "pending") return NextResponse.json({ error: "Post is not pending" }, { status: 400 })
        const { error: updErr } = await sb
          .from("circle_posts")
          .update({ status: "published", moderation_note: null })
          .eq("id", post_id)
          .eq("circle_id", id)
        if (updErr) return NextResponse.json({ error: "Failed to approve post" }, { status: 500 })
        await sb.rpc("increment_circle_post_count", { circle_id: id })
        await sb.rpc("increment_circle_contribution", { p_circle_id: id, p_user_id: post.author_id, p_amount: 5 })
        await sb.from("community_moderation_logs").insert({
          circle_id: id,
          moderator_id: actor.id,
          action: "approve_post",
          target_user_id: post.author_id,
          target_type: "post",
          target_id: String(post_id),
        })
        await logCommunityActivity(sb, id, actor.id, "post_approved", "post", post_id)
      } else {
        const { error: delErr } = await sb
          .from("circle_posts")
          .delete()
          .eq("id", post_id)
          .eq("circle_id", id)
        if (delErr) return NextResponse.json({ error: "Failed to remove post" }, { status: 500 })
        await sb.from("community_moderation_logs").insert({
          circle_id: id,
          moderator_id: actor.id,
          action: "reject_post",
          target_user_id: post.author_id,
          target_type: "post",
          target_id: String(post_id),
          reason: reason.slice(0, 300) || "Post rejected by moderator",
        })
        await logCommunityActivity(sb, id, actor.id, "post_rejected", "post", post_id)
      }
      return NextResponse.json({ success: true })
    }

    if (action === "remove_post") {
      const { post_id, reason = "" } = body
      if (!post_id) return NextResponse.json({ error: "Missing post" }, { status: 400 })
      const { data: post } = await sb.from("circle_posts").select("author_id").eq("id", post_id).eq("circle_id", id).maybeSingle()
      if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 })
      await sb.from("circle_posts").delete().eq("id", post_id).eq("circle_id", id)
      await sb.from("community_moderation_logs").insert({
        circle_id: id,
        moderator_id: actor.id,
        action: "remove_post",
        target_user_id: post.author_id,
        target_type: "post",
        target_id: String(post_id),
        reason: reason.slice(0, 300),
      })
      await logCommunityActivity(sb, id, actor.id, "post_removed", "post", post_id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    console.error("[moderation] POST error:", e)
    return NextResponse.json({ error: e.message || "Failed to run moderation action" }, { status: 500 })
  }
}
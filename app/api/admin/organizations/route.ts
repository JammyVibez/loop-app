import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { requireAdmin } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()

    // 1. Fetch org_follower_threshold setting
    const { data: settingRow } = await supabase
      .from("admin_settings")
      .select("setting_value")
      .eq("setting_key", "org_follower_threshold")
      .maybeSingle()

    const threshold = Number(settingRow?.setting_value) || 100

    // 2. Query profiles and count followers
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select(`
        id, username, display_name, avatar_url, email, is_verified, is_organization,
        organization_name, organization_badge_url, organization_config, created_at
      `)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. Count followers for profiles using follows table
    const { data: followsData } = await supabase.from("follows").select("following_id")

    const followerCounts: Record<string, number> = {}
    if (followsData) {
      followsData.forEach((f) => {
        if (f.following_id) {
          followerCounts[f.following_id] = (followerCounts[f.following_id] || 0) + 1
        }
      })
    }

    const profilesWithCounts = (profiles || []).map((p) => ({
      ...p,
      follower_count: followerCounts[p.id] || 0,
      organization_config: p.organization_config || {
        coin_rate_multiplier: 1.5,
        custom_boost_discount: 0.2,
        circle_perk_price: 50,
        exclusive_rewards_enabled: true,
      },
    }))

    // Candidate accounts: follower count >= (threshold * 0.5) OR is_organization is already true
    const candidates = profilesWithCounts
      .filter((p) => p.follower_count >= Math.floor(threshold * 0.5) && !p.is_organization)
      .sort((a, b) => b.follower_count - a.follower_count)

    const activeOrganizations = profilesWithCounts
      .filter((p) => p.is_organization)
      .sort((a, b) => b.follower_count - a.follower_count)

    return NextResponse.json({
      success: true,
      threshold,
      candidates,
      organizations: activeOrganizations,
      allProfiles: profilesWithCounts,
    })
  } catch (err: any) {
    console.error("GET /api/admin/organizations error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user: adminUser, response } = await requireAdmin(request)
    if (response) return response

    const supabase = createServerClient()
    const body = await request.json()
    const action = String(body.action || "")

    if (action === "update_threshold") {
      const newThreshold = Math.max(1, Number(body.threshold) || 100)
      // Check if setting exists, then insert or update
      const { data: existingThreshold } = await supabase
        .from("admin_settings")
        .select("setting_key")
        .eq("setting_key", "org_follower_threshold")
        .maybeSingle()

      if (existingThreshold) {
        await supabase.from("admin_settings")
          .update({ setting_value: String(newThreshold), updated_by: adminUser.id, updated_at: new Date().toISOString() })
          .eq("setting_key", "org_follower_threshold")
      } else {
        await supabase.from("admin_settings")
          .insert({ setting_key: "org_follower_threshold", setting_value: String(newThreshold), updated_by: adminUser.id, updated_at: new Date().toISOString() })
      }
      return NextResponse.json({ success: true, threshold: newThreshold, message: "Follower threshold updated" })
    }

    if (action === "upgrade_organization") {
      const targetUserId = body.user_id as string
      if (!targetUserId) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 })
      }

      const { data: targetProfile } = await supabase.from("profiles").select("*").eq("id", targetUserId).single()
      if (!targetProfile) {
        return NextResponse.json({ error: "Target user profile not found" }, { status: 404 })
      }

      const defaultConfig = {
        coin_rate_multiplier: 1.5,
        custom_boost_discount: 0.2,
        circle_perk_price: 50,
        exclusive_rewards_enabled: true,
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          is_organization: true,
          organization_name: body.organization_name || targetProfile.display_name || targetProfile.username,
          organization_config: body.organization_config || defaultConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Notify user of upgrade
      await supabase.from("notifications").insert({
        user_id: targetUserId,
        type: "organization_upgrade",
        title: "Upgraded to Official Organization Status! 🎉",
        message: "Your account has been granted official Organization status with custom event hosting, coin rate multipliers, and branded perks.",
        data: { action: "upgrade_organization" },
        actor_id: adminUser.id,
      })

      return NextResponse.json({
        success: true,
        user: updated,
        message: `Successfully upgraded ${targetProfile.username} to Organization status!`,
      })
    }

    if (action === "revoke_organization") {
      const targetUserId = body.user_id as string
      if (!targetUserId) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 })
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          is_organization: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        user: updated,
        message: "Organization status revoked.",
      })
    }

    if (action === "update_config") {
      const targetUserId = body.user_id as string
      if (!targetUserId) {
        return NextResponse.json({ error: "user_id is required" }, { status: 400 })
      }

      const newConfig = {
        coin_rate_multiplier: Number(body.coin_rate_multiplier) || 1.5,
        custom_boost_discount: Number(body.custom_boost_discount) || 0.2,
        circle_perk_price: Number(body.circle_perk_price) || 50,
        exclusive_rewards_enabled: Boolean(body.exclusive_rewards_enabled),
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          organization_name: body.organization_name ? String(body.organization_name).trim() : undefined,
          organization_config: newConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        user: updated,
        message: "Organization configuration saved.",
      })
    }

    if (action === "upload_badge") {
      const targetUserId = body.user_id as string
      const badgeDataUri = body.badge_data_uri as string // PNG base64 data URI or image URL
      if (!targetUserId || !badgeDataUri) {
        return NextResponse.json({ error: "user_id and badge_data_uri are required" }, { status: 400 })
      }

      // 1. Validate file type: PNG required
      if (!badgeDataUri.startsWith("data:image/png") && !badgeDataUri.toLowerCase().endsWith(".png") && !badgeDataUri.startsWith("http")) {
        return NextResponse.json({ error: "Custom verification badge must be a PNG image file (image/png)" }, { status: 400 })
      }

      // 2. Validate file size: Max 1MB (1,048,576 bytes)
      if (badgeDataUri.startsWith("data:")) {
        const base64Length = badgeDataUri.split(",")[1]?.length || 0
        const estimatedBytes = Math.round((base64Length * 3) / 4)
        if (estimatedBytes > 1024 * 1024) {
          return NextResponse.json({ error: "Custom badge PNG image must be under 1MB" }, { status: 400 })
        }
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          organization_badge_url: badgeDataUri,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        badge_url: badgeDataUri,
        user: updated,
        message: "Custom PNG verification badge uploaded & assigned successfully!",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    console.error("POST /api/admin/organizations error:", err)
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

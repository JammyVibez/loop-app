import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { getUserFromRequest } from "@/lib/server-auth"

export const dynamic = "force-dynamic"

const DEFAULT_ORG_CONFIG = {
  coin_rate_multiplier: 1.5,
  custom_boost_discount: 0.2,
  circle_perk_price: 50,
  exclusive_rewards_enabled: true,
}

async function loadOrgContext(userId: string) {
  const supabase = createServerClient()

  const { data: settingRow } = await supabase
    .from("admin_settings")
    .select("setting_value")
    .eq("setting_key", "org_follower_threshold")
    .maybeSingle()

  const threshold = Math.max(1, Number(settingRow?.setting_value) || 100)

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, video_avatar_url, is_verified, is_organization, organization_name, organization_badge_url, organization_config, followers_count, created_at",
    )
    .eq("id", userId)
    .maybeSingle()

  // Follower count: authoritative count from the follows table
  const { count } = await supabase
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", userId)

  const followerCount = count ?? profile?.followers_count ?? 0

  return {
    profile,
    threshold,
    followerCount,
    config: profile?.organization_config || DEFAULT_ORG_CONFIG,
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { profile, threshold, followerCount, config } = await loadOrgContext(user.id)

    return NextResponse.json({
      success: true,
      threshold,
      follower_count: followerCount,
      eligible: followerCount >= threshold,
      is_organization: Boolean(profile?.is_organization),
      organization_name: profile?.organization_name || profile?.display_name || profile?.username || null,
      organization_badge_url: profile?.organization_badge_url || null,
      organization_config: config,
      profile: profile || null,
    })
  } catch (err: any) {
    console.error("GET /api/organizations/upgrade error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = String(body.action || "enable")
    const supabase = createServerClient()

    if (action === "enable") {
      const { profile, threshold, followerCount } = await loadOrgContext(user.id)

      if (profile?.is_organization) {
        return NextResponse.json({ success: true, is_organization: true, message: "Already an organization account" })
      }

      if (followerCount < threshold) {
        return NextResponse.json(
          {
            error: `Organization status unlocks at ${threshold} followers. You currently have ${followerCount}.`,
          },
          { status: 403 },
        )
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          is_organization: true,
          organization_name: body.organization_name
            ? String(body.organization_name).trim()
            : profile?.display_name || profile?.username,
          organization_config: DEFAULT_ORG_CONFIG,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "organization_upgrade",
        title: "You're now an Organization! 🏢",
        message: "Your account is now an Official Organization with boosted coin rates, custom perks, and event hosting.",
        data: { action: "organization_upgrade" },
      })

      return NextResponse.json({
        success: true,
        is_organization: true,
        user: updated,
        message: "Organization mode enabled! Your account now earns boosted perks.",
      })
    }

    if (action === "disable") {
      const { profile } = await loadOrgContext(user.id)
      if (!profile?.is_organization) {
        return NextResponse.json({ success: true, is_organization: false, message: "Organization mode is already off" })
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({ is_organization: false, updated_at: new Date().toISOString() })
        .eq("id", user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        is_organization: false,
        user: updated,
        message: "Organization mode disabled. You can re-enable anytime while above the follower threshold.",
      })
    }

    if (action === "update_config") {
      const { profile } = await loadOrgContext(user.id)
      if (!profile?.is_organization) {
        return NextResponse.json({ error: "Organization mode is not enabled" }, { status: 403 })
      }

      const current = profile?.organization_config || DEFAULT_ORG_CONFIG
      const nextConfig = {
        coin_rate_multiplier: Number(body.coin_rate_multiplier ?? current.coin_rate_multiplier) || 1.5,
        custom_boost_discount: Number(body.custom_boost_discount ?? current.custom_boost_discount) || 0.2,
        circle_perk_price: Number(body.circle_perk_price ?? current.circle_perk_price) || 50,
        exclusive_rewards_enabled: body.exclusive_rewards_enabled !== undefined
          ? Boolean(body.exclusive_rewards_enabled)
          : Boolean(current.exclusive_rewards_enabled),
      }

      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          organization_name: body.organization_name ? String(body.organization_name).trim() : undefined,
          organization_config: nextConfig,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        organization_config: nextConfig,
        user: updated,
        message: "Organization perks updated.",
      })
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: any) {
    console.error("POST /api/organizations/upgrade error:", err)
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 })
  }
}

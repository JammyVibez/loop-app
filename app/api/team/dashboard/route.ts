import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

const SECTION_META: Record<string, { label: string; description: string; icon: string }> = {
  moderation: { label: "Content Moderation", description: "Review reports, approve/reject content, manage flagged items", icon: "Shield" },
  gifs_emojis: { label: "GIF & Emoji Management", description: "Upload and manage GIFs, custom emojis, and stickers", icon: "Image" },
  ads: { label: "Ad Management", description: "Create and manage advertisements across the platform", icon: "Megaphone" },
  events: { label: "Event Management", description: "Create and manage community events", icon: "Calendar" },
  support: { label: "Support & Tickets", description: "Handle support tickets, ban appeals, and user inquiries", icon: "Headphones" },
  analytics: { label: "Analytics", description: "View app analytics, user metrics, and growth data", icon: "BarChart3" },
  economy: { label: "Economy Control", description: "Manage loop coins, withdrawals, rewards, and economy settings", icon: "Coins" },
  pro_lounge: { label: "Pro Lounge", description: "Manage premium features, pro circles, and subscriptions", icon: "Crown" },
  organizations: { label: "Organizations", description: "Manage organization profiles and badges", icon: "Building2" },
  featured: { label: "Featured Content", description: "Feature and curate posts and creators on the platform", icon: "Star" },
  broadcast: { label: "Broadcast", description: "Send broadcast messages and announcements to users", icon: "Radio" },
  verification: { label: "Verification", description: "Manage verification badge applications and approvals", icon: "BadgeCheck" },
  awards: { label: "Awards", description: "Manage awards, recognition, and achievement systems", icon: "Trophy" },
  coloop_sessions: { label: "Co-Loop Sessions", description: "Monitor and manage co-loop sessions", icon: "Users" },
  account_management: { label: "Account Management", description: "Manage user accounts and moderation actions", icon: "UserCog" },
  health: { label: "System Health", description: "View system health, uptime, and infrastructure status", icon: "Activity" },
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: authData, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !authData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Verify team member
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_team_member, is_admin, username, display_name")
      .eq("id", authData.user.id)
      .single()

    if (!profile?.is_team_member && !profile?.is_admin) {
      return NextResponse.json({ error: "Team access required" }, { status: 403 })
    }

    // Admins get all permissions
    if (profile?.is_admin) {
      const allSections = Object.entries(SECTION_META).map(([key, meta]) => ({
        key,
        ...meta,
        granted: true,
      }))
      return NextResponse.json({
        is_admin: true,
        sections: allSections,
        user: { username: profile.username, display_name: profile.display_name },
      })
    }

    // Get team member's permissions
    const { data: perms } = await supabase
      .from("team_permissions")
      .select("permission_key")
      .eq("user_id", authData.user.id)

    const grantedKeys = new Set((perms || []).map(p => p.permission_key))

    const sections = Object.entries(SECTION_META).map(([key, meta]) => ({
      key,
      ...meta,
      granted: grantedKeys.has(key),
    }))

    const grantedSections = sections.filter(s => s.granted)

    return NextResponse.json({
      is_admin: false,
      sections: grantedSections,
      all_sections: sections,
      user: { username: profile.username, display_name: profile.display_name },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
  }
}

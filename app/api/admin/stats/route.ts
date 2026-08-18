import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireAdmin } from "@/lib/server-auth";

export async function GET(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;
    const supabase = createServerClient();

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartISO = weekStart.toISOString();

    // Run all counts in parallel for speed
    const [
      totalUsers,
      activeUsers7d,
      activeUsers30d,
      inactiveUsers30d,
      premiumUsers,
      verifiedUsers,
      adminUsers,
      bannedUsers,
      recentSignups7d,
      recentSignups30d,
      earlyUsers,
      totalLoops,
      loops7d,
      totalComments,
      comments7d,
      totalLikes,
      totalCircles,
      circleMembers,
      activeCoLoops,
      publishedCoLoops,
      totalDuels,
      activeDuels,
      totalPolls,
      totalMoments,
      activeMoments,
      totalGifts,
      giftsToday,
      totalMessages,
      messages7d,
      totalFollows,
      weeklyBonusClaimed,
      coinsData,
      totalShopPurchases,
      revenueData,
      totalNotifications,
      livestreamsActive,
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("last_active", sevenDaysAgo),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("last_active", thirtyDaysAgo),
      supabase.from("profiles").select("*", { count: "exact", head: true }).or(`last_active.lt.${thirtyDaysAgo},last_active.is.null`),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_premium", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_verified", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_admin", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_banned", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
      supabase.from("profiles").select("id, username, display_name, avatar_url, created_at, is_premium, is_verified").order("created_at", { ascending: true }).limit(100),
      supabase.from("loops").select("*", { count: "exact", head: true }),
      supabase.from("loops").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("comments").select("*", { count: "exact", head: true }),
      supabase.from("comments").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("likes").select("*", { count: "exact", head: true }),
      supabase.from("circles").select("*", { count: "exact", head: true }),
      supabase.from("circle_members").select("*", { count: "exact", head: true }),
      supabase.from("co_loop_sessions").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("co_loop_sessions").select("*", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("duels").select("*", { count: "exact", head: true }),
      supabase.from("duels").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("polls").select("*", { count: "exact", head: true }),
      supabase.from("moments").select("*", { count: "exact", head: true }),
      supabase.from("moments").select("*", { count: "exact", head: true }).gte("expires_at", now.toISOString()),
      supabase.from("gifts").select("*", { count: "exact", head: true }),
      supabase.from("gifts").select("*", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("messages").select("*", { count: "exact", head: true }),
      supabase.from("messages").select("*", { count: "exact", head: true }).gte("created_at", sevenDaysAgo),
      supabase.from("follows").select("*", { count: "exact", head: true }),
      supabase.from("weekly_bonus_claims").select("*", { count: "exact", head: true }).gte("claimed_at", weekStartISO),
      supabase.from("coin_transactions").select("amount").in("transaction_type", ["weekly_bonus", "quest_reward", "admin_grant"]),
      supabase.from("shop_purchases").select("*", { count: "exact", head: true }),
      supabase.from("shop_purchases").select("amount").gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
      supabase.from("notifications").select("*", { count: "exact", head: true }),
      supabase.from("live_streams").select("*", { count: "exact", head: true }).eq("is_live", true),
    ]);

    const totalCoinsDistributed =
      (coinsData?.data || []).reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);

    const revenueThisMonth =
      (revenueData?.data || []).reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

    const stats = {
      total_users: totalUsers?.count || 0,
      active_users_7d: activeUsers7d?.count || 0,
      active_users_30d: activeUsers30d?.count || 0,
      inactive_users_30d: inactiveUsers30d?.count || 0,
      premium_users: premiumUsers?.count || 0,
      verified_users: verifiedUsers?.count || 0,
      admin_users: adminUsers?.count || 0,
      banned_users: bannedUsers?.count || 0,
      recent_signups_7d: recentSignups7d?.count || 0,
      recent_signups_30d: recentSignups30d?.count || 0,
      total_loops: totalLoops?.count || 0,
      loops_this_week: loops7d?.count || 0,
      total_comments: totalComments?.count || 0,
      comments_this_week: comments7d?.count || 0,
      total_likes: totalLikes?.count || 0,
      total_circles: totalCircles?.count || 0,
      total_circle_members: circleMembers?.count || 0,
      active_co_loops: activeCoLoops?.count || 0,
      published_co_loops: publishedCoLoops?.count || 0,
      total_duels: totalDuels?.count || 0,
      active_duels: activeDuels?.count || 0,
      total_polls: totalPolls?.count || 0,
      total_moments: totalMoments?.count || 0,
      active_moments: activeMoments?.count || 0,
      total_gifts: totalGifts?.count || 0,
      gifts_today: giftsToday?.count || 0,
      total_messages: totalMessages?.count || 0,
      messages_this_week: messages7d?.count || 0,
      total_follows: totalFollows?.count || 0,
      weekly_bonus_claimed: weeklyBonusClaimed?.count || 0,
      total_coins_distributed: totalCoinsDistributed,
      total_shop_purchases: totalShopPurchases?.count || 0,
      revenue_this_month: revenueThisMonth,
      total_notifications: totalNotifications?.count || 0,
      livestreams_active: livestreamsActive?.count || 0,
      early_users: earlyUsers?.data || [],
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed to fetch statistics" }, { status: 500 });
  }
}

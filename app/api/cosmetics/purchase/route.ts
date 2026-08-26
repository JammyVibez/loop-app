import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getUserFromRequest } from "@/lib/server-auth";


/** POST /api/cosmetics/purchase — Purchase a cosmetic item */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Get item details
    const { data: item, error: itemError } = await supabase
      .from("cosmetics_catalog")
      .select("*")
      .eq("id", itemId)
      .eq("is_active", true)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check if pro-only
    if (item.is_premium_only) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_premium")
        .eq("id", user.id)
        .single();

      if (!profile?.is_premium) {
        return NextResponse.json(
          { error: "This item requires Pro membership" },
          { status: 403 }
        );
      }
    }

    // Check if already owned
    const { data: existing } = await supabase
      .from("user_cosmetics_inventory")
      .select("id")
      .eq("user_id", user.id)
      .eq("item_id", itemId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already owned" }, { status: 400 });
    }

    // Check coins
    const { data: profile } = await supabase
      .from("profiles")
      .select("loop_coins")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.loop_coins || 0) < item.price_coins) {
      return NextResponse.json(
        { error: "Insufficient Loop Coins" },
        { status: 400 }
      );
    }

    // Deduct coins and add to inventory
    const { error: deductError } = await supabase
      .from("profiles")
      .update({ loop_coins: (profile.loop_coins || 0) - item.price_coins })
      .eq("id", user.id);

    if (deductError) {
      return NextResponse.json({ error: "Failed to deduct coins" }, { status: 500 });
    }

    const { error: inventoryError } = await supabase
      .from("user_cosmetics_inventory")
      .insert({
        user_id: user.id,
        item_id: itemId,
        acquired_via: "purchase",
        quantity: 1,
      });

    if (inventoryError) {
      // Rollback coins on failure
      await supabase
        .from("profiles")
        .update({ loop_coins: profile.loop_coins })
        .eq("id", user.id);

      return NextResponse.json({ error: "Failed to add to inventory" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Purchased ${item.name}!`,
      remainingCoins: (profile.loop_coins || 0) - item.price_coins,
    });
  } catch (error: any) {
    console.error("Cosmetics purchase error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

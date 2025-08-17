import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Get user from session instead of auth header
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount } = body;

    // Handle onboarding bonus
    if (type === "onboarding_bonus") {
      const bonusAmount = amount || 100;

      // First, fetch the current loop_coins
      const { data: profile, error: fetchError } = await supabase
        .from("profiles")
        .select("loop_coins")
        .eq("id", user.id)
        .single();

      if (fetchError) {
        return NextResponse.json(
          { error: fetchError.message },
          { status: 400 },
        );
      }

      // Calculate new loop_coins
      const currentCoins = profile.loop_coins || 0;
      const newCoins = currentCoins + bonusAmount;

      // Update user's coins
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ loop_coins: newCoins })
        .eq("id", user.id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 400 },
        );
      }

      // Record transaction
      await supabase.from("coin_transactions").insert({
        user_id: user.id,
        amount: bonusAmount,
        transaction_type: "onboarding_bonus",
        description: "Onboarding completion bonus",
      });

      return NextResponse.json({
        success: true,
        bonus_amount: bonusAmount,
        message: `Onboarding bonus of ${bonusAmount} Loop Coins awarded!`,
      });
    }

    // Handle weekly bonus
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const { data: existingClaim } = await supabase
      .from("weekly_bonus_claims")
      .select("*")
      .eq("user_id", user.id)
      .gte("claimed_at", startOfWeek.toISOString())
      .single();

    if (existingClaim) {
      return NextResponse.json(
        {
          error: "Weekly bonus already claimed this week",
          next_available: new Date(
            startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
        { status: 400 },
      );
    }

    const weeklyAmount = 500;

    // Update user's coins
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        loop_coins: (currentCoins || 0) + weeklyAmount, // Assume you have currentCoins from their profile
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error awarding weekly bonus:", updateError);
      return NextResponse.json(
        { error: "Failed to award weekly bonus" },
        { status: 500 },
      );
    }

    // Record the claim
    await supabase.from("weekly_bonus_claims").insert({
      user_id: user.id,
      bonus_amount: weeklyAmount,
    });

    // Record transaction
    await supabase.from("coin_transactions").insert({
      user_id: user.id,
      amount: weeklyAmount,
      transaction_type: "weekly_bonus",
      description: "Weekly bonus coins",
    });

    return NextResponse.json({
      success: true,
      bonus_amount: weeklyAmount,
      message: "Weekly bonus of 500 Loop Coins awarded!",
    });
  } catch (error) {
    console.error("Error processing coins request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

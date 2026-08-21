import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCatalog, getUserCosmeticsBundle, type CosmeticCategory } from "@/lib/cosmetics-system";

async function getUserFromToken(token: string) {
  const supabase = createServerClient();
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/** GET /api/cosmetics — Returns the catalog + user's inventory + equipped items */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as CosmeticCategory | null;
    const userId = searchParams.get("userId");

    // Get catalog (public)
    const catalog = await getCatalog(category || undefined);

    // If authenticated, also return their inventory + equipped
    let userBundle = null;
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const user = await getUserFromToken(token);
      if (user) {
        userBundle = await getUserCosmeticsBundle(user.id);
      }
    }

    // If requesting specific user's equipped items (for display)
    let targetEquipped = null;
    if (userId) {
      const supabase = createServerClient();
      const { data } = await supabase
        .from("user_cosmetics_equipped")
        .select("category, item:cosmetics_catalog(*)")
        .eq("user_id", userId);
      if (data) {
        targetEquipped = data.reduce((acc: Record<string, any>, row: any) => {
          acc[row.category] = row.item || null;
          return acc;
        }, {});
      }
    }

    return NextResponse.json({
      success: true,
      catalog,
      user: userBundle,
      targetEquipped,
    });
  } catch (error: any) {
    console.error("Cosmetics GET error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

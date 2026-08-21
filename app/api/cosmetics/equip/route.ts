import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { equipCosmetic, grantCosmetic, removeCosmetic, type CosmeticCategory } from "@/lib/cosmetics-system";

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

/** POST /api/cosmetics/equip — Equip or unequip a cosmetic item */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    const user = await getUserFromToken(token);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const body = await request.json();
    const { action, category, itemId } = body as {
      action: "equip" | "unequip" | "grant" | "remove";
      category?: CosmeticCategory;
      itemId?: string;
    };

    switch (action) {
      case "equip": {
        if (!category) {
          return NextResponse.json({ error: "Category is required" }, { status: 400 });
        }
        const result = await equipCosmetic(user.id, category, itemId || null);
        return NextResponse.json(result);
      }

      case "unequip": {
        if (!category) {
          return NextResponse.json({ error: "Category is required" }, { status: 400 });
        }
        const result = await equipCosmetic(user.id, category, null);
        return NextResponse.json(result);
      }

      case "grant": {
        // Admin only
        const supabase = createServerClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        if (!profile?.is_admin) {
          return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        const targetUserId = body.targetUserId;
        if (!targetUserId || !itemId) {
          return NextResponse.json({ error: "targetUserId and itemId required" }, { status: 400 });
        }
        const result = await grantCosmetic(targetUserId, itemId, "admin_grant");
        return NextResponse.json(result);
      }

      case "remove": {
        if (!itemId) {
          return NextResponse.json({ error: "itemId is required" }, { status: 400 });
        }
        const result = await removeCosmetic(user.id, itemId);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Cosmetics equip error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

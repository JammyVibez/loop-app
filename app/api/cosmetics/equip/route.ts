import { type NextRequest, NextResponse } from "next/server";
import { withUser } from "@/lib/api-handler";
import { equipCosmetic, grantCosmetic, removeCosmetic, type CosmeticCategory } from "@/lib/cosmetics-system";


/** POST /api/cosmetics/equip — Equip or unequip a cosmetic item */
export const POST = withUser(async (request, { user, supabase }) => {
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
});

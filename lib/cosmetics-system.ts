/**
 * Cosmetics System — Server-side module
 * Handles all cosmetics catalog, inventory, and equipped items operations
 */

import { createServerClient } from "@/lib/supabase";

export type CosmeticCategory =
  | "profile_decoration"
  | "profile_effect"
  | "post_decoration"
  | "post_effect"
  | "nameplate"
  | "display_name_theme";

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  category: CosmeticCategory;
  item_type: string;
  rarity: string;
  price_coins: number;
  price_premium: boolean;
  preview_url: string | null;
  asset_url: string | null;
  thumbnail_url: string | null;
  icon_url: string | null;
  color: string | null;
  glow_color: string | null;
  is_active: boolean;
  is_seasonal: boolean;
  is_premium_only: boolean;
  item_data: Record<string, any>;
  sort_order: number;
}

export interface UserInventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  acquired_via: string;
  quantity: number;
  item?: CatalogItem;
}

export interface EquippedItem {
  id: string;
  user_id: string;
  category: CosmeticCategory;
  item_id: string | null;
  equipped_at: string;
  item?: CatalogItem | null;
}

export interface VideoMediaItem {
  id: string;
  user_id: string;
  media_type: "avatar" | "cover";
  file_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  is_active: boolean;
  created_at: string;
}

/**
 * Get all active catalog items, optionally filtered by category
 */
export async function getCatalog(category?: CosmeticCategory): Promise<CatalogItem[]> {
  const supabase = createServerClient();
  let query = supabase
    .from("cosmetics_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("price_coins", { ascending: true });

  if (category) {
    query = query.eq("category", category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as CatalogItem[]) || [];
}

/**
 * Get a user's full cosmetics bundle: inventory + equipped items + video media
 */
export async function getUserCosmeticsBundle(userId: string) {
  const supabase = createServerClient();

  const [inventoryResult, equippedResult, videoResult] = await Promise.all([
    supabase
      .from("user_cosmetics_inventory")
      .select("*, item:cosmetics_catalog(*)")
      .eq("user_id", userId),
    supabase
      .from("user_cosmetics_equipped")
      .select("*, item:cosmetics_catalog(*)")
      .eq("user_id", userId),
    supabase
      .from("video_media")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  return {
    inventory: (inventoryResult.data as UserInventoryItem[]) || [],
    equipped: (equippedResult.data as EquippedItem[]) || [],
    videoMedia: (videoResult.data as VideoMediaItem[]) || [],
  };
}

/**
 * Get a user's currently equipped cosmetics (for rendering their avatar/posts)
 */
export async function getUserEquipped(userId: string): Promise<Record<CosmeticCategory, CatalogItem | null>> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("user_cosmetics_equipped")
    .select("category, item:cosmetics_catalog(*)")
    .eq("user_id", userId);

  if (error) throw error;

  const equipped: Record<string, CatalogItem | null> = {};
  for (const row of data || []) {
    const r = row as any;
    equipped[r.category] = r.item || null;
  }

  return equipped as Record<CosmeticCategory, CatalogItem | null>;
}

/**
 * Equip a cosmetic item (validates ownership first)
 */
export async function equipCosmetic(userId: string, category: CosmeticCategory, itemId: string | null) {
  const supabase = createServerClient();

  // If unsetting, just delete the equipped entry
  if (!itemId) {
    const { error } = await supabase
      .from("user_cosmetics_equipped")
      .delete()
      .eq("user_id", userId)
      .eq("category", category);
    if (error) throw error;
    return { success: true };
  }

  // Validate the user owns this item
  const { data: ownership, error: ownershipError } = await supabase
    .from("user_cosmetics_inventory")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .single();

  if (ownershipError || !ownership) {
    throw new Error("You don't own this cosmetic item");
  }

  // Upsert the equipped record
  const { error } = await supabase
    .from("user_cosmetics_equipped")
    .upsert(
      { user_id: userId, category, item_id: itemId, equipped_at: new Date().toISOString() },
      { onConflict: "user_id,category" }
    );

  if (error) throw error;
  return { success: true };
}

/**
 * Check if a user is premium (for video media access)
 */
export async function isUserPremium(userId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .single();
  return data?.is_premium ?? false;
}

/**
 * Grant a cosmetic item to a user
 */
export async function grantCosmetic(userId: string, itemId: string, via = "admin_grant") {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("user_cosmetics_inventory")
    .upsert(
      { user_id: userId, item_id: itemId, acquired_via: via, acquired_at: new Date().toISOString() },
      { onConflict: "user_id,item_id" }
    );
  if (error) throw error;
  return { success: true };
}

/**
 * Remove a cosmetic item from a user's inventory
 */
export async function removeCosmetic(userId: string, itemId: string) {
  const supabase = createServerClient();

  // Also unequip it if currently equipped
  await supabase
    .from("user_cosmetics_equipped")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  const { error } = await supabase
    .from("user_cosmetics_inventory")
    .delete()
    .eq("user_id", userId)
    .eq("item_id", itemId);

  if (error) throw error;
  return { success: true };
}

/**
 * Create a video media record
 */
export async function createVideoMedia(
  userId: string,
  mediaType: "avatar" | "cover",
  fileUrl: string,
  metadata: Partial<VideoMediaItem> = {}
) {
  const supabase = createServerClient();

  // Deactivate previous media of same type
  await supabase
    .from("video_media")
    .update({ is_active: false })
    .eq("user_id", userId)
    .eq("media_type", mediaType);

  const { data, error } = await supabase
    .from("video_media")
    .insert({
      user_id: userId,
      media_type: mediaType,
      file_url: fileUrl,
      thumbnail_url: metadata.thumbnail_url || null,
      duration_seconds: metadata.duration_seconds || null,
      file_size_bytes: metadata.file_size_bytes || null,
      mime_type: metadata.mime_type || "video/mp4",
      width: metadata.width || null,
      height: metadata.height || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  // Update profile with video URL
  const profileField = mediaType === "avatar" ? "video_avatar_url" : "video_cover_url";
  const mediaField = mediaType === "avatar" ? "avatar_media_id" : "cover_media_id";
  await supabase
    .from("profiles")
    .update({
      [profileField]: fileUrl,
      [mediaField]: data.id,
    })
    .eq("id", userId);

  return data as VideoMediaItem;
}

/**
 * Delete a video media record and clear from profile
 */
export async function deleteVideoMedia(userId: string, mediaType: "avatar" | "cover") {
  const supabase = createServerClient();

  const { data: media } = await supabase
    .from("video_media")
    .select("id")
    .eq("user_id", userId)
    .eq("media_type", mediaType)
    .eq("is_active", true)
    .single();

  if (media) {
    await supabase.from("video_media").delete().eq("id", media.id);
  }

  const profileField = mediaType === "avatar" ? "video_avatar_url" : "video_cover_url";
  const mediaField = mediaType === "avatar" ? "avatar_media_id" : "cover_media_id";
  await supabase
    .from("profiles")
    .update({ [profileField]: null, [mediaField]: null })
    .eq("id", userId);

  return { success: true };
}

import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createVideoMedia, deleteVideoMedia, isUserPremium } from "@/lib/cosmetics-system";
import { getUserFromRequest } from "@/lib/server-auth";


/**
 * POST /api/cosmetics/video-media — Upload a video avatar or cover photo
 * Pro-only feature. Uploads to Supabase Storage.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Pro-only check
    const premium = await isUserPremium(user.id);
    if (!premium) {
      return NextResponse.json(
        { error: "Video media is a Pro feature. Upgrade to use animated avatars and covers." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mediaType = formData.get("mediaType") as "avatar" | "cover" | null;

    if (!file || !mediaType) {
      return NextResponse.json({ error: "file and mediaType are required" }, { status: 400 });
    }

    if (!["avatar", "cover"].includes(mediaType)) {
      return NextResponse.json({ error: "mediaType must be 'avatar' or 'cover'" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use MP4, WebM, QuickTime, GIF, or WebP." },
        { status: 400 }
      );
    }

    // Max file size: 15MB for video, 5MB for GIF
    const maxSize = file.type.startsWith("video/") ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum ${file.type.startsWith("video/") ? "15MB" : "5MB"}.` },
        { status: 400 }
      );
    }

    // Upload to Supabase Storage
    const supabase = createServerClient();
    const ext = file.name.split(".").pop() || "mp4";
    const path = `${user.id}/${mediaType}-${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("cosmetics")
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes("Bucket not found")) {
        await supabase.storage.createBucket("cosmetics", { public: true });
        const { error: retryError } = await supabase.storage
          .from("cosmetics")
          .upload(path, buffer, {
            contentType: file.type,
            upsert: false,
          });
        if (retryError) throw retryError;
      } else {
        throw uploadError;
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("cosmetics")
      .getPublicUrl(path);

    const fileUrl = urlData.publicUrl;

    // Create video media record
    const mediaRecord = await createVideoMedia(user.id, mediaType, fileUrl, {
      file_size_bytes: file.size,
      mime_type: file.type,
    });

    return NextResponse.json({
      success: true,
      media: mediaRecord,
      url: fileUrl,
    });
  } catch (error: any) {
    console.error("Video media upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cosmetics/video-media — Remove video avatar/cover
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mediaType = searchParams.get("mediaType") as "avatar" | "cover" | null;
    if (!mediaType || !["avatar", "cover"].includes(mediaType)) {
      return NextResponse.json({ error: "mediaType query param required" }, { status: 400 });
    }

    await deleteVideoMedia(user.id, mediaType);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Video media delete error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Delete failed" },
      { status: 500 }
    );
  }
}

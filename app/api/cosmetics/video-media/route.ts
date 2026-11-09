import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { createVideoMedia, deleteVideoMedia, isUserPremium } from "@/lib/cosmetics-system";
import { getUserFromRequest } from "@/lib/server-auth";
import { getMediaPolicy } from "@/lib/media/policy";
import { UploadError, resolveUploadActor, saveUpload } from "@/lib/media/upload-service";

/**
 * POST /api/cosmetics/video-media — Upload a video avatar or cover photo
 * Pro-only feature. Stored by the shared VPS media service, like every other
 * upload, so the same limits/processing/validation apply.
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

    const supabase = createServerClient();
    const actor = await resolveUploadActor(user.id, supabase);
    const policy = await getMediaPolicy(supabase)

    const uploaded = await saveUpload({
      actor,
      policy,
      body: file.stream() as unknown as ReadableStream<Uint8Array>,
      contentLength: file.size,
      declaredFamily: file.type.startsWith("video/") ? "video" : "image",
      folder: "cosmetics",
      purpose: `${mediaType}-video`,
      originalFilename: file.name,
      mimeHint: file.type,
      supabase,
    })

    const fileUrl = uploaded.url

    // Create video media record
    const mediaRecord = await createVideoMedia(user.id, mediaType, fileUrl, {
      file_size_bytes: uploaded.size,
      mime_type: uploaded.mime,
    });

    return NextResponse.json({
      success: true,
      media: mediaRecord,
      url: fileUrl,
      // Video is transcoded in the background; the client waits for `ready`
      // before pointing the preview at the (not yet existing) MP4.
      status: uploaded.status,
      id: uploaded.id,
      poster_url: uploaded.poster_url,
    });
  } catch (error: any) {
    if (error instanceof UploadError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status })
    }
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

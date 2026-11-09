import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/**
 * Processing status for uploaded media.
 *
 * Videos are playable only after their background transcode finishes, so the
 * composer and the post player poll this until `status` flips to `ready`.
 * Media is public content (served by Nginx), so no session is required — but
 * only the fields needed to render a placeholder are exposed.
 */
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 50)

  if (!ids.length) return NextResponse.json({ success: true, items: [] })

  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from("media_uploads")
      .select("id, public_url, cloudinary_url, thumb_url, poster_url, processing_status, processing_error, media_type, duration, width, height")
      .in("id", ids)

    if (error) {
      return NextResponse.json({ success: true, items: [] })
    }

    return NextResponse.json({
      success: true,
      items: (data || []).map((row: any) => ({
        id: row.id,
        url: row.public_url || row.cloudinary_url,
        thumb_url: row.thumb_url || row.poster_url || null,
        poster_url: row.poster_url || null,
        status: row.processing_status || "ready",
        error: row.processing_error || null,
        media_type: row.media_type,
        duration: row.duration,
        width: row.width,
        height: row.height,
      })),
    })
  } catch (error) {
    console.error("[media] status lookup failed:", error)
    return NextResponse.json({ success: true, items: [] })
  }
}

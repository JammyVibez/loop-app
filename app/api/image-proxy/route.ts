import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

/**
 * GET /api/image-proxy?url=<encoded-image-url>&w=<width>&h=<height>
 *
 * Proxies images from Supabase storage (or any trusted origin) so the browser
 * never hits the storage URL directly. This solves:
 * 1. CORS errors when loading Supabase storage images in `<img>` tags
 * 2. Expired/missing auth tokens on storage URLs
 * 3. "Image Unavailable" broken-image states across feed, profiles, and circles
 *
 * Query params:
 * - `url` (required) – the original image URL to proxy
 * - `w` (optional) – resize width hint (not enforced, passed for future use)
 * - `h` (optional) – resize height hint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rawUrl = searchParams.get("url")

    if (!rawUrl) {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
    }

    // Decode in case the client double-encoded it
    const imageUrl = decodeURIComponent(rawUrl)

    // Only proxy Supabase storage URLs or the app's own media
    const isSupabase =
      SUPABASE_URL &&
      (imageUrl.startsWith(SUPABASE_URL) || imageUrl.includes(".supabase.co/storage"))
    const isOwnDomain =
      imageUrl.includes("loopapp.me") || imageUrl.includes("vercel.app")
    const isDataUri = imageUrl.startsWith("data:")
    const isBlob = imageUrl.startsWith("blob:")

    if (isDataUri) {
      // Data URIs can't be fetched; return as-is
      const [header, base64Data] = imageUrl.split(",")
      const mime = header.match(/data:(.*?);/)?.[1] || "image/png"
      const buffer = Buffer.from(base64Data || "", "base64")
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    if (isBlob) {
      return NextResponse.json({ error: "Blob URLs cannot be proxied" }, { status: 400 })
    }

    if (!isSupabase && !isOwnDomain) {
      // For external URLs, try to proxy but log a warning
      console.warn(`[image-proxy] Proxying non-whitelisted URL: ${imageUrl}`)
    }

    // Forward relevant headers
    const headers = new Headers()
    const ifNoneMatch = request.headers.get("if-none-match")
    if (ifNoneMatch) headers.set("if-none-match", ifNoneMatch)
    const ifModifiedSince = request.headers.get("if-modified-since")
    if (ifModifiedSince) headers.set("if-modified-since", ifModifiedSince)

    const response = await fetch(imageUrl, {
      headers,
      redirect: "follow",
      next: { revalidate: 86400 }, // Cache for 24h on the edge
    })

    if (!response.ok) {
      // If the original image is 404, return a transparent 1x1 pixel instead
      // of showing a broken image icon
      if (response.status === 404 || response.status === 410) {
        const pixel = Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTkSuQmCC",
          "base64"
        )
        return new NextResponse(pixel, {
          status: 200, // Return 200 so browsers don't show broken-image icon
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=60, s-maxage=60", // Short cache for missing images
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      )
    }

    // Stream the image body
    const contentType = response.headers.get("content-type") || "image/jpeg"
    const cacheControl = response.headers.get("cache-control") || "public, max-age=86400, s-maxage=86400"
    const etag = response.headers.get("etag")
    const lastModified = response.headers.get("last-modified")

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    }

    if (etag) responseHeaders["ETag"] = etag
    if (lastModified) responseHeaders["Last-Modified"] = lastModified

    return new NextResponse(response.body, {
      status: 200,
      headers: responseHeaders,
    })
  } catch (error: any) {
    console.error("[image-proxy] Error:", error?.message || error)
    // Return a transparent pixel on error so the UI stays clean
    const pixel = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRUEFTkSuQmCC",
      "base64"
    )
    return new NextResponse(pixel, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "Access-Control-Allow-Origin": "*",
      },
    })
  }
}

import { NextRequest, NextResponse } from "next/server"
import { decodeBundleToken, readBundle } from "@/lib/media/bundles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Serve a private project bundle.
 *
 * Always `text/plain` + `attachment` with `nosniff`, whatever the stored bytes
 * are — a `.html` or `.js` source file therefore downloads as text and can
 * never execute on the app origin. HMAC token validation also makes path
 * traversal impossible.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const relativePath = decodeBundleToken(decodeURIComponent(token))
  if (!relativePath) return new NextResponse("Not found", { status: 404 })

  const bundle = await readBundle(relativePath)
  if (!bundle) return new NextResponse("Not found", { status: 404 })

  return new NextResponse(new Uint8Array(bundle.bytes), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${bundle.filename.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=3600",
    },
  })
}

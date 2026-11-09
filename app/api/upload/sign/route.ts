import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Retired: Cloudinary signed uploads.
 *
 * New uploads must not reach Cloudinary from any code path, so this endpoint no
 * longer mints signatures or exposes credentials. It answers with the endpoint
 * that replaced it, which keeps the failure self-explanatory for any old client
 * still bundled in the wild.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Direct Cloudinary uploads are no longer supported. Upload to /api/media/upload instead.",
      code: "upload_signing_retired",
      endpoint: "/api/media/upload",
    },
    { status: 410 },
  )
}

export async function GET() {
  return NextResponse.json(
    { error: "This endpoint has been retired.", endpoint: "/api/media/upload" },
    { status: 410 },
  )
}

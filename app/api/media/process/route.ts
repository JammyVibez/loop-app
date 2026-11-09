import { NextRequest, NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "node:crypto"
import { drainMediaQueue } from "@/lib/media/queue"
import { requireAdmin } from "@/lib/server-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function safeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest()
  const right = createHash("sha256").update(b).digest()
  return timingSafeEqual(left, right)
}

/**
 * Drain the background media queue.
 *
 * The app kicks the queue itself after every upload; this endpoint exists so a
 * cron/systemd timer can recover jobs left behind by a restart or a failed
 * transcode. It accepts either `MEDIA_WORKER_SECRET` (server-to-server) or an
 * admin session. Processing is idempotent.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MEDIA_WORKER_SECRET
  const provided = request.headers.get("x-media-worker-secret") || ""

  let authorized = false
  if (secret && provided && safeEqual(secret, provided)) {
    authorized = true
  } else {
    const { response } = await requireAdmin(request)
    authorized = !response
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 5) || 5, 20)
  const results = await drainMediaQueue(limit)
  return NextResponse.json({
    success: true,
    processed: results.length,
    failed: results.filter((r) => !r.ok).length,
    results,
  })
}

export async function GET(request: NextRequest) {
  if (request.headers.get("x-media-worker-secret") !== process.env.MEDIA_WORKER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ success: true, worker: "media", ok: true })
}

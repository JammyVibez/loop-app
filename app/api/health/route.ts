import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * GET /api/health
 *
 * Lightweight health-check endpoint. Returns status of core services
 * so uptime monitors, load balancers, and manual checks can verify
 * the app is operational.
 *
 * Response:
 *   { status: "ok"|"degraded"|"error", version, timestamp, checks: {...} }
 */
export async function GET() {
  const timestamp = new Date().toISOString()
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

  // 1. Supabase connectivity
  try {
    const start = Date.now()
    const { createServerClient } = await import("@/lib/supabase")
    const supabase = createServerClient()
    const { error } = await supabase.from("profiles").select("id").limit(1)
    checks.supabase = {
      status: error ? "error" : "ok",
      latencyMs: Date.now() - start,
      ...(error ? { error: error.message } : {}),
    }
  } catch (err: unknown) {
    checks.supabase = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }

  // 2. Image proxy reachability (try a known public image)
  try {
    const start = Date.now()
    const probeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/avatars/.healthcheck`
    const res = await fetch(probeUrl, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(5000) })
    // 404 is fine — it means Supabase is reachable
    checks.imageProxy = {
      status: res.status < 500 ? "ok" : "error",
      latencyMs: Date.now() - start,
      ...(res.status >= 500 ? { error: `Upstream returned ${res.status}` } : {}),
    }
  } catch (err: unknown) {
    checks.imageProxy = {
      status: "error",
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }

  // 3. Environment sanity
  const requiredEnvVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]
  const missing = requiredEnvVars.filter((k) => !process.env[k])
  checks.env = {
    status: missing.length === 0 ? "ok" : "error",
    ...(missing.length > 0 ? { error: `Missing: ${missing.join(", ")}` } : {}),
  }

  // Overall status
  const statuses = Object.values(checks).map((c) => c.status)
  const overallStatus = statuses.includes("error") ? "error" : statuses.includes("degraded") ? "degraded" : "ok"
  const statusCode = overallStatus === "ok" ? 200 : overallStatus === "degraded" ? 200 : 503

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      checks,
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  )
}

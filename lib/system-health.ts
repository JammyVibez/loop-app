import "server-only"
import { v2 as cloudinary } from "cloudinary"

/**
 * Read-only System Health monitoring.
 *
 * Every call happens server-side using secrets from the environment
 * (SUPABASE_ACCESS_TOKEN, CLOUDINARY_*, VERCEL_TOKEN, RENDER_API_KEY) and
 * never touches the client. All providers are optional — if a token or
 * project reference is missing, the source is reported as "unavailable"
 * instead of failing the whole dashboard.
 */

const SUPABASE_MGMT_BASE = "https://api.supabase.com/v1"
const SUPABASE_FREE_DB_LIMIT_BYTES = 500 * 1024 * 1024 // 500 MB
const SUPABASE_FREE_EGRESS_BYTES = 5 * 1024 * 1024 * 1024 // 5 GB
const SUPABASE_FREE_REALTIME_CONNECTIONS = 200
const SUPABASE_FREE_EDGE_INVOCATIONS = 500_000
const MAX_EDGE_FUNCTIONS_TO_SAMPLE = 15

export interface HealthMetric {
  key: string
  label: string
  used: number
  limit: number | null
  unit: "bytes" | "count" | "connections" | "credits"
  percent: number | null
  note?: string
}

export interface SourceStatus {
  ok: boolean
  message?: string
}

interface SupabaseUsage {
  project_ref?: string
  project_status?: string
  metrics: HealthMetric[]
  error?: string
}

export interface SystemHealth {
  generated_at: string
  supabase: SupabaseUsage | null
  cloudinary: {
    ok: boolean
    message?: string
    plan?: string
    last_updated?: string
    metrics: HealthMetric[]
  } | null
  vercel: {
    ok: boolean
    message?: string
    state?: string
    ready_state?: string
    created_at?: string
    ready_at?: string
    url?: string
    commit_ref?: string
    commit_message?: string
  } | null
  render: {
    ok: boolean
    message?: string
    state?: string
    started_at?: string
    finished_at?: string
    commit_message?: string
    url?: string
  } | null
}

function pct(used: number, limit: number | null): number | null {
  if (!limit || limit <= 0) return null
  return Math.min(100, Math.round((used / limit) * 1000) / 10)
}

function bytes(v: number | undefined | null) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null
}

export function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  if (!url) return null
  try {
    const host = new URL(url).hostname
    const ref = host.split(".")[0]
    return ref && /^[a-z0-9]{20}$/.test(ref) ? ref : null
  } catch {
    return null
  }
}

async function mgmtFetch(path: string, timeoutMs = 8000) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) return null
  const res = await fetch(`${SUPABASE_MGMT_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Supabase Management API ${res.status}: ${text.slice(0, 160)}`)
  }
  return res.json()
}

/**
 * Sums a value that may be a bare number or an object (e.g.
 * { egress: n } / { total: n } / { success: n, failure: n }) so we stay
 * resilient to shape changes in Supabase's analytics endpoints.
 */
function sumRowValue(row: unknown, preferKeys: string[] = []): number {
  if (row == null) return 0
  if (typeof row === "number") return Number.isFinite(row) ? row : 0
  if (typeof row === "object") {
    const obj = row as Record<string, unknown>
    for (const key of preferKeys) {
      if (typeof obj[key] === "number") return obj[key] as number
    }
    let total = 0
    for (const v of Object.values(obj)) {
      if (typeof v === "number" && Number.isFinite(v)) total += v
    }
    return total
  }
  return 0
}

async function fetchDatabaseSize(ref: string) {
  const data = await mgmtFetch(`/projects/${ref}`)
  const size = bytes(data?.database?.size ?? data?.database_size)
  if (size == null) return null
  return {
    used: size,
    limit: SUPABASE_FREE_DB_LIMIT_BYTES,
    percent: pct(size, SUPABASE_FREE_DB_LIMIT_BYTES),
  }
}

async function fetchEgress(ref: string): Promise<{ used: number; limit: number; percent: number } | null> {
  try {
    const data = await mgmtFetch(`/projects/${ref}/analytics/endpoints/usage.egress?interval=1d`)
    const rows: unknown[] = Array.isArray(data?.result) ? (data.result as unknown[]) : []
    let total = 0
    for (const row of rows) {
      const value = (row as Record<string, unknown>)?.value
      total += sumRowValue(value, ["egress", "total", "bandwidth"])
    }
    if (total <= 0 && rows.length > 0) return null
    return { used: total, limit: SUPABASE_FREE_EGRESS_BYTES, percent: pct(total, SUPABASE_FREE_EGRESS_BYTES) ?? 0 }
  } catch {
    return null
  }
}

async function fetchApiRequestCounts(ref: string): Promise<{ total: number; realtime: number; rest: number; storage: number; auth: number } | null> {
  try {
    const data = await mgmtFetch(`/projects/${ref}/analytics/endpoints/usage.api-counts?interval=1d`)
    const rows = Array.isArray(data?.result) ? (data.result as Record<string, unknown>[]) : []
    let total = 0
    let realtime = 0
    let rest = 0
    let storage = 0
    let auth = 0
    for (const row of rows) {
      total += Number(row?.total_rest_requests || 0)
      realtime += Number(row?.total_realtime_requests || 0)
      rest += Number(row?.total_rest_requests || 0)
      storage += Number(row?.total_storage_requests || 0)
      auth += Number(row?.total_auth_requests || 0)
    }
    return { total: total + realtime + storage + auth, realtime, rest, storage, auth }
  } catch {
    return null
  }
}

async function fetchRealtimeConnections(ref: string): Promise<{ used: number; limit: number; percent: number } | null> {
  try {
    const data = await mgmtFetch(`/projects/${ref}/realtime/usage`)
    const used = bytes(data?.current_connections ?? data?.current_connections_count)
    if (used == null) return null
    const limit = bytes(data?.max_connections) ?? SUPABASE_FREE_REALTIME_CONNECTIONS
    return { used, limit, percent: pct(used, limit) ?? 0 }
  } catch {
    return null
  }
}

async function fetchEdgeFunctionInvocations(ref: string): Promise<{ used: number; limit: number; percent: number; note?: string } | null> {
  try {
    const functions = (await mgmtFetch(`/projects/${ref}/functions`)) as Record<string, unknown>[] | null
    if (!Array.isArray(functions) || functions.length === 0) return null
    const sampled = functions.slice(0, MAX_EDGE_FUNCTIONS_TO_SAMPLE)
    const results = await Promise.allSettled(
      sampled.map((fn) =>
        mgmtFetch(
          `/projects/${ref}/analytics/endpoints/functions.combined-stats?interval=1day&function_id=${encodeURIComponent(String(fn.id))}`,
          6000,
        ),
      ),
    )
    let total = 0
    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue
      const rows: unknown[] = Array.isArray(r.value?.result) ? (r.value.result as unknown[]) : []
      for (const row of rows) {
        const value = (row as Record<string, unknown>)?.value
        total += sumRowValue(value, ["success", "count", "invocations"])
      }
    }
    if (total <= 0) return null
    const note =
      functions.length > MAX_EDGE_FUNCTIONS_TO_SAMPLE
        ? `Sampled ${MAX_EDGE_FUNCTIONS_TO_SAMPLE} of ${functions.length} functions (billing period)`
        : "Current billing period"
    return { used: total, limit: SUPABASE_FREE_EDGE_INVOCATIONS, percent: pct(total, SUPABASE_FREE_EDGE_INVOCATIONS) ?? 0, note }
  } catch {
    return null
  }
}

export async function fetchSupabaseUsage(): Promise<SupabaseUsage | null> {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const ref = getSupabaseProjectRef()
  if (!token || !ref) {
    return {
      error: token
        ? "Could not derive the Supabase project ref from NEXT_PUBLIC_SUPABASE_URL."
        : "SUPABASE_ACCESS_TOKEN (Management API personal access token) is not configured.",
      metrics: [],
    }
  }

  const metrics: HealthMetric[] = []
  let projectStatus: string | undefined
  let projectRef = ref

  try {
    const project = await mgmtFetch(`/projects/${ref}`, 6000)
    if (project) {
      projectStatus = project.status
      projectRef = project.ref || ref
    }
  } catch (e) {
    // Project detail is optional — usage endpoints still tell the story.
  }

  const [db, egress, requests, realtime, edge] = await Promise.all([
    fetchDatabaseSize(ref).catch(() => null),
    fetchEgress(ref).catch(() => null),
    fetchApiRequestCounts(ref).catch(() => null),
    fetchRealtimeConnections(ref).catch(() => null),
    fetchEdgeFunctionInvocations(ref).catch(() => null),
  ])

  if (db) {
    metrics.push({ key: "db_size", label: "Database size", used: db.used, limit: db.limit, unit: "bytes", percent: db.percent })
  }

  if (egress) {
    metrics.push({
      key: "egress",
      label: "Egress (bandwidth)",
      used: egress.used,
      limit: egress.limit,
      unit: "bytes",
      percent: egress.percent,
      note: "Billing period",
    })
  } else if (requests) {
    metrics.push({
      key: "api_requests",
      label: "API requests (egress API unavailable)",
      used: requests.total,
      limit: null,
      unit: "count",
      percent: null,
      note: `REST ${requests.rest.toLocaleString()} · Realtime ${requests.realtime.toLocaleString()} · Storage ${requests.storage.toLocaleString()} · Auth ${requests.auth.toLocaleString()}`,
    })
  }

  if (realtime) {
    metrics.push({
      key: "realtime",
      label: "Realtime concurrent connections",
      used: realtime.used,
      limit: realtime.limit,
      unit: "connections",
      percent: realtime.percent,
    })
  }

  if (edge) {
    metrics.push({
      key: "edge_functions",
      label: "Edge function invocations",
      used: edge.used,
      limit: edge.limit,
      unit: "count",
      percent: edge.percent,
      note: edge.note,
    })
  }

  if (metrics.length === 0) {
    return {
      project_ref: projectRef,
      project_status: projectStatus,
      metrics: [],
      error: "Supabase Management API returned no usage data. Verify SUPABASE_ACCESS_TOKEN has the analytics_usage_read permission and the project is active.",
    }
  }

  return { project_ref: projectRef, project_status: projectStatus, metrics }
}

let cloudinaryConfigured = false

export async function fetchCloudinaryUsage() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      ok: false,
      message: "Cloudinary env vars (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.",
      metrics: [],
    }
  }

  if (!cloudinaryConfigured) {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
    cloudinaryConfigured = true
  }

  try {
    const data = (await cloudinary.api.usage()) as {
      plan?: string
      last_updated?: string
      credits?: { usage?: number; limit?: number; used_percent?: number }
      storage?: { usage?: number; limit?: number; used_percent?: number; credits_usage?: number }
      bandwidth?: { usage?: number; limit?: number; used_percent?: number; credits_usage?: number }
      transformations?: { usage?: number; limit?: number; used_percent?: number; credits_usage?: number }
      requests?: { usage?: number; limit?: number; used_percent?: number; credits_usage?: number }
    }

    const metrics: HealthMetric[] = []
    const credits = data?.credits
    if (credits && typeof credits.usage === "number") {
      metrics.push({
        key: "credits",
        label: "Credits",
        used: credits.usage,
        limit: bytes(credits.limit) ?? 25,
        unit: "credits",
        percent: pct(credits.usage, bytes(credits.limit) ?? 25),
        note: data.plan ? `Plan: ${data.plan}` : undefined,
      })
    }

    const pushResource = (
      key: string,
      label: string,
      r?: { usage?: number; limit?: number; used_percent?: number; credits_usage?: number },
    ) => {
      if (!r || typeof r.usage !== "number") return
      metrics.push({
        key,
        label,
        used: r.usage,
        limit: bytes(r.limit),
        unit: "bytes",
        percent: pct(r.usage, bytes(r.limit)),
        note: typeof r.credits_usage === "number" ? `${r.credits_usage.toFixed(2)} credits` : undefined,
      })
    }

    pushResource("storage", "Storage", data?.storage)
    pushResource("bandwidth", "Bandwidth", data?.bandwidth)
    pushResource("transformations", "Transformations", data?.transformations)
    pushResource("requests", "Requests", data?.requests)

    if (metrics.length === 0) {
      return { ok: true, message: "No usage numbers reported by Cloudinary yet.", metrics }
    }

    return {
      ok: true,
      plan: data?.plan,
      last_updated: data?.last_updated,
      metrics,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Cloudinary usage request failed.",
      metrics: [],
    }
  }
}

export async function fetchVercelDeployment() {
  const token = process.env.VERCEL_TOKEN
  if (!token) return null
  try {
    const params = new URLSearchParams({ limit: "1" })
    if (process.env.VERCEL_PROJECT_ID) params.set("projectId", process.env.VERCEL_PROJECT_ID)
    if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID)
    const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!res.ok) {
      return { ok: false, message: `Vercel API ${res.status} — check VERCEL_TOKEN permissions.` }
    }
    const data = await res.json()
    const d = Array.isArray(data?.deployments) ? data.deployments[0] : undefined
    if (!d) return { ok: false, message: "No deployments found for this project." }
    return {
      ok: true,
      state: d.state,
      ready_state: d.readyState,
      created_at: d.createdAt,
      ready_at: d.ready,
      url: d.url,
      commit_ref: d.meta?.githubCommitRef,
      commit_message: d.meta?.githubCommitMessage,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Vercel API request failed." }
  }
}

export async function fetchRenderDeployment() {
  const token = process.env.RENDER_API_KEY
  const serviceId = process.env.RENDER_SERVICE_ID
  if (!token || !serviceId) return null
  try {
    const res = await fetch(`https://api.render.com/v1/services/${encodeURIComponent(serviceId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    })
    if (!res.ok) {
      return { ok: false, message: `Render API ${res.status} — check RENDER_API_KEY / RENDER_SERVICE_ID.` }
    }
    const data = await res.json()
    const lastDeploy = data?.lastDeploy
    if (!lastDeploy) return { ok: false, message: "Service found but no deploys recorded yet." }
    return {
      ok: true,
      state: lastDeploy.status,
      started_at: lastDeploy.startedAt,
      finished_at: lastDeploy.finishedAt,
      commit_message: lastDeploy.commit?.message,
      url: data?.serviceDetails?.url || data?.url,
    }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Render API request failed." }
  }
}

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const [supabase, cloudinaryData, vercel, render] = await Promise.all([
    fetchSupabaseUsage(),
    fetchCloudinaryUsage(),
    fetchVercelDeployment(),
    fetchRenderDeployment(),
  ])

  return {
    generated_at: new Date().toISOString(),
    supabase,
    cloudinary: cloudinaryData,
    vercel,
    render,
  }
}

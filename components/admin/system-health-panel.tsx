"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  Cloud,
  Database,
  Gauge,
  
  RefreshCw,
  Rocket,
  Server,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

interface HealthMetric {
  key: string
  label: string
  used: number
  limit: number | null
  unit: "bytes" | "count" | "connections" | "credits"
  percent: number | null
  note?: string
}

interface HealthData {
  generated_at: string
  supabase: { project_ref?: string; project_status?: string; metrics: HealthMetric[]; error?: string } | null
  cloudinary: { ok: boolean; message?: string; plan?: string; last_updated?: string; metrics: HealthMetric[] } | null
  vercel:
    | { ok: boolean; message?: string; state?: string; ready_state?: string; created_at?: string; ready_at?: string; url?: string; commit_ref?: string; commit_message?: string }
    | null
  render:
    | { ok: boolean; message?: string; state?: string; started_at?: string; finished_at?: string; commit_message?: string; url?: string }
    | null
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  const units = ["KB", "MB", "GB", "TB", "PB"]
  let value = n
  let unit = "B"
  for (const u of units) {
    value /= 1024
    unit = u
    if (value < 1024) break
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${unit}`
}

function formatValue(used: number, limit: number | null, unit: HealthMetric["unit"]) {
  const usedStr = unit === "bytes" ? formatBytes(used) : used.toLocaleString()
  if (limit == null) return usedStr
  const limitStr = unit === "bytes" ? formatBytes(limit) : limit.toLocaleString()
  return `${usedStr} / ${limitStr}`
}

function unitSuffix(unit: HealthMetric["unit"]) {
  switch (unit) {
    case "bytes":
      return ""
    case "connections":
      return " conn"
    case "credits":
      return " credits"
    default:
      return ""
  }
}

function progressColor(percent: number | null) {
  if (percent == null) return "bg-primary"
  if (percent >= 80) return "bg-red-500"
  if (percent >= 60) return "bg-amber-500"
  return "bg-emerald-500"
}

function metricTone(percent: number | null) {
  if (percent == null) return "text-muted-foreground"
  if (percent >= 80) return "text-red-500"
  if (percent >= 60) return "text-amber-500"
  return "text-emerald-500"
}

function MetricRow({ metric }: { metric: HealthMetric }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{metric.label}</p>
        <p className="text-sm tabular-nums text-muted-foreground">
          <span className={cn("font-semibold", metricTone(metric.percent))}>
            {formatValue(metric.used, metric.limit, metric.unit)}
            {unitSuffix(metric.unit)}
          </span>
          {metric.percent != null && <span className="ml-1.5">({metric.percent}%)</span>}
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", progressColor(metric.percent))}
          style={{ width: `${metric.percent ?? 0}%` }}
        />
      </div>
      {metric.note ? <p className="text-xs text-muted-foreground">{metric.note}</p> : null}
    </div>
  )
}

function MetricList({ metrics }: { metrics: HealthMetric[] }) {
  if (metrics.length === 0) {
    return <p className="text-sm text-muted-foreground">No metrics reported yet.</p>
  }
  return (
    <div className="space-y-4">
      {metrics.map((m) => (
        <MetricRow key={m.key} metric={m} />
      ))}
    </div>
  )
}

function UnavailableCard({ title, message, icon }: { title: string; message?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <Activity className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message || "Not configured — add the API keys in the project environment to enable monitoring."}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function deploymentStateBadge(state?: string, ok = true) {
  if (!state) return <Badge variant="outline">Unknown</Badge>
  const normalized = state.toUpperCase()
  const live = normalized === "READY" || normalized === "LIVE" || normalized === "OK"
  const building =
    normalized === "BUILDING" || normalized === "QUEUED" || normalized === "INITIALIZING" || normalized === "BUILD_IN_PROGRESS" || normalized === "UPDATE_IN_PROGRESS" || normalized === "CREATED"
  const failed = normalized === "ERROR" || normalized === "DEPLOY_ERROR" || normalized === "CANCELED" || normalized === "CANCELLED"
  if (!ok) return <Badge variant="destructive">{state}</Badge>
  if (failed) return <Badge variant="destructive">{state}</Badge>
  if (building) return <Badge className="bg-amber-500 text-slate-900">{state}</Badge>
  if (live) return <Badge className="bg-emerald-500 text-white">{state}</Badge>
  return <Badge variant="outline">{state}</Badge>
}

function formatTimestamp(ts?: string) {
  if (!ts) return "—"
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ts
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function SystemHealthPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(
    async (manual = false) => {
      manual ? setRefreshing(true) : setLoading(true)
      try {
        const response = await fetch("/api/admin/system-health", { headers: getAuthHeader(), cache: "no-store" })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || "Failed to load system health")
        setData(json)
      } catch (error: any) {
        toast({ title: "System health load failed", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [getAuthHeader, toast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const allMetrics = useMemo(() => {
    const list: Array<{ source: string; metric: HealthMetric }> = []
    for (const m of data?.supabase?.metrics || []) list.push({ source: "Supabase", metric: m })
    for (const m of data?.cloudinary?.metrics || []) list.push({ source: "Cloudinary", metric: m })
    return list
  }, [data])

  const warnings = useMemo(
    () => allMetrics.filter(({ metric }) => metric.percent != null && metric.percent >= 80),
    [allMetrics],
  )

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  const supabase = data?.supabase
  const cloudinary = data?.cloudinary
  const vercel = data?.vercel
  const render = data?.render

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">System Health & Infrastructure</h2>
          <p className="text-sm text-muted-foreground">
            Live usage from external services. Read-only — no changes are made to any provider.
            {data?.generated_at ? (
              <span className="ml-1 block sm:inline">
                Last refreshed {formatTimestamp(data.generated_at)}.
              </span>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? <Spinner className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {warnings.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Usage warning — {warnings.length} metric{warnings.length > 1 ? "s" : ""} at or above 80%</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {warnings.map(({ source, metric }) => (
                <li key={`${source}-${metric.key}`}>
                  {source} — {metric.label} at {metric.percent}% of its limit. Take action before hitting the hard cap.
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        allMetrics.length > 0 && (
          <Alert>
            <Gauge className="h-4 w-4" />
            <AlertTitle>All systems within limits</AlertTitle>
            <AlertDescription>No metric has crossed the 80% warning threshold.</AlertDescription>
          </Alert>
        )
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {supabase ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4 text-emerald-500" />
                  Supabase
                </CardTitle>
                <div className="flex items-center gap-2">
                  {supabase.project_status ? (
                    <Badge variant={supabase.project_status === "ACTIVE_HEALTHY" ? "default" : "secondary"} className="rounded-full">
                      {supabase.project_status.replace(/_/g, " ")}
                    </Badge>
                  ) : null}
                  {supabase.project_ref ? <span className="text-xs text-muted-foreground">{supabase.project_ref}</span> : null}
                </div>
              </div>
              <CardDescription>Free tier limits — 500 MB database · 5 GB egress · 200 Realtime connections · 500K edge invocations/mo.</CardDescription>
            </CardHeader>
            <CardContent>
              {supabase.error && !supabase.metrics.length ? (
                <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{supabase.error}</span>
                </div>
              ) : (
                <MetricList metrics={supabase.metrics} />
              )}
            </CardContent>
          </Card>
        ) : (
          <UnavailableCard title="Supabase" icon={<Database className="h-4 w-4 text-emerald-500" />} />
        )}

        {cloudinary ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Cloud className="h-4 w-4 text-sky-500" />
                  Cloudinary
                </CardTitle>
                {cloudinary.plan ? <Badge variant="outline" className="rounded-full">{cloudinary.plan}</Badge> : null}
              </div>
              <CardDescription>
                {cloudinary.ok
                  ? `Free tier — 25 credits/mo.${cloudinary.last_updated ? ` Updated ${formatTimestamp(cloudinary.last_updated)}.` : ""}`
                  : "Monitoring unavailable."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {cloudinary.ok ? (
                <MetricList metrics={cloudinary.metrics} />
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cloudinary.message || "Cloudinary usage could not be fetched."}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <UnavailableCard title="Cloudinary" icon={<Cloud className="h-4 w-4 text-sky-500" />} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {vercel ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Server className="h-4 w-4 text-slate-500" />
                Vercel
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!vercel.ok ? (
                <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-muted-foreground">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{vercel.message}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Status</span>
                    {deploymentStateBadge(vercel.state || vercel.ready_state)}
                  </div>
                  <p className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Created</span>
                    <span className="tabular-nums">{formatTimestamp(vercel.created_at)}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Ready</span>
                    <span className="tabular-nums">{formatTimestamp(vercel.ready_at)}</span>
                  </p>
                  {vercel.commit_ref ? (
                    <p className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Branch</span>
                      <span className="font-mono text-xs">{vercel.commit_ref}</span>
                    </p>
                  ) : null}
                  {vercel.commit_message ? (
                    <p className="truncate">
                      <span className="text-muted-foreground">Commit: </span>
                      {vercel.commit_message}
                    </p>
                  ) : null}
                  {vercel.url ? (
                    <p className="truncate">
                      <span className="text-muted-foreground">URL: </span>
                      <a href={`https://${vercel.url}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {vercel.url}
                      </a>
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <UnavailableCard
            title="Vercel"
            icon={<Server className="h-4 w-4 text-slate-500" />}
            message="Not configured — set VERCEL_TOKEN (and optionally VERCEL_PROJECT_ID / VERCEL_TEAM_ID) to see deployment status here."
          />
        )}

        {render ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Rocket className="h-4 w-4 text-orange-500" />
                Render
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {!render.ok ? (
                <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-muted-foreground">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{render.message}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Last deploy</span>
                    {deploymentStateBadge(render.state)}
                  </div>
                  <p className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Started</span>
                    <span className="tabular-nums">{formatTimestamp(render.started_at)}</span>
                  </p>
                  <p className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Finished</span>
                    <span className="tabular-nums">{formatTimestamp(render.finished_at)}</span>
                  </p>
                  {render.commit_message ? (
                    <p className="truncate">
                      <span className="text-muted-foreground">Commit: </span>
                      {render.commit_message}
                    </p>
                  ) : null}
                  {render.url ? (
                    <p className="truncate">
                      <span className="text-muted-foreground">URL: </span>
                      <a href={render.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {render.url}
                      </a>
                    </p>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <UnavailableCard
            title="Render"
            icon={<Rocket className="h-4 w-4 text-orange-500" />}
            message="Not configured — set RENDER_API_KEY and RENDER_SERVICE_ID to see deployment status here."
          />
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Gauge className="h-3.5 w-3.5" />
        Read-only monitoring. Keys are stored as server-side environment variables and never exposed to the client.
      </p>
    </div>
  )
}

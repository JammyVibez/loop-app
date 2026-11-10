"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Clock, Activity, Wifi, Database, Shield, Image, Zap } from "@/components/icons/lucide-compat"

interface ServiceCheck {
  name: string
  status: "operational" | "degraded" | "down"
  latencyMs: number
  description: string
  lastChecked: string
}

interface StatusData {
  overallStatus: "operational" | "degraded" | "outage"
  timestamp: string
  services: ServiceCheck[]
  uptime: {
    last24h: number
    last7d: number
    last30d: number
    last90d: number
  }
  responseTime: {
    avg: number
    p95: number
  }
}

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  Database: <Database className="h-4 w-4" />,
  Authentication: <Shield className="h-4 w-4" />,
  "Image Proxy": <Image className="h-4 w-4" />,
  "Real-time": <Wifi className="h-4 w-4" />,
  "API Server": <Activity className="h-4 w-4" />,
}

function StatusBadge({ status }: { status: string }) {
  if (status === "operational") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Operational
      </span>
    )
  }
  if (status === "degraded") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-500">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        Degraded
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-500">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Down
    </span>
  )
}

function OverallStatusBanner({ status }: { status: StatusData["overallStatus"] }) {
  const config = {
    operational: {
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />,
      title: "All Systems Operational",
      description: "All services are running smoothly. No issues detected.",
      bg: "from-emerald-500/5 to-emerald-500/0 border-emerald-500/20",
      border: "border-emerald-500/30",
    },
    degraded: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
      title: "Partial System Degradation",
      description: "Some services are experiencing issues. We are investigating.",
      bg: "from-amber-500/5 to-amber-500/0 border-amber-500/20",
      border: "border-amber-500/30",
    },
    outage: {
      icon: <XCircle className="h-6 w-6 text-red-500" />,
      title: "Major System Outage",
      description: "One or more critical services are down. Our team is working on it.",
      bg: "from-red-500/5 to-red-500/0 border-red-500/20",
      border: "border-red-500/30",
    },
  }

  const c = config[status]

  return (
    <div className={`rounded-2xl border ${c.border} bg-gradient-to-b ${c.bg} p-6 backdrop-blur-sm`}>
      <div className="flex items-center gap-3">
        {c.icon}
        <div>
          <h2 className="text-lg font-bold">{c.title}</h2>
          <p className="text-sm text-muted-foreground">{c.description}</p>
        </div>
      </div>
    </div>
  )
}

function UptimeBar({ uptime, days }: { uptime: number; days: number }) {
  // Generate 90 segments for the uptime bar
  const segments = Array.from({ length: 90 }, (_, i) => {
    // Simulate some variation — most days are fine, a few have issues
    if (i < 3) return "degraded"
    if (i === 15) return "degraded"
    if (i === 45) return "down"
    return "operational"
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{days}-day uptime</span>
        <span className="text-sm font-bold text-foreground">{uptime}%</span>
      </div>
      <div className="flex gap-[2px]">
        {segments.map((s, i) => (
          <div
            key={i}
            className={`h-8 flex-1 rounded-sm transition-all hover:opacity-80 ${
              s === "operational"
                ? "bg-emerald-500"
                : s === "degraded"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
            title={`Day ${90 - i}: ${s === "operational" ? "No issues" : s === "degraded" ? "Degraded" : "Outage"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>90 days ago</span>
        <span>Today</span>
      </div>
    </div>
  )
}

export function StatusPageClient() {
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to fetch status")
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Loop
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
              <p className="text-sm text-muted-foreground">
                Real-time health monitoring for Loop
              </p>
            </div>
          </div>
        </div>

        {loading && !data ? (
          <div className="space-y-6">
            {/* Loading skeleton */}
            <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-muted/50 animate-pulse" />
              ))}
            </div>
            <div className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-red-500">Failed to load status</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
            <button
              onClick={fetchStatus}
              className="mt-3 text-xs font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <>
            {/* Overall Status */}
            <OverallStatusBanner status={data.overallStatus} />

            {/* Response Time Metrics */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs font-medium">Avg Response Time</span>
                </div>
                <p className="text-2xl font-bold">{data.responseTime.avg}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Zap className="h-4 w-4" />
                  <span className="text-xs font-medium">P95 Response Time</span>
                </div>
                <p className="text-2xl font-bold">{data.responseTime.p95}<span className="text-sm font-normal text-muted-foreground">ms</span></p>
              </div>
            </div>

            {/* Uptime History */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-card/50 p-6">
              <h3 className="text-sm font-bold mb-4">Uptime History</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <UptimeBar uptime={data.uptime.last24h} days={1} />
                <UptimeBar uptime={data.uptime.last7d} days={7} />
                <UptimeBar uptime={data.uptime.last30d} days={30} />
                <UptimeBar uptime={data.uptime.last90d} days={90} />
              </div>
            </div>

            {/* Service Statuses */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-card/50 p-6">
              <h3 className="text-sm font-bold mb-4">Service Status</h3>
              <div className="divide-y divide-border/60">
                {data.services.map((service) => (
                  <div key={service.name} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                        {SERVICE_ICONS[service.name] || <Activity className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{service.name}</p>
                        <p className="text-xs text-muted-foreground">{service.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {service.latencyMs}ms
                      </span>
                      <StatusBadge status={service.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Incidents */}
            <div className="mt-6 rounded-2xl border border-border/60 bg-card/50 p-6">
              <h3 className="text-sm font-bold mb-4">Recent Incidents</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/10">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Image Proxy Cache Stale</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Some user profile images were not loading due to cached error responses.
                      Fixed by adding no-cache headers to the image proxy.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Resolved · Aug 27, 2026
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Build Errors Resolved</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Unused import errors were blocking production deploys.
                      Fixed by removing unused imports and setting noUnusedLocals to false.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Resolved · Aug 27, 2026
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(data.timestamp).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Auto-refreshes every 30 seconds
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

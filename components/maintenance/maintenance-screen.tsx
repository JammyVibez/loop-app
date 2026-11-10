"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Wrench, RefreshCw } from "@/components/icons/lucide-compat"

interface MaintenanceInfo {
  enabled: boolean
  message?: string
  developer_notes?: string
}

/**
 * Full-screen maintenance mode. Rendered for every non-admin visitor the
 * moment an admin flips maintenance on — nothing else in the app is visible.
 */
export function MaintenanceScreen({ info }: { info: MaintenanceInfo }) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const dark = mounted && resolvedTheme === "dark"

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      style={{
        background: dark
          ? "radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.18), transparent), #020617"
          : "radial-gradient(1200px 600px at 50% -10%, rgba(99,102,241,0.12), transparent), #f8fafc",
      }}
    >
      <div className="w-full max-w-md">
        {/* Developer SVG illustration */}
        <svg
          viewBox="0 0 200 160"
          className="mx-auto mb-6 h-40 w-52"
          role="img"
          aria-label="Developers working on the app"
        >
          <defs>
            <linearGradient id="devGrad" x1="0" y1="0" x2="200" y2="160" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6366f1" />
              <stop offset="1" stopColor="#22d3ee" />
            </linearGradient>
          </defs>
          {/* Window */}
          <rect x="30" y="20" width="140" height="100" rx="10" fill={dark ? "#0f172a" : "#ffffff"} stroke={dark ? "#334155" : "#e2e8f0"} strokeWidth="2" />
          {/* Window top bar */}
          <rect x="30" y="20" width="140" height="16" rx="10" fill={dark ? "#1e293b" : "#f1f5f9"} />
          <circle cx="44" cy="28" r="3" fill="#f87171" />
          <circle cx="54" cy="28" r="3" fill="#fbbf24" />
          <circle cx="64" cy="28" r="3" fill="#34d399" />
          {/* Code lines */}
          <rect x="44" y="46" width="60" height="5" rx="2.5" fill="#6366f1" opacity="0.85" />
          <rect x="44" y="58" width="90" height="5" rx="2.5" fill="#22d3ee" opacity="0.7" />
          <rect x="44" y="70" width="72" height="5" rx="2.5" fill="#a78bfa" opacity="0.8" />
          <rect x="52" y="82" width="56" height="5" rx="2.5" fill="#6366f1" opacity="0.5" />
          <rect x="52" y="94" width="80" height="5" rx="2.5" fill="#22d3ee" opacity="0.45" />
          {/* Wrench + gear */}
          <g transform="translate(138 88)">
            <circle cx="0" cy="0" r="16" fill="none" stroke="url(#devGrad)" strokeWidth="3.5" strokeDasharray="6 4" transform="rotate(-20)" />
            <path d="M-4 -14 L10 0 M10 0 L-4 14" stroke="url(#devGrad)" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          {/* Pulsing status dot */}
          <circle cx="100" cy="132" r="5" fill="#f59e0b">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <text x="112" y="136" fontSize="10" fill={dark ? "#94a3b8" : "#64748b"} fontFamily="monospace">
            maintenance
          </text>
        </svg>

        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <Wrench className="h-3.5 w-3.5" />
          Under maintenance
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">We&apos;ll be right back</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {info.message || "We are performing scheduled maintenance. Please check back soon."}
        </p>

        {info.developer_notes && (
          <div className="mt-5 rounded-2xl border border-border/70 bg-card/60 p-4 text-left">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <RefreshCw className="h-3 w-3" /> What&apos;s happening right now
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">{info.developer_notes}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh to check again
        </button>
      </div>
    </div>
  )
}

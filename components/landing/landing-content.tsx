"use client"

import { useEffect, useState, useRef, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Play, Smartphone } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/brand/app-logo"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { useTheme } from "next-themes"

function hexToRgb(hex: string) {
  let raw = (hex || "#5b8def").replace("#", "").trim()
  if (raw.length === 3) raw = raw.split("").map((c) => c + c).join("")
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return { r: 91, g: 141, b: 239 }
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  }
}

export function LandingContent() {
  const { currentTheme, availableThemes, setTheme } = useTheme3D()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isLight = mounted && resolvedTheme === "light"
  const primary = currentTheme.colors.primary
  const secondary = currentTheme.colors.secondary
  const p = hexToRgb(primary)
  const fg = isLight ? "#0a0a0b" : "#ffffff"
  const muted = isLight ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.45)"
  const bg = isLight ? "#f6f7fb" : "#060607"

  return (
    <div className="relative min-h-screen" style={{ background: bg, color: fg }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 20% -10%, rgba(${p.r},${p.g},${p.b},0.25), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(${hexToRgb(secondary).r},${hexToRgb(secondary).g},${hexToRgb(secondary).b},0.18), transparent 50%)`,
        }}
      />
      <header className="relative z-10 border-b backdrop-blur-xl" style={{ borderColor: isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <AppLogo className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-semibold">loopapp.me</span>
          </Link>
          <div className="flex items-center gap-2">
            {availableThemes.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                onClick={() => setTheme(t.id)}
                className={cn("h-5 w-5 rounded-full transition-transform", currentTheme.id === t.id && "ring-2 ring-offset-1 scale-110")}
                style={{ background: `linear-gradient(135deg, ${t.colors.primary}, ${t.colors.secondary})` }}
              />
            ))}
            <Link href="/signup">
              <Button size="sm" className="h-8 rounded-full px-3.5 text-xs font-semibold" style={{ background: isLight ? "#0a0a0b" : "#fff", color: isLight ? "#fff" : "#000" }}>
                Sign up
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-5 py-24 text-center">
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: `rgba(${p.r},${p.g},${p.b},0.12)`, color: primary, border: `1px solid rgba(${p.r},${p.g},${p.b},0.25)` }}
        >
          Social software for makers
        </div>
        <h1 className="text-[clamp(2.4rem,6vw,4rem)] font-semibold leading-[1.05] tracking-tight">
          Write together.
          <br />
          Argue for real.
          <br />
          <span style={{ background: `linear-gradient(120deg, ${primary}, ${secondary})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Get paid for it.
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-md text-[16px]" style={{ color: muted }}>
          Co-Loops, Duels, Circles and coins — the stack that turns late-night ideas into published work and actual money.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/signup">
            <Button size="lg" className="h-12 rounded-full px-7 text-sm font-semibold" style={{ background: isLight ? "#0a0a0b" : "#fff", color: isLight ? "#fff" : "#000" }}>
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/download">
            <Button size="lg" variant="ghost" className="h-12 rounded-full px-5 text-sm" style={{ color: muted }}>
              <Smartphone className="mr-1.5 h-4 w-4" /> Get the app
            </Button>
          </Link>
        </div>
        <p className="mt-16 text-sm" style={{ color: muted }}>
          Theme-aware landing is live — switch themes above. Full cinematic particles & interactive mock restoring next.
        </p>
      </main>
    </div>
  )
}

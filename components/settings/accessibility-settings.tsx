"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Accessibility, Type, Eye, Gauge } from "@/components/icons/lucide-compat"

const LS_MOTION = "loop-reduced-motion"
const LS_TEXT_SCALE = "loop-text-scale"
const LS_AUTOPLAY = "loop-autoplay-videos"
const LS_DATA_SAVER = "loop-data-saver"

type TextScale = "sm" | "md" | "lg"

export function AccessibilitySettings() {
  const { toast } = useToast()
  const [mounted, setMounted] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [autoplay, setAutoplay] = useState(true)
  const [dataSaver, setDataSaver] = useState(false)
  const [textScale, setTextScale] = useState<TextScale>("md")

  useEffect(() => {
    setMounted(true)
    setReducedMotion(localStorage.getItem(LS_MOTION) === "true")
    setAutoplay(localStorage.getItem(LS_AUTOPLAY) !== "false")
    setDataSaver(localStorage.getItem(LS_DATA_SAVER) === "true")
    setTextScale((localStorage.getItem(LS_TEXT_SCALE) as TextScale) || "md")
  }, [])

  const applyTextScale = (scale: TextScale) => {
    setTextScale(scale)
    localStorage.setItem(LS_TEXT_SCALE, scale)
    const root = document.documentElement
    root.style.fontSize = scale === "sm" ? "14px" : scale === "lg" ? "18px" : "16px"
  }

  const applyMotion = (value: boolean) => {
    setReducedMotion(value)
    localStorage.setItem(LS_MOTION, String(value))
    document.documentElement.classList.toggle("loop-reduced-motion", value)
  }

  const applyAutoplay = (value: boolean) => {
    setAutoplay(value)
    localStorage.setItem(LS_AUTOPLAY, String(value))
  }

  const applyDataSaver = (value: boolean) => {
    setDataSaver(value)
    localStorage.setItem(LS_DATA_SAVER, String(value))
  }

  if (!mounted) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading…</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Type className="h-5 w-5" /> Text size
          </CardTitle>
          <CardDescription>Make Loop easier to read. Applies immediately across the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["sm", "Small", "Compact"],
                ["md", "Default", "Balanced"],
                ["lg", "Large", "Easy reading"],
              ] as const
            ).map(([value, label, desc]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyTextScale(value)}
                className={
                  "rounded-xl border p-3 text-left transition " +
                  (textScale === value
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:bg-muted/50")
                }
              >
                <p className="font-semibold" style={{ fontSize: value === "sm" ? "0.8rem" : value === "lg" ? "1.05rem" : "0.9rem" }}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-5 w-5" /> Motion & media
          </CardTitle>
          <CardDescription>Reduce movement and control how videos behave as you scroll.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
            <div>
              <Label htmlFor="acc-motion">Reduce motion</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Minimize animations and transitions app-wide</p>
            </div>
            <Switch id="acc-motion" checked={reducedMotion} onCheckedChange={applyMotion} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
            <div>
              <Label htmlFor="acc-autoplay">Autoplay videos</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Videos play automatically as you scroll the feed</p>
            </div>
            <Switch id="acc-autoplay" checked={autoplay} onCheckedChange={applyAutoplay} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-3">
            <div>
              <Label htmlFor="acc-datasaver" className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-primary" /> Data saver
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">Load lower-quality previews on mobile connections</p>
            </div>
            <Switch
              id="acc-datasaver"
              checked={dataSaver}
              onCheckedChange={(v) => {
                applyDataSaver(v)
                toast({ title: v ? "Data saver on" : "Data saver off" })
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your device's system-level "reduce motion" setting is always respected too.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Check, Lock, Sparkles, Crown, X } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

interface PfpFrame {
  id: string | number
  name: string
  description: string | null
  image_url: string
  is_premium: boolean
  price_coins: number
  sort_order: number
  owned?: boolean
  equipped?: boolean
}

interface PfpFramesBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatarUrl?: string | null
  onFrameEquipped?: (frameId: string | number | null) => void
}

// Frame overlay SVG components
function FrameOverlay({ frame, size }: { frame: PfpFrame; size: number }) {
  const r = size / 2
  const strokeWidth = size * 0.08

  const frameStyles: Record<string, { gradient: string[]; glow: string }> = {
    Golden: { gradient: ["#ffd700", "#ffaa00", "#ffd700"], glow: "#ffd700" },
    "Neon Glow": { gradient: ["#00ff88", "#00ccff", "#ff00ff"], glow: "#00ff88" },
    "Pixel Art": { gradient: ["#ff6b6b", "#4ecdc4", "#45b7d1"], glow: "#4ecdc4" },
    Galaxy: { gradient: ["#667eea", "#764ba2", "#6B8DD6"], glow: "#667eea" },
    Fire: { gradient: ["#ff4500", "#ff8c00", "#ffd700"], glow: "#ff4500" },
    Diamond: { gradient: ["#b9f2ff", "#e0f7fa", "#80deea"], glow: "#b9f2ff" },
    Rainbow: { gradient: ["#ff0000", "#ff8800", "#ffff00", "#00ff00", "#0088ff", "#8800ff"], glow: "#ff0000" },
    Galactic: { gradient: ["#0f0c29", "#302b63", "#24243e"], glow: "#7c3aed" },
    Cyber: { gradient: ["#00f0ff", "#0080ff", "#00f0ff"], glow: "#00f0ff" },
    Frost: { gradient: ["#e3f2fd", "#bbdefb", "#90caf9"], glow: "#90caf9" },
    Dragon: { gradient: ["#8b0000", "#ff4500", "#8b0000"], glow: "#ff4500" },
  }

  const style = frameStyles[frame.name]
  if (!style) return null

  const gradientId = `frame-grad-${frame.id}`
  const glowId = `frame-glow-${frame.id}`
  const isRainbow = frame.name === "Rainbow"

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      <defs>
        {isRainbow ? (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%"
            gradientTransform="rotate(45)">
            {style.gradient.map((color, i) => (
              <stop key={i} offset={`${(i / (style.gradient.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </linearGradient>
        ) : (
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={style.gradient[0]} />
            <stop offset="50%" stopColor={style.gradient[1]} />
            <stop offset="100%" stopColor={style.gradient[style.gradient.length - 1]} />
          </linearGradient>
        )}
        <filter id={glowId}>
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      <circle
        cx={r}
        cy={r}
        r={r - strokeWidth / 2}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        filter={`url(#${glowId})`}
        opacity={0.9}
      />
    </svg>
  )
}

export function PfpFramesBrowser({ open, onOpenChange, currentAvatarUrl, onFrameEquipped }: PfpFramesBrowserProps) {
  const { toast } = useToast()
  const { getAuthHeader } = useAuth()
  const [frames, setFrames] = useState<PfpFrame[]>([])
  const [coins, setCoins] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acquiring, setAcquiring] = useState<string | number | null>(null)
  const [equipping, setEquipping] = useState<string | number | null>(null)
  const [previewFrame, setPreviewFrame] = useState<PfpFrame | null>(null)

  const fetchFrames = useCallback(async () => {
    try {
      setLoading(true)
      const headers = getAuthHeader()
      if (!headers.Authorization) return

      const res = await fetch("/api/user/pfp-frames", { headers })
      const data = await res.json()
      if (data.frames) setFrames(data.frames)
      if (data.coins !== undefined) setCoins(data.coins)
    } catch (e) {
      console.error("Failed to fetch frames:", e)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    if (open) fetchFrames()
  }, [open, fetchFrames])

  const handleAcquire = async (frame: PfpFrame) => {
    try {
      setAcquiring(frame.id)
      const headers = getAuthHeader()
      if (!headers.Authorization) return

      const res = await fetch("/api/user/pfp-frames", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ frame_id: frame.id, action: "acquire" }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" })
        return
      }

      toast({ title: "Frame acquired! 🎉", description: `${frame.name} frame is now yours!` })
      setCoins((c) => c - frame.price_coins)
      fetchFrames()
    } catch {
      toast({ title: "Couldn't get this frame", description: "Check your coin balance and try again.", variant: "destructive" })
    } finally {
      setAcquiring(null)
    }
  }

  const handleEquip = async (frame: PfpFrame) => {
    try {
      setEquipping(frame.id)
      const headers = getAuthHeader()
      if (!headers.Authorization) return

      const action = frame.equipped ? "unequip" : "equip"
      const res = await fetch("/api/user/pfp-frames", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ frame_id: frame.id, action }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Failed", description: data.error, variant: "destructive" })
        return
      }

      toast({ title: action === "equip" ? "Frame equipped! ✨" : "Frame removed" })
      onFrameEquipped?.(action === "equip" ? frame.id : null)
      fetchFrames()
    } catch {
      toast({ title: "Couldn't equip frame", description: "Try selecting it again.", variant: "destructive" })
    } finally {
      setEquipping(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md border-border bg-card text-card-foreground max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-amber-500" /> Profile Frames
            </span>
            <span className="flex items-center gap-1.5 text-sm text-amber-500 font-semibold">
              <Crown className="h-3.5 w-3.5" /> {coins} coins
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 p-4">
            {/* Avatar preview with frame */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-muted">
                  {currentAvatarUrl ? (
                    <img
                      src={`/api/image-proxy?url=${encodeURIComponent(currentAvatarUrl)}`}
                      alt="Your avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                      ?
                    </div>
                  )}
                </div>
                {previewFrame && previewFrame.name !== "None" && (
                  <FrameOverlay frame={previewFrame} size={96} />
                )}
              </div>
            </div>

            {/* Frame grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                    frame.equipped
                      ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                  onClick={() => setPreviewFrame(frame)}
                >
                  {/* Frame preview */}
                  <div className="relative w-14 h-14">
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center text-xs text-muted-foreground overflow-hidden">
                      {frame.name === "None" ? (
                        <X className="h-5 w-5" />
                      ) : (
                        <img
                          src={frame.image_url}
                          alt={frame.name}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            // Show gradient fallback
                            const el = e.target as HTMLImageElement
                            el.style.display = "none"
                          }}
                        />
                      )}
                    </div>
                    {frame.name !== "None" && (
                      <FrameOverlay frame={frame} size={56} />
                    )}
                    {frame.equipped && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    {frame.is_premium && !frame.owned && (
                      <div className="absolute -top-1 -left-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <Crown className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-center leading-tight text-muted-foreground truncate w-full">
                    {frame.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action bar */}
        {previewFrame && (
          <div className="border-t border-border p-4 flex gap-2">
            {previewFrame.name === "None" ? (
              <Button
                className="flex-1"
                variant={previewFrame.equipped ? "default" : "outline"}
                onClick={() => handleEquip(previewFrame)}
                disabled={equipping === previewFrame.id}
              >
                {equipping === previewFrame.id ? (
                  <Spinner className="h-4 w-4 mr-1.5" />
                ) : previewFrame.equipped ? (
                  <Check className="h-4 w-4 mr-1.5" />
                ) : null}
                {previewFrame.equipped ? "No Frame Active" : "Remove Frame"}
              </Button>
            ) : previewFrame.owned ? (
              <Button
                className="flex-1"
                variant={previewFrame.equipped ? "default" : "outline"}
                onClick={() => handleEquip(previewFrame)}
                disabled={equipping === previewFrame.id}
              >
                {equipping === previewFrame.id ? (
                  <Spinner className="h-4 w-4 mr-1.5" />
                ) : previewFrame.equipped ? (
                  <Check className="h-4 w-4 mr-1.5" />
                ) : null}
                {previewFrame.equipped ? "Equipped" : "Equip Frame"}
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={() => handleAcquire(previewFrame)}
                disabled={acquiring === previewFrame.id || coins < previewFrame.price_coins}
              >
                {acquiring === previewFrame.id ? (
                  <Spinner className="h-4 w-4 mr-1.5" />
                ) : previewFrame.price_coins > 0 ? (
                  <Crown className="h-4 w-4 mr-1.5" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1.5" />
                )}
                {previewFrame.price_coins > 0
                  ? `Get for ${previewFrame.price_coins} coins`
                  : "Get Free"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

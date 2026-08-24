"use client"

import { ProtectedMedia } from "@/components/media-protection"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Megaphone, ArrowUpRight } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

export interface AdData {
  id: string
  sponsor_name: string
  headline: string
  description?: string | null
  media_url?: string | null
  media_type?: string | null
  link_url: string
}

interface AdCardProps {
  ad: AdData
  sessionId?: string
}

export function AdCard({ ad, sessionId }: AdCardProps) {
  const { user } = useAuth()
  const trackedRef = useRef(false)
  const [clicked, setClicked] = useState(false)

  // Record one impression per ad per session — never on every re-render.
  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true
    const sid = sessionId || `${user?.id || "guest"}:${ad.id}`
    void fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id, action: "impression", session_id: sid }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id])

  const handleClick = () => {
    if (clicked) return
    setClicked(true)
    void fetch("/api/ads/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ad_id: ad.id, action: "click" }),
    }).catch(() => {})
  }

  const isVideo = ad.media_type === "video" || ad.media_url?.match(/\.(mp4|webm|m3u8)(\?|$)/i)

  return (
    <Card className="group overflow-hidden border border-border/60 bg-card/60 shadow-sm transition-all hover:-translate-y-0.5 hover:border-violet-400/40 hover:shadow-lg hover:shadow-violet-900/10">
      <CardContent className="p-0">
        {/* Sponsored label — always clearly marked */}
        <div className="flex items-center justify-between px-4 pt-3">
          <Badge variant="outline" className="gap-1 rounded-full border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
            <Megaphone className="h-3 w-3" /> Sponsored
          </Badge>
          <span className="text-[10px] text-muted-foreground/70">Ad</span>
        </div>

        <a
          href={ad.link_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={handleClick}
          className="block focus:outline-none"
          aria-label={`Sponsored: ${ad.headline} — ${ad.sponsor_name}`}
        >
          {ad.media_url && (
            <div className="relative mt-2.5 overflow-hidden bg-muted/40">
              {isVideo ? (
                <ProtectedMedia type="video" src={ad.media_url} className="aspect-video w-full" showControls={false} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ad.media_url}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5 px-4 pb-4 pt-3">
            <h4 className="line-clamp-2 text-sm font-bold text-foreground transition group-hover:text-violet-400">
              {ad.headline}
            </h4>
            {ad.description && <p className="line-clamp-2 text-xs text-muted-foreground">{ad.description}</p>}
            <div className="flex items-center justify-between pt-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 text-[9px] font-black text-white">
                  {ad.sponsor_name.charAt(0).toUpperCase()}
                </span>
                {ad.sponsor_name}
              </span>
              <span
                className={cn(
                  "flex items-center gap-0.5 rounded-full border border-violet-400/30 px-2 py-0.5 text-[10px] font-bold text-violet-300 transition",
                  "hover:bg-violet-500/15",
                )}
              >
                Learn more <ArrowUpRight className="h-3 w-3" />
              </span>
            </div>
          </div>
        </a>
      </CardContent>
    </Card>
  )
}

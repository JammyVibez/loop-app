"use client"

import { useState, useEffect } from "react"
import { ExternalLink, Globe, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface UrlMetadata {
  url: string
  domain: string
  title: string
  description?: string
  image?: string | null
  icon?: string
}

export function UrlPreviewCard({ url }: { url: string }) {
  const [data, setData] = useState<UrlMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)

    fetch(`/api/url-preview?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!active) return
        if (resData.success && resData.metadata) {
          setData(resData.metadata)
        } else {
          setFailed(true)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [url])

  const domain = (() => {
    try {
      let clean = url
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = `https://${clean}`
      }
      return new URL(clean).hostname.replace(/^www\./, "")
    } catch {
      return url
    }
  })()

  if (loading) {
    return (
      <div className="my-2 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs text-muted-foreground animate-pulse">
        <Globe className="h-4 w-4 text-sky-500 shrink-0" />
        <span className="truncate">Expanding link ({domain})...</span>
      </div>
    )
  }

  const linkTitle = data?.title || domain
  const linkDesc = data?.description || `Open ${domain}`
  const image = data?.image

  return (
    <a
      href={url.startsWith("http") ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group my-2 flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/30 hover:border-sky-500/50 hover:bg-muted/50 transition-all shadow-sm duration-200"
    >
      {image && (
        <div className="relative h-32 sm:h-auto sm:w-36 shrink-0 overflow-hidden bg-muted">
          <img
            src={image}
            alt={linkTitle}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = "none"
            }}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-500 mb-1">
            {data?.icon ? (
              <img src={data.icon} alt="" className="h-3.5 w-3.5 rounded shrink-0" />
            ) : (
              <Globe className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{domain}</span>
            <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
          </div>
          <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-sky-500 transition-colors">
            {linkTitle}
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {linkDesc}
          </p>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground/80 pt-1 border-t border-border/30">
          <span className="truncate">{url}</span>
          <span className="font-semibold text-sky-600 dark:text-sky-400 shrink-0 ml-2">Click to open ↗</span>
        </div>
      </div>
    </a>
  )
}

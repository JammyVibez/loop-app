"use client"

import { useState } from "react"
import { Check, Copy, GitFork } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { SyntaxHighlightedCode } from "@/components/loops/syntax-highlighted-code"

type Props = {
  code: string
  language?: string
  title?: string | null
  forksCount?: number
  className?: string
  onFork?: () => void
  forking?: boolean
  showFork?: boolean
}

export function CodeBlock({
  code,
  language = "other",
  title,
  forksCount = 0,
  className,
  onFork,
  forking,
  showFork = true,
}: Props) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border/80 bg-muted/50 text-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="shrink-0 bg-sky-500/20 text-sky-200 hover:bg-sky-500/20">
            {language}
          </Badge>
          {title ? <span className="truncate text-xs text-muted-foreground">{title}</span> : null}
          {forksCount > 0 ? (
            <span className="text-[11px] text-muted-foreground">{forksCount} fork{forksCount === 1 ? "" : "s"}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => void copy()}
          >
            {copied ? <Check className="mr-1 h-3.5 w-3.5 text-emerald-400" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          {showFork && onFork ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              disabled={forking}
              onClick={onFork}
            >
              <GitFork className="mr-1 h-3.5 w-3.5" />
              {forking ? "Forking…" : "Fork"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="max-h-[28rem] overflow-auto">
        <SyntaxHighlightedCode code={code} language={language} />
      </div>
    </div>
  )
}

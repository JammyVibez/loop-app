"use client"

import { useMemo, useState } from "react"
import { Check, Copy, GitFork } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

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
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code])

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
        "overflow-hidden rounded-xl border border-border/80 bg-[#0b1220] text-slate-100 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Badge variant="secondary" className="shrink-0 bg-sky-500/20 text-sky-200 hover:bg-sky-500/20">
            {language}
          </Badge>
          {title ? <span className="truncate text-xs text-slate-300">{title}</span> : null}
          {forksCount > 0 ? (
            <span className="text-[11px] text-slate-400">{forksCount} fork{forksCount === 1 ? "" : "s"}</span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-slate-300 hover:bg-white/10 hover:text-white"
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
              className="h-7 px-2 text-slate-300 hover:bg-white/10 hover:text-white"
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
        <pre className="m-0 p-0 text-[12px] leading-5 sm:text-[13px]">
          <code className="block min-w-full font-mono">
            {lines.map((line, i) => (
              <div key={i} className="flex hover:bg-white/[0.03]">
                <span className="sticky left-0 w-10 shrink-0 select-none border-r border-white/5 bg-[#0b1220] px-2 text-right text-slate-500">
                  {i + 1}
                </span>
                <span className="whitespace-pre px-3 text-slate-100">{line || " "}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}

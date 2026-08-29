"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoopDetailCodeBlockProps {
  language?: string
  code: string
  title?: string
}

export function LoopDetailCodeBlock({ language, code, title }: LoopDetailCodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* noop */
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-slate-950/80 backdrop-blur-md">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-red-500/80" />
            <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <div className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>
          {language && (
            <span className="text-[11px] font-mono font-semibold text-emerald-400/80 uppercase tracking-wider">
              {language}
            </span>
          )}
          {title && (
            <span className="text-[11px] text-white/40 font-mono truncate max-w-[200px]">
              {title}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white/90 transition-colors rounded-lg px-2 py-1 hover:bg-white/10"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono text-slate-200/90">
        <code>{code}</code>
      </pre>
    </div>
  )
}

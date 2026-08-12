"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content) return null

  return (
    <div className={cn("prose dark:prose-invert max-w-none text-sm leading-relaxed min-w-0 break-words", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-black text-foreground border-b border-border/60 pb-1 mt-2 mb-1.5">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-extrabold text-foreground mt-2 mb-1">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-bold text-foreground mt-1.5 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-1 last:mb-0 leading-relaxed whitespace-pre-wrap">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
          del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-amber-500/80 bg-amber-500/10 pl-3 py-1 my-2 rounded-r-lg italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName
            if (isInline) {
              return (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-cyan-600 dark:text-cyan-300 border border-border">
                  {children}
                </code>
              )
            }
            return (
              <pre className="rounded-xl bg-slate-950 p-3 overflow-x-auto text-xs font-mono border border-border my-2 text-slate-100">
                <code {...props} className={codeClassName}>
                  {children}
                </code>
              </pre>
            )
          },
          hr: () => <hr className="my-3 border-t border-border" />,
          ul: ({ children }) => <ul className="list-disc list-inside my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-1.5 space-y-0.5">{children}</ol>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

"use client"

import { Highlight, Prism, themes, type Language } from "prism-react-renderer"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

// prism-react-renderer only bundles a small default grammar set (js/ts/jsx/tsx,
// python, go, rust, kotlin, swift, sql, json, markdown, css, c/cpp, yaml…).
// Register the extra languages our own language picker (lib/pro-features.ts
// CODE_LANGUAGES) offers but the default bundle is missing, using the full
// prismjs package's component files, which self-register onto this shared
// Prism instance.
if (typeof window !== "undefined") {
  ;(window as any).Prism = Prism
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("prismjs/components/prism-bash")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("prismjs/components/prism-java")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("prismjs/components/prism-php")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("prismjs/components/prism-ruby")
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("prismjs/components/prism-csharp")
}

/** Maps our own language ids (lib/pro-features.ts CODE_LANGUAGES) to Prism grammar names. */
const LANGUAGE_ALIASES: Record<string, Language> = {
  shell: "bash",
  other: "tsx",
  none: "tsx",
  "c++": "cpp",
  "c#": "csharp",
  "node.js": "javascript",
  nodejs: "javascript",
  vue: "markup",
  html: "markup",
}

export function normalizePrismLanguage(language?: string | null): Language {
  const key = (language || "").toLowerCase().trim()
  return (LANGUAGE_ALIASES[key] || (key as Language)) || "tsx"
}

interface SyntaxHighlightedCodeProps {
  code: string
  language?: string | null
  className?: string
  /** Only render the first N lines (used for collapsed previews). */
  maxLines?: number
  showLineNumbers?: boolean
}

/**
 * Shared real syntax highlighter for anywhere code is previewed — Loop code
 * posts, the Developer Hub gallery, and Co-Loop code snippets — so "code
 * preview" means an actually colorized, language-aware view instead of a
 * flat monospace block.
 */
export function SyntaxHighlightedCode({
  code,
  language,
  className,
  maxLines,
  showLineNumbers = true,
}: SyntaxHighlightedCodeProps) {
  const { resolvedTheme } = useTheme()
  const prismLanguage = normalizePrismLanguage(language)
  const allLines = code.replace(/\n$/, "").split("\n")
  const truncated = typeof maxLines === "number" && allLines.length > maxLines
  const visibleCode = truncated ? allLines.slice(0, maxLines).join("\n") : code

  const theme = resolvedTheme === "dark" ? themes.vsDark : themes.vsLight

  return (
    <Highlight code={visibleCode.replace(/\n$/, "")} language={prismLanguage} theme={theme}>
      {({ className: prismClassName, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(prismClassName, "m-0 overflow-x-auto p-0 text-[12px] leading-5 sm:text-[13px]", className)}
          style={{ ...style, backgroundColor: "transparent" }}
        >
          <code className="block min-w-full font-mono">
            {tokens.map((line, i) => {
              const { className: lineClassName, ...lineProps } = getLineProps({ line })
              return (
                <div key={i} className={cn(lineClassName, "flex hover:bg-muted/50")} {...lineProps}>
                  {showLineNumbers && (
                    <span className="sticky left-0 w-10 shrink-0 select-none border-r border-border bg-muted/50 px-2 text-right text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <span className="whitespace-pre px-3">
                    {line.map((token, key) => {
                      const { className: tokenClassName, ...tokenProps } = getTokenProps({ token })
                      return <span key={key} className={tokenClassName} {...tokenProps} />
                    })}
                  </span>
                </div>
              )
            })}
            {truncated && (
              <div className="flex px-3 py-1 text-muted-foreground">
                {showLineNumbers && <span className="w-10 shrink-0" />}
                … {allLines.length - maxLines!} more lines
              </div>
            )}
          </code>
        </pre>
      )}
    </Highlight>
  )
}

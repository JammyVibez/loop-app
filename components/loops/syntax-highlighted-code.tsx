"use client"

import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import c from "react-syntax-highlighter/dist/esm/languages/prism/c"
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import css from "react-syntax-highlighter/dist/esm/languages/prism/css"
import go from "react-syntax-highlighter/dist/esm/languages/prism/go"
import java from "react-syntax-highlighter/dist/esm/languages/prism/java"
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx"
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin"
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown"
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup"
import php from "react-syntax-highlighter/dist/esm/languages/prism/php"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby"
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust"
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql"
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift"
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml"
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark"
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

// react-syntax-highlighter's PrismLight build (backed by refractor, which
// pre-resolves each grammar's dependency graph) avoids the crash we hit with
// prism-react-renderer + raw prismjs component files ("Cannot read
// properties of undefined (reading 'tokenizePlaceholders')") — that error
// came from mixing two independently-bundled copies of Prism's internal
// engine, where the markup grammar's placeholder-tokenizing helper existed
// on one copy but not the other.
SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("c", c)
SyntaxHighlighter.registerLanguage("cpp", cpp)
SyntaxHighlighter.registerLanguage("csharp", csharp)
SyntaxHighlighter.registerLanguage("css", css)
SyntaxHighlighter.registerLanguage("go", go)
SyntaxHighlighter.registerLanguage("java", java)
SyntaxHighlighter.registerLanguage("javascript", javascript)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("jsx", jsx)
SyntaxHighlighter.registerLanguage("kotlin", kotlin)
SyntaxHighlighter.registerLanguage("markdown", markdown)
SyntaxHighlighter.registerLanguage("markup", markup)
SyntaxHighlighter.registerLanguage("php", php)
SyntaxHighlighter.registerLanguage("python", python)
SyntaxHighlighter.registerLanguage("ruby", ruby)
SyntaxHighlighter.registerLanguage("rust", rust)
SyntaxHighlighter.registerLanguage("sql", sql)
SyntaxHighlighter.registerLanguage("swift", swift)
SyntaxHighlighter.registerLanguage("tsx", tsx)
SyntaxHighlighter.registerLanguage("typescript", typescript)
SyntaxHighlighter.registerLanguage("yaml", yaml)

/** Maps our own language ids (lib/pro-features.ts CODE_LANGUAGES) to registered grammar names. */
const LANGUAGE_ALIASES: Record<string, string> = {
  shell: "bash",
  other: "tsx",
  none: "tsx",
  html: "markup",
  vue: "markup",
  "c++": "cpp",
  "c#": "csharp",
  "node.js": "javascript",
  nodejs: "javascript",
  js: "javascript",
  ts: "typescript",
  py: "python",
  yml: "yaml",
}

const REGISTERED = new Set([
  "bash", "c", "cpp", "csharp", "css", "go", "java", "javascript", "json",
  "jsx", "kotlin", "markdown", "markup", "php", "python", "ruby", "rust",
  "sql", "swift", "tsx", "typescript", "yaml",
])

export function normalizeCodeLanguage(language?: string | null): string {
  const key = (language || "").toLowerCase().trim()
  const resolved = LANGUAGE_ALIASES[key] || key
  return REGISTERED.has(resolved) ? resolved : "tsx"
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
  const prismLanguage = normalizeCodeLanguage(language)
  const allLines = code.replace(/\n$/, "").split("\n")
  const truncated = typeof maxLines === "number" && allLines.length > maxLines
  const visibleCode = (truncated ? allLines.slice(0, maxLines).join("\n") : code).replace(/\n$/, "")

  return (
    <div className={cn("text-[12px] leading-5 sm:text-[13px]", className)}>
      <SyntaxHighlighter
        language={prismLanguage}
        style={resolvedTheme === "dark" ? oneDark : oneLight}
        showLineNumbers={showLineNumbers}
        wrapLongLines={false}
        customStyle={{
          margin: 0,
          padding: "0.75rem 0",
          background: "transparent",
          fontSize: "inherit",
          lineHeight: "inherit",
        }}
        codeTagProps={{ style: { fontFamily: "inherit" } }}
      >
        {visibleCode}
      </SyntaxHighlighter>
      {truncated && (
        <div className="px-3 pb-2 text-muted-foreground">… {allLines.length - maxLines!} more lines</div>
      )}
    </div>
  )
}

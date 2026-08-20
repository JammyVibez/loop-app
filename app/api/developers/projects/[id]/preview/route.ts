import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

/** Fetch a URL and return text, returning null on failure */
async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

/** Build a file map from file_tree and files arrays */
function buildFileMap(fileTree: any[], files: any[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of fileTree) {
    if (f.url && (f.path || f.name)) {
      const key = (f.path || f.name).replace(/^\//, "")
      map[key] = f.url
      // Also map just the filename for simple references
      const basename = key.split("/").pop()
      if (basename && !map[basename]) map[basename] = f.url
    }
  }
  for (const f of files) {
    if (f.url && f.name) {
      if (!map[f.name]) map[f.name] = f.url
    }
  }
  return map
}

/** Resolve a relative path from an HTML file's context */
function resolvePath(from: string, relative: string): string {
  if (relative.startsWith("/")) return relative.slice(1)
  const dir = from.includes("/") ? from.substring(0, from.lastIndexOf("/") + 1) : ""
  const parts = (dir + relative).split("/")
  const resolved: string[] = []
  for (const p of parts) {
    if (p === "..") resolved.pop()
    else if (p !== "." && p !== "") resolved.push(p)
  }
  return resolved.join("/")
}

/** Replace script src= and link href= references with inlined content */
function inlineAssets(html: string, fileMap: Record<string, string>, basePath: string): string {
  let result = html

  // Inline <script src="...">
  result = result.replace(/<script([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi,
    (_match, pre, src, post) => {
      const resolved = resolvePath(basePath, src)
      const content = fileMap[resolved]
      if (content) {
        // Fetch will be done separately; mark for replacement
        return `<script${pre}data-resolved-src="${encodeURIComponent(content)}"${post}>`
      }
      return `<script${pre}src="${src}"${post}>`
    }
  )

  // Inline <link rel="stylesheet" href="...">
  result = result.replace(/<link([^>]*)\bhref=["']([^"']+\.css[^"']*)["']([^>]*)>/gi,
    (_match, pre, href, post) => {
      const resolved = resolvePath(basePath, href)
      const content = fileMap[resolved]
      if (content) {
        return `<link${pre}data-resolved-href="${encodeURIComponent(content)}"${post}>`
      }
      return `<link${pre}href="${href}"${post}>`
    }
  )

  return result
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: project, error } = await supabase
      .from("developer_projects")
      .select("id, title, files, file_tree, code_snippet, language, framework")
      .eq("id", id)
      .single()

    if (error || !project) {
      return new NextResponse("<html><body><h2>Project not found</h2></body></html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      })
    }

    const files = project.files || []
    const fileTree = project.file_tree || []
    const fileMap = buildFileMap(fileTree, files)

    // 1. Find index.html
    let indexHtml = ""
    let basePath = ""
    const indexCandidates = ["index.html", "src/index.html", "public/index.html", "dist/index.html", "src/main.html"]
    for (const candidate of indexCandidates) {
      if (fileMap[candidate]) {
        indexHtml = await fetchText(fileMap[candidate]) || ""
        basePath = candidate.includes("/") ? candidate.substring(0, candidate.lastIndexOf("/") + 1) : ""
        break
      }
    }

    // 2. If no index.html, look for main HTML files
    if (!indexHtml) {
      for (const [path, url] of Object.entries(fileMap)) {
        if (path.endsWith(".html") && !path.endsWith(".css")) {
          indexHtml = await fetchText(url) || ""
          basePath = path.includes("/") ? path.substring(0, path.lastIndexOf("/") + 1) : ""
          break
        }
      }
    }

    // 3. If we have HTML, inline all referenced assets
    if (indexHtml) {
      indexHtml = inlineAssets(indexHtml, fileMap, basePath)

      // Fetch and inline all data-resolved-src scripts
      const scriptMatches = [...indexHtml.matchAll(/data-resolved-src="([^"]+)"/g)]
      for (const match of scriptMatches) {
        const url = decodeURIComponent(match[1])
        const content = await fetchText(url)
        if (content) {
          indexHtml = indexHtml.replace(
            match[0],
            `>${content}</script>`
          )
        } else {
          indexHtml = indexHtml.replace(match[0], `>/* Failed to load: ${url} */</script>`)
        }
      }

      // Fetch and inline all data-resolved-href stylesheets
      const linkMatches = [...indexHtml.matchAll(/data-resolved-href="([^"]+)"/g)]
      for (const match of linkMatches) {
        const url = decodeURIComponent(match[1])
        const content = await fetchText(url)
        if (content) {
          indexHtml = indexHtml.replace(
            match[0],
            `>\n<style>/* Inlined from ${url.split("/").pop()} */\n${content}\n</style>`
          )
        }
      }

      return new NextResponse(indexHtml, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=300",
          "X-Frame-Options": "ALLOWALL",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }

    // 4. No HTML files — build from code snippet
    if (project.code_snippet) {
      const lang = (project.language || "").toLowerCase()
      const framework = (project.framework || "").toLowerCase()
      const title = escapeHtml(project.title || "Preview")

      if (lang === "html" || lang === "htm") {
        return new NextResponse(project.code_snippet, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
        })
      }

      if (framework === "react" || lang === "javascript" || lang === "typescript") {
        const html = buildReactPreview(project.code_snippet, title)
        return new NextResponse(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
        })
      }

      if (lang === "css") {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>${project.code_snippet}</style></head><body><div class="preview-container"><p style="padding:16px;color:#666;font-family:system-ui;">CSS preview — styles applied to this page.</p></div></body></html>`
        return new NextResponse(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
        })
      }

      // Generic code view
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:'SF Mono',Monaco,'Cascadia Code',monospace;background:#1e1e2e;color:#cdd6f4;padding:24px}pre{white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:14px}.header{color:#89b4fa;margin-bottom:16px;font-size:12px;opacity:.7}</style></head><body><div class="header">${escapeHtml(project.language || "Code")} — ${title}</div><pre>${escapeHtml(project.code_snippet)}</pre></body></html>`
      return new NextResponse(html, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
      })
    }

    // 5. Nothing to preview
    return new NextResponse(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;text-align:center;color:#888"><h2>No preview available</h2><p>This project doesn't have previewable content yet.</p></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (err: any) {
    return new NextResponse(`<html><body><h2>Error: ${escapeHtml(err.message)}</h2></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    })
  }
}

function buildReactPreview(code: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${code}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    if (typeof App !== 'undefined') root.render(React.createElement(App));
    else if (typeof app !== 'undefined') root.render(React.createElement(app));
    else root.render(React.createElement('div', {style:{padding:40,textAlign:'center'}}, 'No App component found. Export a default App component.'));
  <\/script>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

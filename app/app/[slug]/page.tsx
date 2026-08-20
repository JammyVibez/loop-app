import { type NextRequest } from "next/server"
import { createServerClient } from "@/lib/supabase"

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me"

export const dynamic = "force-dynamic"

/** Fetch a URL and return text, returning null on failure */
async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return await res.text()
  } catch { return null }
}

function buildFileMap(fileTree: any[], files: any[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const f of fileTree) {
    if (f.url && (f.path || f.name)) {
      const key = (f.path || f.name).replace(/^\//, "")
      map[key] = f.url
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

function inlineAssets(html: string, fileMap: Record<string, string>, basePath: string): string {
  let result = html
  result = result.replace(/<script([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi,
    (_match, pre, src, post) => {
      const resolved = resolvePath(basePath, src)
      const content = fileMap[resolved]
      if (content) return `<script${pre}data-resolved-src="${encodeURIComponent(content)}"${post}>`
      return `<script${pre}src="${src}"${post}>`
    }
  )
  result = result.replace(/<link([^>]*)\bhref=["']([^"']+\.css[^"']*)["']([^>]*)>/gi,
    (_match, pre, href, post) => {
      const resolved = resolvePath(basePath, href)
      const content = fileMap[resolved]
      if (content) return `<link${pre}data-resolved-href="${encodeURIComponent(content)}"${post}>`
      return `<link${pre}href="${href}"${post}>`
    }
  )
  return result
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const supabase = createServerClient()
    const { data: project, error } = await supabase
      .from("developer_projects")
      .select("id, title, files, file_tree, code_snippet, language, framework, is_published, subdomain")
      .eq("subdomain", slug)
      .eq("is_published", true)
      .maybeSingle()

    if (error || !project) {
      return new Response(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:60px;text-align:center">
        <h1 style="font-size:48px;margin-bottom:16px">404</h1>
        <p style="color:#666">This app hasn't been published yet or doesn't exist.</p>
        <a href="/" style="color:#6366f1;margin-top:24px;display:inline-block">Go to Loop</a>
      </body></html>`, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    const fileMap = buildFileMap(project.file_tree || [], project.files || [])

    // Find index.html
    let indexHtml = ""
    let basePath = ""
    const indexCandidates = ["index.html", "src/index.html", "public/index.html", "dist/index.html"]
    for (const candidate of indexCandidates) {
      if (fileMap[candidate]) {
        indexHtml = await fetchText(fileMap[candidate]) || ""
        basePath = candidate.includes("/") ? candidate.substring(0, candidate.lastIndexOf("/") + 1) : ""
        break
      }
    }

    if (!indexHtml) {
      for (const [path, url] of Object.entries(fileMap)) {
        if (path.endsWith(".html") && !path.endsWith(".css")) {
          indexHtml = await fetchText(url) || ""
          basePath = path.includes("/") ? path.substring(0, path.lastIndexOf("/") + 1) : ""
          break
        }
      }
    }

    if (indexHtml) {
      indexHtml = inlineAssets(indexHtml, fileMap, basePath)

      // Inline scripts
      const scriptMatches = [...indexHtml.matchAll(/data-resolved-src="([^"]+)"/g)]
      for (const match of scriptMatches) {
        const url = decodeURIComponent(match[1])
        const content = await fetchText(url)
        if (content) {
          indexHtml = indexHtml.replace(match[0], `>${content}</script>`)
        } else {
          indexHtml = indexHtml.replace(match[0], `>/* Failed to load */</script>`)
        }
      }

      // Inline CSS
      const linkMatches = [...indexHtml.matchAll(/data-resolved-href="([^"]+)"/g)]
      for (const match of linkMatches) {
        const url = decodeURIComponent(match[1])
        const content = await fetchText(url)
        if (content) {
          indexHtml = indexHtml.replace(match[0], `>\n<style>${content}</style>`)
        }
      }

      return new Response(indexHtml, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
      })
    }

    // Fallback: React preview from code snippet
    if (project.code_snippet) {
      const lang = (project.language || "").toLowerCase()
      const framework = (project.framework || "").toLowerCase()
      const title = escapeHtml(project.title || "App")

      if (lang === "html" || lang === "htm") {
        return new Response(project.code_snippet, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      }

      if (framework === "react" || lang === "javascript" || lang === "typescript") {
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
          <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin><\/script>
          <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin><\/script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
          <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui}#root{min-height:100vh}</style></head>
          <body><div id="root"></div><script type="text/babel">${project.code_snippet}
          const root=ReactDOM.createRoot(document.getElementById('root'));
          if(typeof App!=='undefined')root.render(React.createElement(App));
          else if(typeof app!=='undefined')root.render(React.createElement(app));<\/script></body></html>`
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
      }
    }

    return new Response(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:60px;text-align:center">
      <h2>App is published but has no renderable content</h2>
      <p style="color:#666">The owner needs to add HTML files or a code snippet.</p>
      <a href="/" style="color:#6366f1;margin-top:24px;display:inline-block">Go to Loop</a>
    </body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } })

  } catch (err: any) {
    return new Response(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:60px;text-align:center">
      <h2>Error loading app</h2><p style="color:#666">${escapeHtml(err.message)}</p>
    </body></html>`, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } })
  }
}

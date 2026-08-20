import { createServerClient } from "@/lib/supabase"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

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
    if (f.url && f.name && !map[f.name]) map[f.name] = f.url
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
    (_m, pre, src, post) => {
      const resolved = resolvePath(basePath, src)
      const url = fileMap[resolved]
      return url ? `<script${pre}data-inlined-src="${encodeURIComponent(url)}"${post}>` : `<script${pre}src="${src}"${post}>`
    }
  )
  result = result.replace(/<link([^>]*)\bhref=["']([^"']+\.css[^"']*)["']([^>]*)>/gi,
    (_m, pre, href, post) => {
      const resolved = resolvePath(basePath, href)
      const url = fileMap[resolved]
      return url ? `<link${pre}data-inlined-href="${encodeURIComponent(url)}"${post}>` : `<link${pre}href="${href}"${post}>`
    }
  )
  return result
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export default async function PublishedAppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const supabase = createServerClient()
  const { data: project, error } = await supabase
    .from("developer_projects")
    .select("id, title, files, file_tree, code_snippet, language, framework, is_published, subdomain")
    .eq("subdomain", slug)
    .eq("is_published", true)
    .maybeSingle()

  if (error || !project) notFound()

  const fileMap = buildFileMap(project.file_tree || [], project.files || [])

  // Find index.html
  let indexHtml = ""
  let basePath = ""
  for (const candidate of ["index.html", "src/index.html", "public/index.html", "dist/index.html"]) {
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
    for (const m of [...indexHtml.matchAll(/data-inlined-src="([^"]+)"/g)]) {
      const content = await fetchText(decodeURIComponent(m[1]))
      indexHtml = indexHtml.replace(m[0], `>${content || "/* load failed */"}</script>`)
    }
    // Inline CSS
    for (const m of [...indexHtml.matchAll(/data-inlined-href="([^"]+)"/g)]) {
      const content = await fetchText(decodeURIComponent(m[1]))
      indexHtml = indexHtml.replace(m[0], `>\n<style>${content || ""}</style>`)
    }
    return <div dangerouslySetInnerHTML={{ __html: indexHtml }} />
  }

  // Fallback: code snippet
  if (project.code_snippet) {
    const lang = (project.language || "").toLowerCase()
    const fw = (project.framework || "").toLowerCase()
    const title = escapeHtml(project.title || "App")

    if (lang === "html" || lang === "htm") {
      return <div dangerouslySetInnerHTML={{ __html: project.code_snippet }} />
    }

    if (fw === "react" || lang === "javascript" || lang === "typescript") {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui}#root{min-height:100vh}</style></head>
<body><div id="root"></div><script type="text/babel">${project.code_snippet}
const root=ReactDOM.createRoot(document.getElementById('root'));
if(typeof App!=='undefined')root.render(React.createElement(App));
else if(typeof app!=='undefined')root.render(React.createElement(app));</script></body></html>`
      return <div dangerouslySetInnerHTML={{ __html: html }} />
    }
  }

  notFound()
}

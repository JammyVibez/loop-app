import { type } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
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
  if (relative.startsWith("/") || relative.startsWith("http")) return relative
  const dir = from.includes("/") ? from.substring(0, from.lastIndexOf("/") + 1) : ""
  const parts = (dir + relative).split("/")
  const resolved: string[] = []
  for (const p of parts) {
    if (p === "..") resolved.pop()
    else if (p !== "." && p !== "") resolved.push(p)
  }
  return resolved.join("/")
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function buildReactPreview(code: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
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
    else {
      // Try to find any function component
      const fns = Object.values(window).filter(v => typeof v === 'function' && v.toString().includes('jsx') || (v && typeof v === 'function' && v.prototype && v.prototype.isReactComponent));
      if (fns.length > 0) root.render(React.createElement(fns[0]));
      else root.render(React.createElement('div', {style:{padding:40,textAlign:'center',color:'#888'}}, 'No App component found. Export a default App function.'));
    }
  <\/script>
</body>
</html>`
}

function buildJSPreview(code: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #e2e8f0; }
    #output { padding: 20px; white-space: pre-wrap; font-family: 'SF Mono', Monaco, monospace; font-size: 14px; line-height: 1.6; }
    .log { color: #94a3b8; }
    .error { color: #f87171; }
    .result { color: #34d399; }
  </style>
</head>
<body>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;
    function append(cls, ...args) {
      const div = document.createElement('div');
      div.className = cls;
      div.textContent = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
      output.appendChild(div);
    }
    console.log = (...a) => { origLog(...a); append('log', ...a); };
    console.error = (...a) => { origError(...a); append('error', ...a); };
    console.warn = (...a) => { origWarn(...a); append('log', ...a); };
    window.onerror = (msg, src, line, col, err) => {
      append('error', 'Error: ' + msg + (line ? ' (line ' + line + ')' : ''));
    };
    try {
      ${code}
      if (typeof result !== 'undefined') append('result', 'Result: ' + result);
    } catch(e) {
      append('error', 'Error: ' + e.message);
    }
  <\/script>
</body>
</html>`
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

    const fileMap = buildFileMap(project.file_tree || [], project.files || [])
    const hasFiles = Object.keys(fileMap).length > 0

    // 1. If we have files from ZIP, try to find and render index.html with inlined assets
    if (hasFiles) {
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
        // Replace script src with data attribute for inlining
        indexHtml = indexHtml.replace(/<script([^>]*)\bsrc=["']([^"']+)["']([^>]*)>/gi,
          (_m, pre, src, post) => {
            if (src.startsWith("http")) return `<script${pre}src="${src}"${post}>`
            const resolved = resolvePath(basePath, src)
            const url = fileMap[resolved]
            return url ? `<script${pre}data-load="${encodeURIComponent(url)}"${post}>` : `<script${pre}src="${src}"${post}>`
          }
        )
        // Replace link href for CSS
        indexHtml = indexHtml.replace(/<link([^>]*)\bhref=["']([^"']+\.css[^"']*)["']([^>]*)>/gi,
          (_m, pre, href, post) => {
            if (href.startsWith("http")) return `<link${pre}href="${href}"${post}>`
            const resolved = resolvePath(basePath, href)
            const url = fileMap[resolved]
            if (!url) return `<link${pre}href="${href}"${post}>`
            return `<link${pre}data-load-css="${encodeURIComponent(url)}"${post}>`
          }
        )

        // Fetch and inline all data-load scripts
        const scriptMatches = [...indexHtml.matchAll(/data-load="([^"]+)"/g)]
        for (const match of scriptMatches) {
          const url = decodeURIComponent(match[1])
          const content = await fetchText(url)
          if (content) {
            indexHtml = indexHtml.replace(match[0], `>${content}</script>`)
          } else {
            indexHtml = indexHtml.replace(match[0], `>/* Failed to load: ${escapeHtml(url)} */</script>`)
          }
        }

        // Fetch and inline all data-load-css stylesheets
        const cssMatches = [...indexHtml.matchAll(/data-load-css="([^"]+)"/g)]
        for (const match of cssMatches) {
          const url = decodeURIComponent(match[1])
          const content = await fetchText(url)
          if (content) {
            indexHtml = indexHtml.replace(match[0], `>\n<style>/* Inlined */\n${content}\n</style>`)
          }
        }

        return new NextResponse(indexHtml, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }
    }

    // 2. No files or no HTML found — build from code snippet
    if (project.code_snippet) {
      const lang = (project.language || "").toLowerCase()
      const framework = (project.framework || "").toLowerCase()
      const title = project.title || "Preview"

      if (lang === "html" || lang === "htm") {
        return new NextResponse(project.code_snippet, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
        })
      }

      if (framework === "react" || lang === "javascript" || lang === "typescript") {
        const html = framework === "react" || lang === "typescript" || project.code_snippet.includes("jsx") || project.code_snippet.includes("React")
          ? buildReactPreview(project.code_snippet, title)
          : buildJSPreview(project.code_snippet, title)
        return new NextResponse(html, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
        })
      }

      if (lang === "css") {
        return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${project.code_snippet}</style></head><body><div class="preview-container"><p style="padding:16px;color:#666;font-family:system-ui;">CSS preview — styles applied to this page.</p></div></body></html>`, {
          headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
        })
      }

      // Generic code view
      return new NextResponse(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:'SF Mono',Monaco,'Cascadia Code',monospace;background:#1e1e2e;color:#cdd6f4;padding:24px}pre{white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:14px}.header{color:#89b4fa;margin-bottom:16px;font-size:12px;opacity:.7}</style></head><body><div class="header">${escapeHtml(project.language || "Code")} — ${escapeHtml(title)}</div><pre>${escapeHtml(project.code_snippet)}</pre></body></html>`, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
      })
    }

    // 3. Nothing to preview
    return new NextResponse(`<!DOCTYPE html><html><body style="font-family:system-ui;padding:40px;text-align:center;color:#888"><h2>No preview available</h2><p>Add a code snippet or upload a ZIP file to preview your project.</p></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  } catch (err: any) {
    return new NextResponse(`<html><body><h2>Error: ${escapeHtml(err.message)}</h2></body></html>`, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    })
  }
}

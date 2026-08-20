import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder"
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: project, error } = await supabase
      .from("developer_projects")
      .select("id, title, files, file_tree, code_snippet, language, framework, is_published, subdomain")
      .eq("id", id)
      .single()

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Find HTML files in the project
    const files = project.files || []
    const fileTree = project.file_tree || []

    // Look for index.html in file tree
    let indexHtml = ""
    let projectFiles: Record<string, string> = {}

    // Build file map from file_tree (these have URLs we can fetch)
    for (const f of fileTree) {
      if (f.url && f.path) {
        projectFiles[f.path] = f.url
      }
    }

    // Also check files array
    for (const f of files) {
      if (f.url && f.name) {
        projectFiles[f.name] = f.url
      }
    }

    // Find index.html
    const indexCandidates = ["index.html", "src/index.html", "public/index.html", "dist/index.html"]
    for (const candidate of indexCandidates) {
      if (projectFiles[candidate]) {
        indexHtml = projectFiles[candidate]
        break
      }
    }

    // If no index.html found, build a preview from the code snippet
    if (!indexHtml && project.code_snippet) {
      const lang = (project.language || "").toLowerCase()
      const framework = (project.framework || "").toLowerCase()

      if (lang === "html" || lang === "htm") {
        // Code snippet IS the HTML
        indexHtml = null as any // Will use code_snippet directly
      } else if (framework === "react" || lang === "javascript" || lang === "typescript") {
        // Create a React preview wrapper
        indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${project.title || "Preview"}</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${project.code_snippet}
    const root = ReactDOM.createRoot(document.getElementById('root'));
    if (typeof App !== 'undefined') root.render(React.createElement(App));
    else if (typeof app !== 'undefined') root.render(React.createElement(app));
  </script>
</body>
</html>`
      } else if (lang === "css") {
        indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${project.title || "CSS Preview"}</title>
  <style>${project.code_snippet}</style>
</head>
<body>
  <div class="preview-container">
    <p style="padding:16px;color:#666;font-family:system-ui;">CSS preview — styles applied to this page.</p>
  </div>
</body>
</html>`
      } else {
        // Generic code preview
        indexHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${project.title || "Code Preview"}</title>
  <style>
    body { font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; background: #1e1e2e; color: #cdd6f4; padding: 24px; }
    pre { white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 14px; }
    .header { color: #89b4fa; margin-bottom: 16px; font-size: 12px; opacity: 0.7; }
  </style>
</head>
<body>
  <div class="header">${project.language || "Code"} — ${project.title}</div>
  <pre>${escapeHtml(project.code_snippet)}</pre>
</body>
</html>`
      }
    }

    // If we have an index.html URL, fetch its content
    let htmlContent = ""
    if (indexHtml && indexHtml.startsWith("http")) {
      try {
        const res = await fetch(indexHtml)
        htmlContent = await res.text()
      } catch {
        htmlContent = `<html><body><p>Could not load preview</p></body></html>`
      }
    } else if (indexHtml === null) {
      // Use code_snippet directly as HTML
      htmlContent = project.code_snippet || ""
    } else if (indexHtml) {
      htmlContent = indexHtml
    } else {
      htmlContent = `<html><body style="font-family:system-ui;padding:40px;text-align:center;color:#666;">
        <h2>No preview available</h2>
        <p>This project doesn't have previewable HTML content.</p>
      </body></html>`
    }

    return new NextResponse(htmlContent, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Frame-Options": "ALLOWALL",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

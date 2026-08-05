"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { CodeLoopCard } from "@/components/developers/code-loop-card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"

function normalizeProject(row: any) {
  return {
    id: row.id,
    author_id: row.author_id || row.author?.id,
    title: row.title,
    description: row.description,
    author: row.author || { username: "unknown", display_name: "Unknown", avatar_url: null },
    language: row.language,
    framework: row.framework || "None",
    tags: row.tags || [],
    stats: {
      stars: Number(row.stars || 0),
      forks: Number(row.forks || 0),
      views: Number(row.views || 0),
      branches: Number(row.branches || 0),
    },
    code_snippet: row.code_snippet || "",
    files: Array.isArray(row.files) ? row.files : [],
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
  }
}

export default function DeveloperProjectPage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const [project, setProject] = useState<ReturnType<typeof normalizeProject> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/developers/projects/${id}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Project not found")
        if (!cancelled) setProject(normalizeProject(data.project))
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Couldn't load project")
          setProject(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-6">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <Link href="/developers">
            <ArrowLeft className="h-4 w-4" />
            Back to Developers
          </Link>
        </Button>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading project…
          </div>
        ) : error || !project ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <h1 className="text-xl font-semibold">Project not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error || "This project may have been deleted."}</p>
            <Button asChild className="mt-4 rounded-full">
              <Link href="/developers">Browse projects</Link>
            </Button>
          </div>
        ) : (
          <CodeLoopCard
            project={project}
            onDeleted={() => {
              window.location.href = "/developers"
            }}
          />
        )}
      </main>
    </div>
  )
}

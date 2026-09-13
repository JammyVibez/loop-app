"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/header"
import { ProjectDetail } from "@/components/developers/project-detail"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

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
    file_tree: Array.isArray(row.file_tree) ? row.file_tree : [],
    repo_zip_url: row.repo_zip_url || null,
    forked_from_id: row.forked_from_id || null,
    is_public: row.is_public !== false,
    published_listing: row.published_listing || null,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
  }
}

export default function DeveloperProjectPage() {
  const params = useParams()
  const id = typeof params?.id === "string" ? params.id : ""
  const [project, setProject] = useState<any | null>(null)
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
        if (!cancelled) setProject({ ...normalizeProject(data.project), published_listing: data.project?.published_listing || null })
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
            <Spinner className="h-4 w-4" /> Loading project…
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
          <ProjectDetail project={project} />
        )}
      </main>
    </div>
  )
}

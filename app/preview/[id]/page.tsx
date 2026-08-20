"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Loader2, Maximize2, Minimize2, RotateCcw, Lock } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"

export default function PreviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [fullscreen, setFullscreen] = useState(false)
  const [key, setKey] = useState(0)

  const isPro = Boolean(user?.is_premium)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    // Verify the project exists by fetching metadata
    fetch(`/api/developers/projects/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Project not found")
        const data = await res.json()
        setTitle(data.project?.title || "Preview")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading preview…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium">Preview unavailable</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/developers"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Developer Hub</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!isPro) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <p className="text-lg font-semibold">Pro Feature</p>
          <p className="text-sm text-muted-foreground">Project preview is available for Pro users only. Upgrade to preview and publish your projects.</p>
          <Button asChild variant="outline" size="sm">
            <Link href="/developers"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Developer Hub</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col ${fullscreen ? "fixed inset-0 z-50 bg-background" : "min-h-screen bg-background"}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-card shrink-0">
        <div className="flex items-center gap-3">
          {!fullscreen && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link href="/developers">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
          )}
          <div className="h-4 w-px bg-border" />
          <span className="text-sm font-medium truncate max-w-[200px]">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKey((k) => k + 1)}
            title="Refresh"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a href={`/api/developers/projects/${id}/preview`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 relative">
        <iframe
          key={key}
          src={`/api/developers/projects/${id}/preview`}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={title || "Project Preview"}
          allow="accelerometer; camera; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; usb; web-share"
        />
      </div>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function SubdomainPage() {
  const params = useParams()
  const slug = params?.slug as string
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    // Look up the project by subdomain
    fetch(`/api/developers/projects/by-subdomain/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("App not found")
        const data = await res.json()
        if (data.project?.id) {
          // Fetch the preview HTML
          const previewRes = await fetch(`/api/developers/projects/${data.project.id}/preview`)
          if (!previewRes.ok) throw new Error("Preview unavailable")
          const htmlContent = await previewRes.text()
          setHtml(htmlContent)
        } else {
          throw new Error("App not found")
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error || !html) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">App Not Found</h1>
          <p className="text-muted-foreground">No published app found at <strong>{slug}.loopapp.me</strong></p>
        </div>
      </div>
    )
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      className="min-h-screen"
    />
  )
}

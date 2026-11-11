"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, Maximize2, Minimize2, RotateCcw, Lock, Database, AlertTriangle } from "@/components/icons/lucide-compat"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Spinner } from "@/components/ui/skeletons"

export default function PreviewPage() {
  const params = useParams()
  const id = params?.id as string
  const { user, getAuthHeader } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  const [setupResult, setSetupResult] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [fullscreen, setFullscreen] = useState(false)
  const [key, setKey] = useState(0)

  const isPro = Boolean(user?.is_premium)

  const fetchProject = () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setNeedsSetup(false)
    fetch(`/api/developers/projects/${id}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.status === 503 && data.needsSetup) {
          setNeedsSetup(true)
          throw new Error("Database tables not set up yet")
        }
        if (!res.ok) throw new Error(data.error || "Project not found")
        setTitle(data.project?.title || "Preview")
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchProject() }, [id])

  const runSetup = async () => {
    setSettingUp(true)
    setSetupResult(null)
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const auth = getAuthHeader?.()
      if (typeof auth === "string") headers["Authorization"] = auth
      else if (auth && typeof auth === "object") Object.assign(headers, auth)

      const res = await fetch("/api/developers/setup", { method: "POST", headers })
      const data = await res.json()

      if (data.success) {
        setSetupResult("Database tables created! Retrying...")
        // Retry loading the project
        setTimeout(() => { setNeedsSetup(false); fetchProject() }, 1500)
      } else if (data.sql) {
        setSetupResult("Auto-setup failed. Run this SQL in your Supabase SQL Editor, then try again.")
      } else {
        setSetupResult(data.error || "Setup failed")
      }
    } catch (e: any) {
      setSetupResult(e.message || "Setup failed")
    } finally {
      setSettingUp(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Loading preview...</p>
        </div>
      </div>
    )
  }

  if (needsSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 max-w-md px-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600">
            <Database className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-lg font-semibold">Database Setup Required</p>
            <p className="text-sm text-muted-foreground mt-2">
              The developer projects tables haven&apos;t been created in Supabase yet.
              Click below to auto-create them.
            </p>
          </div>
          {setupResult && (
            <div className={`text-sm p-3 rounded-lg ${setupResult.includes("created") ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}`}>
              <AlertTriangle className="h-4 w-4 inline mr-1.5" />
              {setupResult}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={runSetup} disabled={settingUp} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              {settingUp ? <Spinner className="mr-2 h-4 w-4" /> : <Database className="mr-2 h-4 w-4" />}
              {settingUp ? "Setting up..." : "Create Tables"}
            </Button>
            <Button asChild variant="outline">
              <Link href="/developers"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <p className="text-lg font-medium">Preview unavailable</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={fetchProject} variant="outline" size="sm">
              Retry
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/developers"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Link>
            </Button>
          </div>
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

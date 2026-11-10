"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { formatDistanceToNow } from "date-fns"
import { Film, Plus, RefreshCw, Trash2, Eye, EyeOff, Search, Link2, Upload, X } from "@/components/icons/lucide-compat"
import { Spinner } from "@/components/ui/skeletons"
import { uploadMediaFile } from "@/lib/client-media-upload"

interface CuratedGif {
  id: string
  title: string
  url: string
  preview_url?: string | null
  tags?: string[]
  source?: string
  is_active: boolean
  created_at: string
  added_by?: { username: string; display_name: string } | null
}

export function AdminGifsPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [gifs, setGifs] = useState<CuratedGif[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ title: "", url: "", preview_url: "", tags: "" })
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/gifs", { headers: getAuthHeader() })
      if (res.ok) {
        const data = await res.json()
        setGifs(data.gifs || [])
      }
    } catch (error) {
      console.error("Failed to load GIFs:", error)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const uploadFileToCloudinary = async (file: File): Promise<string | null> => {
    try {
      // GIFs are stored with original quality so their animation and palette
      // survive the move to VPS storage exactly as uploaded.
      const uploaded = await uploadMediaFile(file, {
        type: "image",
        folder: "admin-gifs",
        purpose: "gif",
        originalQuality: true,
        authHeaders: getAuthHeader(),
      })
      return uploaded.url
    } catch (err: any) {
      console.error("File upload error:", err)
      toast({ title: "Upload failed", description: err.message || "Could not upload file", variant: "destructive" })
      return null
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" })
      return
    }

    setUploadingFile(true)
    const url = await uploadFileToCloudinary(file)
    if (url) {
      setForm((f) => ({
        ...f,
        url,
        preview_url: url,
        title: f.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      }))
      toast({ title: "GIF uploaded", description: "Ready to add to the library" })
    }
    setUploadingFile(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please drop an image file", variant: "destructive" })
      return
    }
    setUploadingFile(true)
    const url = await uploadFileToCloudinary(file)
    if (url) {
      setForm((f) => ({
        ...f,
        url,
        preview_url: url,
        title: f.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      }))
      toast({ title: "GIF uploaded", description: "Ready to add to the library" })
    }
    setUploadingFile(false)
  }

  const addGif = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/gifs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: form.title,
          url: form.url,
          preview_url: form.preview_url || undefined,
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
          source: form.url.includes("/media/") || form.url.includes("cloudinary") ? "uploaded" : "custom",
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to add GIF")
      setGifs((prev) => [data.gif, ...prev])
      setForm({ title: "", url: "", preview_url: "", tags: "" })
      toast({ title: "GIF added", description: "It's live across the app's GIF pickers now." })
    } catch (error: any) {
      toast({ title: "Couldn't add GIF", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (gif: CuratedGif) => {
    setBusyId(`${gif.id}:toggle`)
    try {
      const res = await fetch("/api/admin/gifs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id: gif.id, is_active: !gif.is_active }),
      })
      if (res.ok) {
        const data = await res.json()
        setGifs((prev) => prev.map((g) => (g.id === gif.id ? data.gif : g)))
      }
    } catch (error) {
      console.error("Failed to toggle GIF:", error)
    } finally {
      setBusyId(null)
    }
  }

  const removeGif = async (gif: CuratedGif) => {
    if (
      !(await confirmDialog({
        title: `Remove "${gif.title}" from the app's GIF library?`,
        description: "It disappears from the picker immediately. Re-uploading it adds it back.",
        confirmLabel: "Remove",
        destructive: true,
      }))
    )
      return
    setBusyId(`${gif.id}:delete`)
    try {
      const res = await fetch(`/api/admin/gifs?id=${gif.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      if (res.ok) {
        setGifs((prev) => prev.filter((g) => g.id !== gif.id))
        toast({ title: "GIF removed" })
      }
    } catch (error) {
      console.error("Failed to delete GIF:", error)
    } finally {
      setBusyId(null)
    }
  }

  const filtered = gifs.filter(
    (g) =>
      !q.trim() ||
      g.title.toLowerCase().includes(q.toLowerCase()) ||
      (g.tags || []).some((t) => t.toLowerCase().includes(q.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-5 w-5" /> Add a curated GIF
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Upload from device area */}
          <div
            className={"relative mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors " + (
              dragOver
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/gif,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            {uploadingFile ? (
              <Spinner className="h-8 w-8 text-cyan-400" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  Drag & drop a GIF or image here
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  or{" "}
                  <button
                    type="button"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse your device
                  </button>
                </p>
              </>
            )}
          </div>

          <form onSubmit={addGif} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. loopapp.me Hype Train"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="hype, celebration, reaction"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">GIF URL (or paste a link)</label>
              <div className="flex gap-2">
                <Input
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://media.giphy.com/media/.../giphy.gif"
                  className="flex-1"
                  required
                />
                {form.url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setForm((f) => ({ ...f, url: "", preview_url: "" }))}
                    title="Clear URL"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Preview URL <span className="text-muted-foreground/60">(optional — falls back to GIF URL)</span>
              </label>
              <Input
                value={form.preview_url}
                onChange={(e) => setForm((f) => ({ ...f, preview_url: e.target.value }))}
                placeholder="https://media.giphy.com/media/.../giphy-preview.gif"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving || !form.title.trim() || !form.url.trim()}>
                {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                Add GIF
              </Button>
              {form.url.trim() && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" /> Live preview:
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.url} alt="" className="h-10 w-14 rounded object-cover" />
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-5 w-5" /> Curated GIF library
              <Badge variant="secondary" className="rounded-full">
                {gifs.filter((g) => g.is_active).length} active
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search GIFs…" className="h-9 w-52 pl-8" />
              </div>
              <Button variant="outline" size="icon" onClick={() => void load()} title="Refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Spinner className="h-5 w-5" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {q ? "No GIFs match your search." : "No curated GIFs yet — add one above."}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((gif) => (
                <div
                  key={gif.id}
                  className={`group relative overflow-hidden rounded-xl border ${gif.is_active ? "border-border" : "border-dashed border-border opacity-60"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gif.preview_url || gif.url} alt={gif.title} className="h-28 w-full object-cover" loading="lazy" />
                  <div className="p-2.5">
                    <p className="truncate text-sm font-medium">{gif.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {(gif.tags || []).slice(0, 3).join(" · ") || gif.source} ·{" "}
                      {formatDistanceToNow(new Date(gif.created_at))} ago
                    </p>
                  </div>
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      title={gif.is_active ? "Hide from app" : "Show in app"}
                      disabled={busyId === `${gif.id}:toggle`}
                      onClick={() => void toggleActive(gif)}
                    >
                      {gif.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      title="Delete"
                      disabled={busyId === `${gif.id}:delete`}
                      onClick={() => void removeGif(gif)}
                    >
                      {busyId === `${gif.id}:delete` ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  {!gif.is_active && (
                    <Badge variant="outline" className="absolute bottom-2 left-2 bg-background/80">
                      Hidden
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

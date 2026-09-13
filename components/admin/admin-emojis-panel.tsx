"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { formatDistanceToNow } from "date-fns"
import { Smile, Plus, RefreshCw, Trash2, Eye, EyeOff, Search, Upload, X } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

interface CuratedEmoji {
  id: string
  shortcode: string
  url: string
  preview_url?: string | null
  category?: string
  is_active: boolean
  created_at: string
  added_by?: { username: string; display_name: string } | null
}

export function AdminEmojisPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [emojis, setEmojis] = useState<CuratedEmoji[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ shortcode: "", url: "", preview_url: "", category: "custom" })
  const [saving, setSaving] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/emojis", { headers: getAuthHeader() })
      if (res.ok) {
        const data = await res.json()
        setEmojis(data.emojis || [])
      }
    } catch (error) {
      console.error("Failed to load emojis:", error)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    void load()
  }, [load])

  const uploadFileToCloudinary = async (file: File): Promise<string | null> => {
    try {
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ type: "image", folder: "admin-emojis" }),
      })
      if (!signRes.ok) throw new Error("Failed to get upload signature")
      const signData = await signRes.json()

      const formData = new FormData()
      formData.append("file", file)
      formData.append("api_key", signData.apiKey)
      formData.append("timestamp", String(signData.timestamp))
      formData.append("signature", signData.signature)
      formData.append("folder", signData.folder)
      formData.append("resource_type", signData.resourceType)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/${signData.resourceType}/upload`,
        { method: "POST", body: formData },
      )
      if (!uploadRes.ok) throw new Error("Cloudinary upload failed")
      const uploadData = await uploadRes.json()
      return uploadData.secure_url
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
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB for emojis", variant: "destructive" })
      return
    }

    setUploadingFile(true)
    const url = await uploadFileToCloudinary(file)
    if (url) {
      setForm((f) => ({
        ...f,
        url,
        preview_url: url,
        shortcode: f.shortcode || file.name.replace(/\.[^.]+$/, "").replace(/[-_\s]/g, "-").toLowerCase(),
      }))
      toast({ title: "Emoji uploaded", description: "Ready to add" })
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
        shortcode: f.shortcode || file.name.replace(/\.[^.]+$/, "").replace(/[-_\s]/g, "-").toLowerCase(),
      }))
      toast({ title: "Emoji uploaded", description: "Ready to add" })
    }
    setUploadingFile(false)
  }

  const addEmoji = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.shortcode.trim() || !form.url.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch("/api/admin/emojis", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          shortcode: form.shortcode,
          url: form.url,
          preview_url: form.preview_url || undefined,
          category: form.category,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to add emoji")
      setEmojis((prev) => [data.emoji, ...prev])
      setForm({ shortcode: "", url: "", preview_url: "", category: "custom" })
      toast({ title: "Emoji added", description: `:${data.emoji.shortcode}: is now available in the picker` })
    } catch (error: any) {
      toast({ title: "Couldn't add emoji", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (emoji: CuratedEmoji) => {
    setBusyId(`${emoji.id}:toggle`)
    try {
      const res = await fetch("/api/admin/emojis", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id: emoji.id, is_active: !emoji.is_active }),
      })
      if (res.ok) {
        const data = await res.json()
        setEmojis((prev) => prev.map((e) => (e.id === emoji.id ? data.emoji : e)))
      }
    } catch (error) {
      console.error("Failed to toggle emoji:", error)
    } finally {
      setBusyId(null)
    }
  }

  const removeEmoji = async (emoji: CuratedEmoji) => {
    if (!confirm(`Remove :${emoji.shortcode}: from the emoji library?`)) return
    setBusyId(`${emoji.id}:delete`)
    try {
      const res = await fetch(`/api/admin/emojis?id=${emoji.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      if (res.ok) {
        setEmojis((prev) => prev.filter((e) => e.id !== emoji.id))
        toast({ title: "Emoji removed" })
      }
    } catch (error) {
      console.error("Failed to delete emoji:", error)
    } finally {
      setBusyId(null)
    }
  }

  const filtered = emojis.filter(
    (e) =>
      !q.trim() ||
      e.shortcode.toLowerCase().includes(q.toLowerCase()) ||
      (e.category || "").toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smile className="h-5 w-5" /> Add a custom emoji
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Upload from device area */}
          <div
            className={"relative mb-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors " + (
              dragOver
                ? "border-purple-500 bg-purple-500/10"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            {uploadingFile ? (
              <Spinner className="h-8 w-8 text-purple-400" />
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  Drag & drop an emoji image here
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  or{" "}
                  <button
                    type="button"
                    className="text-purple-400 hover:text-purple-300 underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse your device
                  </button>
                </p>
              </>
            )}
          </div>

          <form onSubmit={addEmoji} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Shortcode <span className="text-muted-foreground/60">(without ::)</span>
                </label>
                <Input
                  value={form.shortcode}
                  onChange={(e) => setForm((f) => ({ ...f, shortcode: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") }))}
                  placeholder="e.g. loop-hype"
                  required
                  minLength={2}
                  maxLength={32}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="custom, reaction, brand"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Image URL (or upload above)</label>
                <div className="flex gap-2">
                  <Input
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    placeholder="https://..."
                    className="flex-1"
                    required
                  />
                  {form.url && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => setForm((f) => ({ ...f, url: "", preview_url: "" }))} title="Clear">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving || !form.shortcode.trim() || !form.url.trim()}>
                {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                Add Emoji
              </Button>
              {form.url.trim() && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  Preview: {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.url} alt="" className="h-8 w-8 rounded object-contain" />
                  <span className="font-mono">:{form.shortcode || "shortcode"}:</span>
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
              <Smile className="h-5 w-5" /> Custom emoji library
              <Badge variant="secondary" className="rounded-full">
                {emojis.filter((e) => e.is_active).length} active
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emojis…" className="h-9 w-52 pl-8" />
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
              {q ? "No emojis match your search." : "No custom emojis yet — add one above."}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {filtered.map((emoji) => (
                <div
                  key={emoji.id}
                  className={`group relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                    emoji.is_active ? "border-border hover:border-border/80" : "border-dashed border-border opacity-50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={emoji.url} alt={`:${emoji.shortcode}:`} className="h-10 w-10 rounded object-contain" />
                  <p className="w-full truncate text-center text-[11px] font-mono text-muted-foreground">
                    :{emoji.shortcode}:
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">
                    {emoji.category || "custom"}
                  </p>
                  <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6"
                      title={emoji.is_active ? "Deactivate" : "Activate"}
                      disabled={busyId === `${emoji.id}:toggle`}
                      onClick={() => void toggleActive(emoji)}
                    >
                      {emoji.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-6 w-6"
                      title="Delete"
                      disabled={busyId === `${emoji.id}:delete`}
                      onClick={() => void removeEmoji(emoji)}
                    >
                      {busyId === `${emoji.id}:delete` ? <Spinner className="h-3 w-3" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  </div>
                  {!emoji.is_active && (
                    <Badge variant="outline" className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] bg-background/80">
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

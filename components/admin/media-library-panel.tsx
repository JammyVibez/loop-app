"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  Copy,
  FileImage,
  HardDrive,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  Wrench,
} from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/skeletons"

type MediaItem = {
  id: string
  url: string
  thumb_url: string | null
  file_name: string
  file_type: string
  file_size: number
  media_type: string
  format: string | null
  folder: string | null
  purpose: string | null
  width: number | null
  height: number | null
  duration: number | null
  created_at: string
  provider: "vps" | "cloudinary"
  storage_path: string | null
  processing_status: "ready" | "processing" | "failed" | string
  processing_error: string | null
  original_quality: boolean
  uploaded_by_role: string | null
  user_id: string | null
  uploader: { username?: string; display_name?: string } | null
  used_in: string[]
}

type StorageInfo = {
  disk: { usedPercent: number; freeBytes: number; totalBytes: number; available: boolean; root: string }
  warning: boolean
  blocked: boolean
}

const PAGE_SIZE = 24

function formatBytes(bytes?: number | null): string {
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return value
  }
}

/**
 * Admin → Media → Library.
 *
 * Every stored file with the facts needed to manage it: detected type, stored
 * size, uploader, folder, date, processing state and where it is used. Search,
 * filter, replace, retry a failed transcode or delete — deleting a file that a
 * post, badge, theme or ad still points at requires an explicit confirmation.
 * Bulk upload is chunked with per-file progress, and "original quality" keeps
 * badges, emojis, frames and GIFs pixel-exact.
 */
export function MediaLibraryPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [providerFilter, setProviderFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sort, setSort] = useState("recent")
  const [folder, setFolder] = useState("admin-media")
  // Off by default here because this is the general-purpose uploader; the
  // badges/emojis/frames panels default it on for their assets.
  const [originalQuality, setOriginalQuality] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ name: string; percent: number } | null>(null)
  const [bulkFiles, setBulkFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const replaceTargetRef = useRef<MediaItem | null>(null)

  const load = useCallback(
    async (nextPage = page) => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(nextPage * PAGE_SIZE),
          sort,
          references: "1",
        })
        if (query.trim()) params.set("q", query.trim())
        if (typeFilter !== "all") params.set("type", typeFilter)
        if (providerFilter !== "all") params.set("provider", providerFilter)
        if (statusFilter !== "all") params.set("status", statusFilter)

        const res = await fetch(`/api/admin/media?${params.toString()}`, {
          headers: getAuthHeader(),
          cache: "no-store",
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not load media")
        setItems(data.items || [])
        setTotal(data.total || 0)
        setStorage(data.storage || null)
      } catch (error: any) {
        toast({ title: "Media library unavailable", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    },
    [getAuthHeader, page, providerFilter, query, sort, statusFilter, toast, typeFilter],
  )

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, typeFilter, providerFilter, statusFilter])

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const bulkUpload = async () => {
    if (!bulkFiles.length) return
    setUploading(true)
    let uploaded = 0
    const failures: string[] = []
    for (const file of bulkFiles) {
      setUploadProgress({ name: file.name, percent: 0 })
      try {
        const type = file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : file.type === "application/json" || file.name.endsWith(".json")
              ? "file"
              : "image"
        await uploadMediaFile(file, {
          type,
          folder,
          purpose: folder,
          originalQuality,
          authHeaders: getAuthHeader(),
          onProgress: (percent) => setUploadProgress({ name: file.name, percent }),
        })
        uploaded += 1
      } catch (error: any) {
        failures.push(`${file.name}: ${error.message || "failed"}`)
      }
    }
    setUploading(false)
    setUploadProgress(null)
    setBulkFiles([])
    await load(page)
    toast({
      title: uploaded ? `${uploaded} file${uploaded === 1 ? "" : "s"} uploaded` : "Upload finished",
      description: failures.length ? `${failures.length} failed — ${failures[0]}` : "They're in the library now.",
      variant: failures.length ? "destructive" : "default",
    })
  }

  const handleDelete = async (item: MediaItem) => {
    setBusyId(item.id)
    try {
      const attempt = async (confirm: boolean) => {
        const res = await fetch(`/api/admin/media/${item.id}${confirm ? "?confirm=1" : ""}`, {
          method: "DELETE",
          headers: getAuthHeader(),
        })
        return { res, data: await res.json().catch(() => ({})) }
      }

      let { res, data } = await attempt(false)
      if (res.status === 409) {
        const proceed = await confirmDialog({
          title: "File is still in use",
          description: `${data.error || "This file is still referenced."} Deleting it will leave a broken image behind.`,
          confirmLabel: "Delete anyway",
          destructive: true,
        })
        if (!proceed) return
        ;({ res, data } = await attempt(true))
      }

      if (!res.ok) throw new Error(data.error || "Delete failed")
      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      setTotal((prev) => Math.max(0, prev - 1))
      toast({ title: "File deleted", description: item.file_name })
    } catch (error: any) {
      toast({ title: "Could not delete file", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const handleReplace = async (file: File) => {
    const target = replaceTargetRef.current
    if (!target) return
    setBusyId(target.id)
    try {
      const res = await fetch(`/api/admin/media/${target.id}`, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream", ...getAuthHeader() },
        body: file,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Replace failed")
      toast({ title: "File replaced", description: "Every URL pointing at it now shows the new bytes." })
      await load(page)
    } catch (error: any) {
      toast({ title: "Replace failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
      replaceTargetRef.current = null
    }
  }

  const handleRetry = async (item: MediaItem) => {
    setBusyId(item.id)
    try {
      const res = await fetch(`/api/admin/media/${item.id}`, { method: "PATCH", headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Retry failed")
      toast({ title: "Processing queued", description: item.file_name })
      await load(page)
    } catch (error: any) {
      toast({ title: "Retry failed", description: error.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url.startsWith("http") ? url : `${window.location.origin}${url}`)
      toast({ title: "URL copied" })
    } catch {
      toast({ title: "Could not copy", variant: "destructive" })
    }
  }

  const diskBar = useMemo(() => {
    if (!storage?.disk) return null
    const percent = Math.min(100, storage.disk.usedPercent)
    return (
      <div className="flex min-w-[220px] flex-col gap-1">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${storage.blocked ? "bg-red-500" : storage.warning ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {percent}% of the uploads volume used · {formatBytes(storage.disk.freeBytes)} free
        </p>
      </div>
    )
  }, [storage])

  return (
    <div className="space-y-4">
      {storage?.blocked ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />
          <div className="text-sm">
            <p className="font-medium text-red-500">Uploads are paused</p>
            <p className="text-muted-foreground">
              The uploads volume is at {storage.disk.usedPercent}%. Nothing new can be stored until space is freed —
              delete files here or expand the volume.
            </p>
          </div>
        </div>
      ) : storage?.warning ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">Uploads volume is filling up</p>
            <p className="text-muted-foreground">
              {storage.disk.usedPercent}% used. Uploads stop at the block threshold configured in Upload rules.
            </p>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-muted-foreground" />
                Media library
              </CardTitle>
              <CardDescription>
                Every file on our servers, with its type, size, uploader, date and where it is used. Legacy Cloudinary
                files appear under the Cloudinary filter and are never affected by deletes here.
              </CardDescription>
            </div>
            {diskBar}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(0)
                    void load(0)
                  }
                }}
                placeholder="Search filename, path or folder…"
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={providerFilter}
              onValueChange={(value) => {
                setProviderFilter(value)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Storage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All storage</SelectItem>
                <SelectItem value="vps">VPS</SelectItem>
                <SelectItem value="cloudinary">Cloudinary</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="largest">Largest</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => load(page)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="text-xs font-medium">Bulk upload</p>
                <p className="text-[11px] text-muted-foreground">
                  Any type admins are allowed: images, GIFs, video, audio, SVG and Lottie. Original quality keeps exact
                  pixels, transparency and animation.
                </p>
              </div>
              <Input
                value={folder}
                onChange={(event) => setFolder(event.target.value)}
                placeholder="folder"
                className="w-[140px]"
                aria-label="Upload folder"
              />
              <div className="flex items-center gap-2">
                <Switch
                  id="original-quality"
                  checked={originalQuality}
                  onCheckedChange={setOriginalQuality}
                  aria-label="Original quality"
                />
                <Label htmlFor="original-quality" className="text-xs">
                  Original quality
                </Label>
              </div>
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Spinner className="mr-2 h-4 w-4" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                Choose files
              </Button>
            </div>
            {uploadProgress ? (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">{uploadProgress.name}</span>
                  <span>{uploadProgress.percent}%</span>
                </div>
                <Progress value={uploadProgress.percent} />
              </div>
            ) : null}
            {bulkFiles.length > 0 && !uploading ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {bulkFiles.length} file{bulkFiles.length === 1 ? "" : "s"} ready ({formatBytes(bulkFiles.reduce((sum, f) => sum + f.size, 0))})
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setBulkFiles([])}>
                    Clear
                  </Button>
                  <Button size="sm" onClick={bulkUpload}>
                    <Upload className="mr-2 h-4 w-4" /> Upload {bulkFiles.length}
                  </Button>
                </div>
              </div>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                setBulkFiles(Array.from(event.target.files || []))
                event.target.value = ""
              }}
            />
            <input
              ref={replaceInputRef}
              type="file"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ""
                if (file) void handleReplace(file)
              }}
            />
          </div>

          {loading && !items.length ? (
            <div className="flex justify-center py-12">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : !items.length ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No files match those filters yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <div key={item.id} className="flex gap-3 rounded-xl border p-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {item.thumb_url && item.media_type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumb_url} alt={item.file_name} className="h-full w-full object-cover" />
                    ) : item.media_type === "video" && item.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumb_url} alt={item.file_name} className="h-full w-full object-cover" />
                    ) : (
                      <FileImage className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium" title={item.file_name}>
                        {item.file_name}
                      </p>
                      <Badge variant={item.provider === "vps" ? "default" : "outline"} className="shrink-0 text-[10px]">
                        {item.provider === "vps" ? "VPS" : "Cloudinary"}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.media_type} · {item.format || item.file_type} · {formatBytes(item.file_size)}
                      {item.width && item.height ? ` · ${item.width}×${item.height}` : ""}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {item.uploader?.username ? `@${item.uploader.username}` : item.uploaded_by_role || "unknown"} ·{" "}
                      {item.folder || "—"} · {formatDate(item.created_at)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1">
                      {item.processing_status !== "ready" ? (
                        <Badge
                          variant={item.processing_status === "failed" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {item.processing_status}
                        </Badge>
                      ) : null}
                      {item.original_quality ? (
                        <Badge variant="outline" className="text-[10px]">
                          original
                        </Badge>
                      ) : null}
                      {item.used_in.map((label) => (
                        <Badge key={`${item.id}-${label}`} variant="secondary" className="text-[10px]">
                          {label}
                        </Badge>
                      ))}
                    </div>
                    {item.processing_error ? (
                      <p className="line-clamp-2 text-[10px] text-red-500">{item.processing_error}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyUrl(item.url)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {item.provider === "vps" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            title="Replace file"
                            onClick={() => {
                              replaceTargetRef.current = item
                              replaceInputRef.current?.click()
                            }}
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                          </Button>
                          {item.processing_status === "failed" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              title="Retry processing"
                              onClick={() => handleRetry(item)}
                              disabled={busyId === item.id}
                            >
                              <Wrench className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-red-500 hover:text-red-600"
                            title="Delete file"
                            onClick={() => handleDelete(item)}
                            disabled={busyId === item.id}
                          >
                            {busyId === item.id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </Button>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Legacy — read only</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pages > 1 ? (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {pages} · {total} files
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

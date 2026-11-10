"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ChevronDown,
  Clapperboard,
  Eye,
  EyeOff,
  Film,
  ImagePlus,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Upload,
  Video,
} from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { fetchUploadLimits, uploadMediaFile } from "@/lib/client-media-upload"
import {
  episodeLabel,
  type ChannelEpisode,
  type ChannelTitle,
  type ChannelTitleKind,
} from "@/lib/channels-library"
import { cn } from "@/lib/utils"

type AdminTitle = ChannelTitle & { videoUrl?: string | null }

type Draft = {
  kind: ChannelTitleKind
  title: string
  synopsis: string
  posterUrl: string
  backdropUrl: string
  videoUrl: string
  year: string
  country: string
  language: string
  genres: string
  runtimeMinutes: string
  featured: boolean
  published: boolean
}

type UpdateDraft = <K extends keyof Draft>(key: K, value: Draft[K]) => void

const EMPTY_DRAFT: Draft = {
  kind: "movie",
  title: "",
  synopsis: "",
  posterUrl: "",
  backdropUrl: "",
  videoUrl: "",
  year: "",
  country: "",
  language: "",
  genres: "",
  runtimeMinutes: "",
  featured: false,
  published: true,
}

function draftFromTitle(title: AdminTitle): Draft {
  return {
    kind: title.kind,
    title: title.title,
    synopsis: title.synopsis ?? "",
    posterUrl: title.poster ?? "",
    backdropUrl: title.backdrop ?? "",
    videoUrl: title.videoUrl ?? "",
    year: title.year ? String(title.year) : "",
    country: title.country ?? "",
    language: title.language ?? "",
    genres: title.genres.join(", "),
    runtimeMinutes: title.runtimeMinutes ? String(title.runtimeMinutes) : "",
    featured: title.featured,
    published: title.published,
  }
}

export function AdminChannelsPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [titles, setTitles] = useState<AdminTitle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<AdminTitle | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT)
  const [savingEdit, setSavingEdit] = useState(false)

  const authHeaders = useCallback(
    () => ({
      "Content-Type": "application/json",
      ...getAuthHeader(),
    }),
    [getAuthHeader],
  )

  const loadTitles = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/channels/titles", { headers: authHeaders(), cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Could not load the library")
      setTitles(payload?.data?.titles ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the library")
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void loadTitles()
  }, [loadTitles])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (!draft.title.trim()) {
      toast({ title: "Add a title first", variant: "destructive" })
      return
    }
    if (draft.kind === "movie" && !draft.videoUrl.trim()) {
      toast({ title: "Upload the movie file or paste its URL", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/admin/channels/titles", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          ...draft,
          year: draft.year ? Number(draft.year) : null,
          runtimeMinutes: draft.runtimeMinutes ? Number(draft.runtimeMinutes) : null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Could not save the title")

      toast({ title: `${draft.kind === "movie" ? "Movie" : "Show"} added` })
      setDraft(EMPTY_DRAFT)
      setShowForm(false)
      await loadTitles()
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const updateEdit = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setEditDraft((current) => ({ ...current, [key]: value }))

  const startEdit = (title: AdminTitle) => {
    setEditing(title)
    setEditDraft(draftFromTitle(title))
  }

  const saveEdit = async () => {
    if (!editing) return
    if (!editDraft.title.trim()) {
      toast({ title: "Add a title first", variant: "destructive" })
      return
    }
    if (editDraft.kind === "movie" && !editDraft.videoUrl.trim()) {
      toast({ title: "Upload the movie file or paste its URL", variant: "destructive" })
      return
    }

    setSavingEdit(true)
    try {
      const response = await fetch(`/api/admin/channels/titles/${editing.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          title: editDraft.title,
          synopsis: editDraft.synopsis,
          posterUrl: editDraft.posterUrl,
          backdropUrl: editDraft.backdropUrl,
          videoUrl: editDraft.videoUrl,
          year: editDraft.year ? Number(editDraft.year) : null,
          country: editDraft.country,
          language: editDraft.language,
          genres: editDraft.genres,
          runtimeMinutes: editDraft.runtimeMinutes ? Number(editDraft.runtimeMinutes) : null,
          featured: editDraft.featured,
          published: editDraft.published,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Could not update the title")

      toast({ title: `${editDraft.kind === "movie" ? "Movie" : "Show"} updated` })
      setEditing(null)
      await loadTitles()
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSavingEdit(false)
    }
  }

  const patch = async (id: string, body: Record<string, unknown>, message: string) => {
    try {
      const response = await fetch(`/api/admin/channels/titles/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Update failed")
      setTitles((current) =>
        current.map((title) => (title.id === id ? { ...title, ...(payload?.data?.title ?? body) } : title)),
      )
      toast({ title: message })
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    }
  }

  const remove = async (title: AdminTitle) => {
    if (!window.confirm(`Delete “${title.title}” and all of its episodes?`)) return
    try {
      const response = await fetch(`/api/admin/channels/titles/${title.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      if (!response.ok) throw new Error("Delete failed")
      setTitles((current) => current.filter((entry) => entry.id !== title.id))
      toast({ title: "Removed from the library" })
    } catch {
      toast({ title: "Delete failed", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Movies &amp; shows</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload movies and episodes straight from here. Published titles appear in
            <span className="font-medium text-foreground"> /channels</span> for every signed-in and
            signed-out viewer; drafts stay hidden.
          </p>
        </div>
        <Button onClick={() => setShowForm((open) => !open)} variant={showForm ? "outline" : "default"}>
          {showForm ? "Close" : <><Plus className="mr-1.5 h-4 w-4" /> Add title</>}
        </Button>
      </div>

      {showForm ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
          <div className="flex gap-2">
            {(["movie", "series"] as ChannelTitleKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => update("kind", kind)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition",
                  draft.kind === kind
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {kind === "movie" ? <Film className="h-3.5 w-3.5" /> : <Clapperboard className="h-3.5 w-3.5" />}
                {kind === "movie" ? "Movie" : "Show"}
              </button>
            ))}
          </div>

          <TitleFields draft={draft} update={update} authHeaders={authHeaders} />

          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.published} onCheckedChange={(value) => update("published", value)} />
              Published
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.featured} onCheckedChange={(value) => update("featured", value)} />
              Featured
            </label>
            <Button className="ml-auto" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save {draft.kind === "movie" ? "movie" : "show"}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading the library…
        </div>
      ) : titles.length ? (
        <div className="space-y-3">
          {titles.map((title) => (
            <TitleCard
              key={title.id}
              title={title}
              authHeaders={authHeaders}
              onPatch={patch}
              onEdit={() => startEdit(title)}
              onDelete={() => void remove(title)}
              onEpisodesChanged={loadTitles}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center">
          <Film className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">Nothing in the library yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add a movie or a show and it will show up in Channels right away.
          </p>
        </div>
      )}

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent
          className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl"
          style={{ width: "calc(100vw - 1rem)" }}
        >
          <DialogHeader>
            <DialogTitle>
              Edit {editing?.kind === "series" ? "show" : "movie"}
            </DialogTitle>
            <DialogDescription>
              Update the artwork, video, synopsis or release details. Changes appear on the title page
              immediately; new shares pick up the updated art and details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <TitleFields draft={editDraft} update={updateEdit} authHeaders={authHeaders} />

            <div className="flex flex-wrap items-center gap-5 border-t border-border pt-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editDraft.published}
                  onCheckedChange={(value) => updateEdit("published", value)}
                />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={editDraft.featured}
                  onCheckedChange={(value) => updateEdit("featured", value)}
                />
                Featured
              </label>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button onClick={() => void saveEdit()} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TitleFields({
  draft,
  update,
  authHeaders,
}: {
  draft: Draft
  update: UpdateDraft
  authHeaders: () => Record<string, string>
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title" className="sm:col-span-2">
        <Input
          value={draft.title}
          onChange={(event) => update("title", event.target.value)}
          placeholder="e.g. The Farewell"
        />
      </Field>

      <Field label="Synopsis" className="sm:col-span-2">
        <Textarea
          value={draft.synopsis}
          onChange={(event) => update("synopsis", event.target.value)}
          placeholder="A short description shown on the title page and share cards."
          rows={3}
        />
      </Field>

      <MediaField
        label="Poster"
        kind="image"
        value={draft.posterUrl}
        onChange={(url) => update("posterUrl", url)}
        accept="image/*"
        authHeaders={authHeaders}
      />
      <MediaField
        label="Backdrop (optional)"
        kind="image"
        value={draft.backdropUrl}
        onChange={(url) => update("backdropUrl", url)}
        accept="image/*"
        authHeaders={authHeaders}
      />

      {draft.kind === "movie" ? (
        <MediaField
          label="Movie file"
          className="sm:col-span-2"
          kind="video"
          value={draft.videoUrl}
          onChange={(url) => update("videoUrl", url)}
          accept="video/*"
          authHeaders={authHeaders}
        />
      ) : (
        <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground sm:col-span-2">
          Seasons and episodes are managed from the show&apos;s card below.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <Field label="Year">
          <Input
            inputMode="numeric"
            value={draft.year}
            onChange={(event) => update("year", event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="2024"
          />
        </Field>
        <Field label="Country">
          <Input
            value={draft.country}
            onChange={(event) => update("country", event.target.value)}
            placeholder="South Korea"
          />
        </Field>
        <Field label="Language">
          <Input
            value={draft.language}
            onChange={(event) => update("language", event.target.value)}
            placeholder="Korean"
          />
        </Field>
      </div>

      <Field label="Genres (comma separated)">
        <Input
          value={draft.genres}
          onChange={(event) => update("genres", event.target.value)}
          placeholder="Drama, Romance"
        />
      </Field>

      {draft.kind === "movie" ? (
        <Field label="Runtime (minutes)">
          <Input
            inputMode="numeric"
            value={draft.runtimeMinutes}
            onChange={(event) =>
              update("runtimeMinutes", event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="118"
          />
        </Field>
      ) : null}
    </div>
  )
}

function TitleCard({
  title,
  authHeaders,
  onPatch,
  onEdit,
  onDelete,
  onEpisodesChanged,
}: {
  title: AdminTitle
  authHeaders: () => Record<string, string>
  onPatch: (id: string, body: Record<string, unknown>, message: string) => Promise<void>
  onEdit: () => void
  onDelete: () => void
  onEpisodesChanged: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-border bg-card/50">
      <div className="flex flex-wrap items-center gap-3 p-3.5">
        <span className="relative flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
          {title.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={title.poster} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold">{title.title}</p>
            <Badge variant="secondary" className="text-[10px] uppercase">
              {title.kind}
            </Badge>
            {title.featured ? (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Star className="h-2.5 w-2.5" /> Featured
              </Badge>
            ) : null}
            {!title.published ? (
              <Badge variant="outline" className="text-[10px] text-amber-600">
                Draft
              </Badge>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {[title.year, title.kind === "series" ? `${title.episodeCount} episodes` : null, title.genres.join(", ")]
              .filter(Boolean)
              .join(" · ") || "No details yet"}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" title="Edit details" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={title.published ? "Unpublish" : "Publish"}
            onClick={() => void onPatch(title.id, { published: !title.published }, title.published ? "Unpublished" : "Published")}
          >
            {title.published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={title.featured ? "Remove from featured" : "Feature"}
            onClick={() => void onPatch(title.id, { featured: !title.featured }, "Updated")}
          >
            <Star className={cn("h-4 w-4", title.featured && "fill-current text-amber-500")} />
          </Button>
          {title.kind === "series" ? (
            <Button size="sm" variant="outline" onClick={() => setOpen((value) => !value)}>
              Episodes
              <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition", open && "rotate-180")} />
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-destructive" title="Delete" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {open && title.kind === "series" ? (
        <EpisodesEditor title={title} authHeaders={authHeaders} onChanged={onEpisodesChanged} />
      ) : null}
    </div>
  )
}

function EpisodesEditor({
  title,
  authHeaders,
  onChanged,
}: {
  title: AdminTitle
  authHeaders: () => Record<string, string>
  onChanged: () => Promise<void>
}) {
  const { toast } = useToast()
  const [episodes, setEpisodes] = useState<ChannelEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState("1")
  const [number, setNumber] = useState("1")
  const [name, setName] = useState("")
  const [videoUrl, setVideoUrl] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/channels/episodes?titleId=${encodeURIComponent(title.id)}`,
        { headers: authHeaders(), cache: "no-store" },
      )
      const payload = await response.json().catch(() => null)
      setEpisodes(payload?.data?.episodes ?? [])
    } finally {
      setLoading(false)
    }
  }, [authHeaders, title.id])

  useEffect(() => {
    void load()
  }, [load])

  const add = async () => {
    if (!videoUrl.trim()) {
      toast({ title: "Upload the episode file or paste its URL", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/admin/channels/episodes", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          titleId: title.id,
          season: Number(season) || 1,
          episode: Number(number) || 1,
          name: name.trim() || null,
          videoUrl: videoUrl.trim(),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Could not save the episode")

      toast({ title: "Episode saved" })
      setName("")
      setVideoUrl("")
      setNumber((current) => String((Number(current) || 1) + 1))
      await load()
      await onChanged()
    } catch (err) {
      toast({
        title: "Episode save failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (episode: ChannelEpisode) => {
    const response = await fetch(`/api/admin/channels/episodes?id=${encodeURIComponent(episode.id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    })
    if (!response.ok) {
      toast({ title: "Could not delete the episode", variant: "destructive" })
      return
    }
    await load()
    await onChanged()
  }

  return (
    <div className="space-y-3 border-t border-border p-3.5">
      {loading ? (
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading episodes…
        </p>
      ) : episodes.length ? (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {episodes.map((episode) => (
            <li key={episode.id} className="flex items-center gap-3 px-3 py-2">
              <span className="w-16 shrink-0 text-[11px] font-semibold text-muted-foreground">
                {episodeLabel(episode)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {episode.name || `Episode ${episode.episode}`}
              </span>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove(episode)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-muted-foreground">No episodes yet — add the first one below.</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[80px_80px_1fr]">
        <Field label="Season">
          <Input inputMode="numeric" value={season} onChange={(event) => setSeason(event.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Episode">
          <Input inputMode="numeric" value={number} onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))} />
        </Field>
        <Field label="Episode name (optional)">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. The Letter" />
        </Field>
      </div>

      <MediaField
        label="Episode file"
        kind="video"
        value={videoUrl}
        onChange={setVideoUrl}
        accept="video/*"
        authHeaders={authHeaders}
      />

      <Button size="sm" onClick={() => void add()} disabled={saving}>
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Save episode
      </Button>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <Label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

/**
 * URL field with an upload button. Files stream to the VPS media store in
 * chunks, so large videos are not held in memory and get a background
 * transcode instead of blocking the request.
 */
function MediaField({
  label,
  kind,
  value,
  onChange,
  accept,
  authHeaders,
  className,
}: {
  label: string
  kind: "image" | "video"
  value: string
  onChange: (url: string) => void
  accept: string
  authHeaders: () => Record<string, string>
  className?: string
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progressLabel, setProgressLabel] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [videoMaxMb, setVideoMaxMb] = useState<number | null>(null)

  // Show the real ceiling instead of rejecting a movie after it has uploaded.
  useEffect(() => {
    let live = true
    void fetchUploadLimits(authHeaders()).then((limits) => {
      if (live && limits) setVideoMaxMb(limits.limits.video_max_mb)
    })
    return () => {
      live = false
    }
  }, [authHeaders])

  const upload = async (file: File) => {
    setUploading(true)
    setProgressLabel(file.name)
    setPercent(0)
    try {
      const result = await uploadMediaFile(file, {
        type: kind,
        folder: "channel-library",
        authHeaders: authHeaders(),
        forceDirect: true,
        maxSizeBytes: kind === "video" && videoMaxMb ? videoMaxMb * 1024 * 1024 : undefined,
        // Channel titles are curated by admins. Keeping the original bytes means
        // a feature-length film is stored as-is and gets a poster, instead of
        // waiting for a full 720p re-encode before the URL comes back.
        originalQuality: kind === "video",
        onProgress: setPercent,
      })
      onChange(result.url)
      toast({ title: "Upload complete" })
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      setProgressLabel(null)
      setPercent(null)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <Field label={label} className={className}>
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          {kind === "video" ? (
            <Video className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          ) : (
            <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          )}
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={kind === "video" ? "https://… video URL" : "https://… image URL"}
            className="pl-8"
          />
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          title={progressLabel ?? "Upload a file"}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
      {uploading ? (
        <div className="space-y-1 pt-0.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">Uploading {progressLabel}</span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {percent == null ? "…" : `${percent}%`}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(percent ?? 4, 4)}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Keep this tab open until it finishes.
            {kind === "video" && videoMaxMb ? ` Up to ${videoMaxMb}MB.` : ""}
          </p>
        </div>
      ) : null}
    </Field>
  )
}

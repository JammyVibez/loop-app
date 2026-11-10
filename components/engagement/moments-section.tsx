"use client"

import { ProtectedMedia } from "@/components/media-protection"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Hourglass, Plus, Trash2, X, Zap } from "@/components/icons/lucide-compat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { createClient } from "@/lib/supabase"
import { MomentCard, type MomentCardMoment } from "@/components/engagement/moment-card"
import { Spinner } from "@/components/ui/skeletons"

interface MomentAuthor {
  id: string
  username?: string | null
  display_name?: string | null
  avatar_url?: string | null
  is_verified?: boolean | null
  is_premium?: boolean | null
}

interface MomentFeedItem extends MomentCardMoment {
  user_id: string
  is_self: boolean
  duration_hours?: number
  author?: MomentAuthor | null
}

/**
 * Moments — ephemeral posts that vanish forever after 24–48h.
 *
 * Deliberately NOT an Instagram-style story strip: moments are rendered as
 * unique post cards with a ticking countdown and a shrinking life bar, so
 * they read as "now-or-never" at a glance.
 */
export function MomentsSection() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [moments, setMoments] = useState<MomentFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [caption, setCaption] = useState("")
  const [hours, setHours] = useState<24 | 48>(24)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchMoments = useCallback(async () => {
    try {
      const res = await fetch("/api/moments", { headers: { ...getAuthHeader() }, cache: "no-store" })
      const data = await res.json()
      if (res.ok) setMoments(data.moments || [])
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    void fetchMoments()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    )
    const channel = supabase
      .channel("realtime_moments_section")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "moments" }, () => void fetchMoments())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "moments" }, () => void fetchMoments())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "moments" }, () => void fetchMoments())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, fetchMoments])

  // Count feed impressions as views — each moment counts once per viewer session.
  const viewedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!user || moments.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const momentId = (entry.target as HTMLElement).dataset.momentId
          if (!momentId || viewedRef.current.has(momentId)) continue
          viewedRef.current.add(momentId)
          void fetch(`/api/moments/${momentId}/view`, {
            method: "POST",
            headers: { ...getAuthHeader() },
          }).catch(() => {})
        }
      },
      { threshold: 0.4 },
    )
    const nodes = document.querySelectorAll<HTMLElement>("[data-moment-id]")
    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [moments, user, getAuthHeader])

  if (!user) return null

  const pickFile = (file: File) => {
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  const isVideo = (mediaUrl: string) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrl)

  const createMoment = async () => {
    if (creating) return
    if (!mediaFile && !caption.trim()) {
      toast({ title: "Add a photo, video, or caption", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      let mediaUrl = ""
      let mediaType: string | undefined
      if (mediaFile) {
        setUploading(true)
        const uploaded = await uploadMediaFile(mediaFile, {
          type: mediaFile.type.startsWith("video") ? "video" : "image",
          folder: "moments",
          authHeaders: getAuthHeader(),
        })
        mediaUrl = uploaded.url
        mediaType = mediaFile.type.startsWith("video") ? "video" : "image"
      }
      const res = await fetch("/api/moments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          media_url: mediaUrl || undefined,
          media_type: mediaType,
          content: caption.trim() || undefined,
          hours,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create moment")
      toast({
        title: "Moment posted ⏳",
        description: `It vanishes from everywhere in ${hours}h.`,
      })
      setCaption("")
      setMediaFile(null)
      setMediaPreview(null)
      setCreateOpen(false)
      await fetchMoments()
    } catch (error: any) {
      toast({ title: "Couldn't post moment", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setUploading(false)
      setCreating(false)
    }
  }

  const deleteMoment = async (item: MomentFeedItem) => {
    if (deletingId) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/moments/${item.id}`, { method: "DELETE", headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete moment")
      toast({ title: "Moment deleted", description: "It's gone from the database." })
      setMoments((prev) => prev.filter((m) => m.id !== item.id))
    } catch (error: any) {
      toast({ title: "Couldn't delete moment", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const liveMoments = moments.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > Date.now())

  return (
    <>
      <section className="rounded-3xl border border-amber-500/15 bg-gradient-to-br from-card/60 via-card/40 to-amber-500/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
            <Hourglass className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight">Moments</h2>
              <Badge variant="outline" className="rounded-full border-amber-500/40 px-2 py-0 text-[10px] text-amber-600 dark:text-amber-400">
                gone in 24–48h
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">Ephemeral posts that delete themselves — no archive, no clutter.</p>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0 gap-1 rounded-full bg-gradient-to-r from-sky-500 to-fuchsia-600 text-xs text-white hover:from-sky-400 hover:to-fuchsia-500"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Post a moment
          </Button>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            <Spinner className="mr-2 h-5 w-5" /> Loading moments…
          </div>
        ) : liveMoments.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-amber-500/25 bg-background/40 px-6 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <Hourglass className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold">No live moments</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Moments disappear after 24–48 hours. Post one — it won&apos;t live forever, and that&apos;s the point.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 rounded-full border-amber-500/40 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              onClick={() => setCreateOpen(true)}
            >
              <Zap className="mr-1.5 h-3.5 w-3.5" /> Post your first moment
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {liveMoments.map((moment) => (
              <div key={moment.id} data-moment-id={moment.id} className="group relative">
                <Link href={`/moments/${moment.id}`} className="absolute inset-0 z-10 rounded-3xl" aria-label="Open moment" />
                {moment.is_self && (
                  <button
                    type="button"
                    className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 text-white opacity-0 shadow-md backdrop-blur transition group-hover:opacity-100 focus:opacity-100 hover:bg-red-600"
                    onClick={() => void deleteMoment(moment)}
                    disabled={deletingId === moment.id}
                    aria-label="Delete moment"
                    title="Delete moment"
                  >
                    {deletingId === moment.id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                )}
                <MomentCard
                  moment={moment}
                  author={moment.author}
                  isMine={false}
                  durationHours={moment.duration_hours || 24}
                  className="pointer-events-none"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create moment dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" /> New Moment
            </DialogTitle>
            <DialogDescription>
              Moments disappear automatically after 24–48 hours — no archive, no clutter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) pickFile(file)
                e.target.value = ""
              }}
            />
            {mediaPreview ? (
              <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black">
                {isVideo(mediaPreview) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <ProtectedMedia type="video" src={mediaPreview} className="h-full w-full object-contain" showControls={false} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <ProtectedMedia type="image" src={mediaPreview} alt="Moment preview" className="h-full w-full object-contain" />
                )}
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black/90"
                  onClick={() => {
                    setMediaFile(null)
                    setMediaPreview(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-amber-500/50 hover:text-amber-500"
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs font-medium">Add a photo or video</span>
              </button>
            )}
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="What's happening? (optional)"
              rows={2}
              className="resize-none"
              maxLength={500}
            />
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] text-muted-foreground">Expires in</Badge>
              {[24, 48].map((h) => (
                <Button
                  key={h}
                  type="button"
                  size="sm"
                  variant={hours === h ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setHours(h as 24 | 48)}
                  title={h === 48 ? "Pro perk — 48h moments" : "24h for everyone"}
                >
                  {h}h {h === 48 && !user.is_premium && <Zap className="ml-1 h-3 w-3" />}
                </Button>
              ))}
            </div>
            {hours === 48 && !user.is_premium && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-500">
                <Zap className="h-3 w-3" /> 48-hour moments are a Pro perk — you&apos;ll get 24h.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-sky-500 to-fuchsia-600 text-white hover:from-sky-400 hover:to-fuchsia-500"
                onClick={() => void createMoment()}
                disabled={creating || uploading || (!mediaFile && !caption.trim())}
              >
                {creating || uploading ? <Spinner className="mr-1.5 h-4 w-4" /> : <Zap className="mr-1.5 h-4 w-4" />}
                {uploading ? "Uploading…" : "Post moment"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

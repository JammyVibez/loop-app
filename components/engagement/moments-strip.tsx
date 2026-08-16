"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Pencil, Plus, Trash2, X, Zap } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { createClient } from "@/lib/supabase"

type MomentItem = {
  id: string
  type: "loop" | "reel" | "moment"
  media_url: string
  media_type: string
  href: string
  created_at: string
  content?: string | null
  expires_at?: string | null
}

type MomentGroup = {
  user: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    is_verified?: boolean
  }
  items: MomentItem[]
  is_self: boolean
  has_unseen?: boolean
}

export function MomentsStrip() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [moments, setMoments] = useState<MomentGroup[]>([])
  const [active, setActive] = useState<MomentGroup | null>(null)
  const [index, setIndex] = useState(0)
  const [createOpen, setCreateOpen] = useState(false)
  const [caption, setCaption] = useState("")
  const [hours, setHours] = useState<24 | 48>(24)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchMoments = async () => {
    try {
      const res = await fetch("/api/loops/moments", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await res.json()
      if (res.ok) setMoments(data.moments || [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!user) return
    fetchMoments()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )

    const channel = supabase
      .channel("realtime_moments_engine")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "loops" },
        () => {
          fetchMoments()
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moments" },
        () => {
          fetchMoments()
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "moments" },
        () => {
          fetchMoments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  if (!user) return null

  const openMoment = (group: MomentGroup) => {
    if (group.is_self && group.items.length === 0) {
      setCreateOpen(true)
      return
    }
    if (!group.items.length) return
    setActive(group)
    setIndex(0)
  }

  const current = active?.items[index]

  const pickFile = (file: File) => {
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  const createMoment = async () => {
    if (creating) return
    if (!mediaFile && !caption.trim()) {
      toast({ title: "Add a photo or caption", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      let mediaUrl = ""
      let mediaType: string | undefined
      if (mediaFile) {
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
        title: "Moment posted ⏱️",
        description: `It disappears automatically in ${hours}h.`,
      })
      setCaption("")
      setMediaFile(null)
      setMediaPreview(null)
      setCreateOpen(false)
      await fetchMoments()
    } catch (error: any) {
      toast({ title: "Couldn't post moment", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const deleteMoment = async (item: MomentItem) => {
    if (!item || deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/moments/${item.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete moment")
      setActive(null)
      toast({ title: "Moment deleted" })
      await fetchMoments()
    } catch (error: any) {
      toast({ title: "Couldn't delete moment", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const isVideo = (mediaUrl: string) => /\.(mp4|webm|ogg|mov)(\?|$)/i.test(mediaUrl)

  return (
    <>
      <div className="rounded-2xl border border-border/70 bg-card/40 px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold tracking-tight">Moments</p>
          <Link href="/reels" className="text-xs text-sky-500 hover:underline">
            Watch all
          </Link>
        </div>
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
          {moments.map((group) => {
            const name = group.is_self ? "Your moment" : group.user.username || group.user.display_name || "user"
            const ring = group.is_self
              ? group.items.length
                ? "bg-gradient-to-tr from-sky-400 to-fuchsia-500"
                : "bg-border"
              : group.has_unseen
                ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600"
                : "bg-border"
            return (
              <button
                key={group.user.id}
                type="button"
                onClick={() => openMoment(group)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
              >
                <span className={cn("rounded-full p-[2px]", ring)}>
                  <span className="relative block rounded-full bg-background p-[2px]">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={group.user.avatar_url} />
                      <AvatarFallback>{(group.user.display_name || group.user.username || "?").charAt(0)}</AvatarFallback>
                    </Avatar>
                    {group.is_self && group.items.length === 0 && (
                      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-background">
                        <Plus className="h-3 w-3" />
                      </span>
                    )}
                    {group.is_self && group.items.length > 0 && (
                      <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-background text-sky-500">
                        <Pencil className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </span>
                </span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{name}</span>
              </button>
            )
          })}
        </div>
      </div>

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
                  <video src={mediaPreview} className="h-full w-full object-contain" controls playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview} alt="Moment preview" className="h-full w-full object-contain" />
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
                className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-sky-500/50 hover:text-sky-500"
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
                <Zap className="h-3 w-3" /> 48-hour moments are a Pro perk — you'll get 24h.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-sky-500 to-fuchsia-600 text-white hover:from-sky-400 hover:to-fuchsia-500"
                onClick={() => void createMoment()}
                disabled={creating || (!mediaFile && !caption.trim())}
              >
                {creating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Zap className="mr-1.5 h-4 w-4" />}
                Post moment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Viewer */}
      <Dialog open={Boolean(active && current)} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-md border-0 bg-black p-0 text-white sm:rounded-2xl overflow-hidden">
          {active && current && (
            <div className="relative aspect-[9/16] max-h-[80vh] w-full bg-black">
              <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
                {active.items.map((_, i) => (
                  <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div className={cn("h-full bg-white transition-all", i <= index ? "w-full" : "w-0")} />
                  </div>
                ))}
              </div>
              <div className="absolute left-3 top-6 z-20 flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={active.user.avatar_url} />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">@{active.user.username}</span>
              </div>
              {current.media_url ? (
                current.media_type === "video" || isVideo(current.media_url) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={current.media_url} className="h-full w-full object-contain" autoPlay controls playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={current.media_url} alt="" className="h-full w-full object-contain" />
                )
              ) : (
                <div className="flex h-full w-full items-center justify-center p-8">
                  <p className="whitespace-pre-wrap text-center text-base leading-relaxed text-white">
                    {current.content || "Moment"}
                  </p>
                </div>
              )}
              {current.content && current.media_url && (
                <p className="absolute inset-x-4 bottom-16 z-20 text-center text-sm text-white drop-shadow-lg">
                  {current.content}
                </p>
              )}
              {current.expires_at && (
                <span className="absolute right-3 top-12 z-20 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-medium backdrop-blur">
                  ⏳ expires {new Date(current.expires_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              {active.is_self && current.type === "moment" && (
                <button
                  type="button"
                  className="absolute bottom-4 right-3 z-20 flex items-center gap-1.5 rounded-full bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-red-600"
                  onClick={() => void deleteMoment(current)}
                  disabled={deleting}
                >
                  {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  Delete
                </button>
              )}
              <button
                type="button"
                className="absolute inset-y-0 left-0 w-1/3"
                aria-label="Previous"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 w-1/3"
                aria-label="Next"
                onClick={() => {
                  if (index >= (active.items.length - 1)) setActive(null)
                  else setIndex((i) => i + 1)
                }}
              />
              <Link
                href={current.href}
                className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/15 px-4 py-1.5 text-xs backdrop-blur hover:bg-white/25"
              >
                Open full post
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

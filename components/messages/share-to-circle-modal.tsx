"use client"

import { useState, useEffect } from "react"
import { Search, Send, Check, Users, Share2, Film, Zap } from "lucide-react"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { parseJsonResponse } from "@/lib/parse-json-response"
import { Spinner } from "@/components/ui/skeletons"

export interface ShareToCircleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: {
    id: string
    type: "loop" | "reel"
    title?: string
    text?: string
    authorName?: string
    mediaUrl?: string
  } | null
}

interface CircleItem {
  id: string
  name: string
  avatar_url?: string
  member_count?: number
  description?: string
}

export function ShareToCircleModal({ open, onOpenChange, item }: ShareToCircleModalProps) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState("")
  const [circles, setCircles] = useState<CircleItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCircle, setSelectedCircle] = useState<CircleItem | null>(null)
  const [customNote, setCustomNote] = useState("")
  const [sending, setSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      fetchCircles()
      setCustomNote("")
      setSelectedCircle(null)
      setSentSuccess(false)
      setSearchQuery("")
    }
  }, [open])

  const fetchCircles = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/circles?joined=true&limit=100", {
        headers: getAuthHeader(),
      })
      const { data } = await parseJsonResponse<any>(res)
      if (res.ok && Array.isArray(data?.circles)) {
        setCircles(
          data.circles.map((c: any) => ({
            id: c.id,
            name: c.name || "Unnamed circle",
            avatar_url: c.avatar_url || c.image_url,
            member_count: Number(c.member_count || 0),
            description: c.description,
          })),
        )
      } else if (res.ok && Array.isArray(data?.data)) {
        setCircles(
          data.data.map((c: any) => ({
            id: c.id,
            name: c.name || "Unnamed circle",
            avatar_url: c.avatar_url || c.image_url,
            member_count: Number(c.member_count || 0),
            description: c.description,
          })),
        )
      } else {
        setCircles([])
      }
    } catch (err) {
      console.error("Failed to load circles:", err)
      setCircles([])
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!selectedCircle || !item) return

    setSending(true)
    try {
      const shareUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/${item.type === "reel" ? "reels?focus=" + item.id : "loop/" + item.id}`
          : `/${item.type === "reel" ? "reels?focus=" + item.id : "loop/" + item.id}`

      const shareText = customNote.trim()
        ? `${customNote.trim()}\n\n📌 Shared ${item.type === "reel" ? "Tree" : "Loop"}: ${item.title || "Check this out!"}\n${shareUrl}`
        : `📌 Shared ${item.type === "reel" ? "Tree" : "Loop"}: ${item.title || "Check this out!"}\n${shareUrl}`

      const res = await fetch(`/api/circles/${selectedCircle.id}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          content: shareText,
          media_url: item.mediaUrl || null,
          media_type: item.type === "reel" ? "video" : null,
        }),
      })

      const { data } = await parseJsonResponse<any>(res)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to share to circle")
      }

      setSentSuccess(true)
      toast({
        title: "Shared to Circle! 🎉",
        description: `Posted in ${selectedCircle.name}`,
      })

      setTimeout(() => {
        onOpenChange(false)
      }, 1000)
    } catch (err: any) {
      toast({
        title: "Couldn't share",
        description: err.message || "Failed to share to circle",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const filteredCircles = circles.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Share2 className="h-5 w-5 text-emerald-500" />
            Share {item?.type === "reel" ? "Tree" : "Loop"} in a Circle
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Post this content to your circle&apos;s community feed so everyone can see it.
          </DialogDescription>
        </DialogHeader>

        {/* Content Preview */}
        {item && (
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 my-2">
            {item.mediaUrl ? (
              <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-black/40">
                {item.type === "reel" ? (
                  <video src={item.mediaUrl} className="h-full w-full object-cover" />
                ) : (
                  <img src={item.mediaUrl} alt="Preview" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  {item.type === "reel" ? <Film className="h-4 w-4 text-white" /> : <Zap className="h-4 w-4 text-white" />}
                </div>
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                {item.type === "reel" ? <Film className="h-6 w-6" /> : <Users className="h-6 w-6" />}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-foreground">
                {item.title || item.text || "Untitled content"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                by {item.authorName || "Loop user"}
              </p>
            </div>
          </div>
        )}

        {/* Note input */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Add a message (optional)</label>
          <Textarea
            placeholder="Say something about this loop..."
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="min-h-[60px] text-xs resize-none rounded-xl"
            maxLength={200}
          />
        </div>

        {/* Circle picker */}
        <div className="space-y-2 mt-2">
          <label className="text-xs font-medium text-muted-foreground">Pick a circle</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your circles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs rounded-xl"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Spinner className="h-5 w-5 mr-2" />
                <span className="text-xs">Loading circles...</span>
              </div>
            ) : filteredCircles.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {circles.length === 0
                  ? "You haven't joined any circles yet. Join one from the Circles page to share content."
                  : "No circles match your search."}
              </div>
            ) : (
              filteredCircles.map((circle) => {
                const isSelected = selectedCircle?.id === circle.id
                return (
                  <button
                    key={circle.id}
                    type="button"
                    onClick={() => setSelectedCircle(circle)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                      isSelected
                        ? "bg-emerald-500/15 border border-emerald-500/30 text-foreground"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <VideoAvatar src={circle.avatar_url} className="h-8 w-8 shrink-0" fallback={circle.name.slice(0, 2).toUpperCase()} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate text-foreground">{circle.name}</p>
                        {typeof circle.member_count === "number" && (
                          <p className="text-[10px] text-muted-foreground">
                            {circle.member_count} member{circle.member_count === 1 ? "" : "s"}
                          </p>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-emerald-500 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!selectedCircle || sending || sentSuccess}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {sending ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                Sharing...
              </>
            ) : sentSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Shared!
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Post to Circle
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

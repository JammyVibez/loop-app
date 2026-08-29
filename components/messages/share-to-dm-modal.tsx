"use client"

import { useState, useEffect } from "react"
import { Search, Send, Check, MessageSquare, Loader2, Share2, Film, Zap, Link2, ExternalLink } from "lucide-react"
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

export interface ShareToDmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: {
    id: string
    type: "loop" | "reel"
    title?: string
    text?: string
    authorName?: string
    mediaUrl?: string
    /** content type of the media: "video" | "image" | undefined (text share) */
    mediaType?: string
  } | null
}

interface ConversationItem {
  id: string
  name: string
  avatar_url?: string
  username?: string
  other_user_id?: string
}

export function ShareToDmModal({ open, onOpenChange, item }: ShareToDmModalProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState("")
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null)
  const [customNote, setCustomNote] = useState("")
  const [sending, setSending] = useState(false)
  const [sentSuccess, setSentSuccess] = useState(false)

  const [searchedUsers, setSearchedUsers] = useState<ConversationItem[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)

  useEffect(() => {
    if (open && user) {
      fetchConversations()
      setCustomNote("")
      setSelectedConversation(null)
      setSentSuccess(false)
      setSearchQuery("")
      setSearchedUsers([])
    }
  }, [open, user])

  useEffect(() => {
    if (!open || !searchQuery.trim() || searchQuery.length < 2) {
      setSearchedUsers([])
      return
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(searchQuery.trim())}&limit=5`, {
          headers: getAuthHeader(),
        })
        const data = await res.json().catch(() => ({}))
        const userList = data.users || data.data || []
        const mapped: ConversationItem[] = userList
          .filter((u: any) => u.id !== user?.id)
          .map((u: any) => ({
            id: `new-${u.id}`,
            name: u.display_name || u.username || "User",
            avatar_url: u.avatar_url,
            username: u.username,
            other_user_id: u.id,
          }))
        setSearchedUsers(mapped)
      } catch (err) {
        console.error("Search users error:", err)
      } finally {
        setSearchingUsers(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, open, user])

  const fetchConversations = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/conversations", {
        headers: getAuthHeader(),
      })
      const { data } = await parseJsonResponse<any>(res)
      if (res.ok && data?.conversations) {
        const list: ConversationItem[] = data.conversations.map((c: any) => {
          const other = c.participants?.find((p: any) => p.user_id !== user?.id)?.user || c.other_user
          return {
            id: c.id,
            name: other?.display_name || other?.username || c.name || "Conversation",
            avatar_url: other?.avatar_url || c.avatar_url,
            username: other?.username,
            other_user_id: other?.id,
          }
        })
        setConversations(list)
      }
    } catch (err) {
      console.error("Failed to load conversations:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!selectedConversation || !item) return

    setSending(true)
    try {
      let targetConversationId = selectedConversation.id

      // If this is a new conversation target created from search
      if (targetConversationId.startsWith("new-") && selectedConversation.other_user_id) {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            participant_id: selectedConversation.other_user_id,
          }),
        })
        const createData = await createRes.json()
        if (!createRes.ok || !createData.conversation?.id) {
          throw new Error(createData.error || "Failed to start conversation")
        }
        targetConversationId = createData.conversation.id
      }

      const shareUrl = typeof window !== "undefined"
        ? `${window.location.origin}/${item.type === "reel" ? "reels?focus=" + item.id : "loop/" + item.id}`
        : `/${item.type === "reel" ? "reels?focus=" + item.id : "loop/" + item.id}`

      const shareText = customNote.trim()
        ? `${customNote.trim()}\n\n📌 Shared ${item.type === "reel" ? "Tree" : "Loop"}: ${item.title || "Check this out!"}\n${shareUrl}`
        : `📌 Shared ${item.type === "reel" ? "Tree" : "Loop"}: ${item.title || "Check this out!"}\n${shareUrl}`

      // Reels with media are sent as real video/image messages so the
      // recipient sees the inline player — not just a text link.
      const mediaKind = item.mediaType === "video" || item.mediaType === "image" ? item.mediaType : null

      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          conversation_id: targetConversationId,
          content: shareText,
          message_type: mediaKind || "text",
          media_url: item.mediaUrl || null,
        }),
      })

      const { data } = await parseJsonResponse<any>(res)
      if (!res.ok) {
        throw new Error(data?.error || "Failed to send message")
      }

      setSentSuccess(true)
      toast({
        title: "Shared in DM! 📩",
        description: `Sent to ${selectedConversation.name}`,
      })

      setTimeout(() => {
        onOpenChange(false)
      }, 1000)
    } catch (err: any) {
      toast({
        title: "Couldn't share",
        description: err.message || "Failed to send to DM",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const buildShareUrl = () => {
    if (!item) return ""
    return typeof window !== "undefined"
      ? `${window.location.origin}/${item.type === "reel" ? "reels?focus=" + item.id : "loop/" + item.id}`
      : `/${item.type === "reel" ? "reels?focus=" + item.id : "loop/" + item.id}`
  }

  const copyLink = async () => {
    const url = buildShareUrl()
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: "Link copied!", description: "Paste it anywhere to share this content." })
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" })
    }
  }

  const shareToApps = async () => {
    const url = buildShareUrl()
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: item?.title || "Check this out on Loop",
          text: item?.title ? `${item.title} — on Loop` : "Check this out on Loop",
          url,
        })
      } catch {
        /* user cancelled the share sheet */
      }
    } else {
      await copyLink()
    }
  }

  const filteredConversations = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.username && c.username.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const existingOtherUserIds = new Set(conversations.map((c) => c.other_user_id).filter(Boolean))
  const uniqueSearched = searchedUsers.filter((u) => u.other_user_id && !existingOtherUserIds.has(u.other_user_id))
  const displayList = [...filteredConversations, ...uniqueSearched]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border text-foreground rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Share2 className="h-5 w-5 text-violet-500" />
            Share {item?.type === "reel" ? "Tree" : "Loop"} in DM
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Send this content directly to a friend or group chat.
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
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500">
                {item.type === "reel" ? <Film className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
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

        {/* Share to other apps / copy link */}
        <div className="flex gap-2 my-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs"
            onClick={() => void shareToApps()}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Share to apps
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 rounded-xl text-xs"
            onClick={() => void copyLink()}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Copy link
          </Button>
        </div>

        {/* Note input */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Add a message (optional)</label>
          <Textarea
            placeholder="Type your message..."
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            className="min-h-[60px] text-xs resize-none rounded-xl"
            maxLength={200}
          />
        </div>

        {/* Search & Conversations */}
        <div className="space-y-2 mt-2">
          <label className="text-xs font-medium text-muted-foreground">Select recipient</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search chat or friend..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs rounded-xl"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">Loading chats...</span>
              </div>
            ) : displayList.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {searchingUsers ? "Searching users..." : "No chat conversations or users found."}
              </div>
            ) : (
              displayList.map((chat) => {
                const isSelected = selectedConversation?.id === chat.id
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setSelectedConversation(chat)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors ${
                      isSelected
                        ? "bg-violet-500/15 border border-violet-500/30 text-foreground"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <VideoAvatar src={chat.avatar_url} className="h-8 w-8 shrink-0" fallback={chat.name.slice(0, 2).toUpperCase()} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate text-foreground">{chat.name}</p>
                        {chat.username && (
                          <p className="text-[10px] text-muted-foreground">@{chat.username}</p>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-violet-500 shrink-0" />}
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
            disabled={!selectedConversation || sending || sentSuccess}
            className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium"
          >
            {sending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : sentSuccess ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                Sent!
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send DM
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

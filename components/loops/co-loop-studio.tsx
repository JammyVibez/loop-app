"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Send, Sparkles, Copy, Check, MessageSquare, Plus, UserPlus, Image as ImageIcon, Code, Radio, Zap, ExternalLink } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabase"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"

interface Collaborator {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  role?: string
}

interface CoLoopStudioProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collabId: string
  initialContent?: string
  initialHashtags?: string
  onPublished?: (loop: any) => void
}

interface ChatMessage {
  id: string
  sender_name: string
  text: string
  timestamp: string
}

export function CoLoopStudio({
  open,
  onOpenChange,
  collabId,
  initialContent = "",
  initialHashtags = "",
  onPublished
}: CoLoopStudioProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [content, setContent] = useState(initialContent)
  const [hashtags, setHashtags] = useState(initialHashtags)
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaType, setMediaType] = useState<"text" | "image" | "code">("text")
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [activePeers, setActivePeers] = useState<any[]>([])
  const [peerTyping, setPeerTyping] = useState<string | null>(null)
  const [studioMessages, setStudioMessages] = useState<ChatMessage[]>([
    { id: "1", sender_name: "Co-Loop Bot 🤝", text: "Studio connected! Edits and presence sync in real time.", timestamp: "Just now" }
  ])
  const [chatInput, setChatInput] = useState("")
  const [inviteUsername, setInviteUsername] = useState("")
  const [inviteSearching, setInviteSearching] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const remoteUpdating = useRef(false)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Initialize self as primary collaborator
  useEffect(() => {
    if (user && !collaborators.some(c => c.id === user.id)) {
      setCollaborators([
        {
          id: user.id,
          username: user.username || "creator",
          display_name: user.display_name || user.username || "Creator",
          avatar_url: user.avatar_url,
          role: "Lead Author"
        }
      ])
    }
  }, [user])

  // Realtime Supabase Broadcast Channel
  useEffect(() => {
    if (!open || !collabId || !user || !supabase) return

    const channel = supabase.channel(`co_loop_studio:${collabId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: user.id }
      }
    })

    channelRef.current = channel

    channel
      .on("broadcast", { event: "draft_update" }, ({ payload }) => {
        if (!payload || payload.user_id === user.id) return
        remoteUpdating.current = true
        if (typeof payload.content === "string") setContent(payload.content)
        if (typeof payload.hashtags === "string") setHashtags(payload.hashtags)
        if (payload.mediaUrl) setMediaUrl(payload.mediaUrl)
        if (payload.mediaType) setMediaType(payload.mediaType)
        if (Array.isArray(payload.collaborators)) setCollaborators(payload.collaborators)
        queueMicrotask(() => {
          remoteUpdating.current = false
        })
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.user_id === user.id) return
        setPeerTyping(payload.username || "A collaborator")
        setTimeout(() => setPeerTyping(null), 2500)
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        if (!payload) return
        setStudioMessages((prev) => [...prev, payload])
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const peers = Object.values(state).flat()
        setActivePeers(peers)
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_url: user.avatar_url
          })
        }
      })

    return () => {
      channelRef.current = null
      void supabase.removeChannel(channel)
    }
  }, [open, collabId, user?.id])

  // Sync content broadcasts
  useEffect(() => {
    if (!open || !collabId || !user || remoteUpdating.current) return
    const timer = setTimeout(() => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "draft_update",
        payload: {
          user_id: user.id,
          content,
          hashtags,
          mediaUrl,
          mediaType,
          collaborators
        }
      })
    }, 200)
    return () => clearTimeout(timer)
  }, [content, hashtags, mediaUrl, mediaType, collaborators, open, collabId, user?.id])

  const handleTextChange = (val: string) => {
    setContent(val)
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user?.id, username: user?.username }
    })
  }

  const handleSendStudioChat = () => {
    if (!chatInput.trim()) return
    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender_name: user?.display_name || user?.username || "You",
      text: chatInput.trim(),
      timestamp: "Just now"
    }
    setStudioMessages((prev) => [...prev, msg])
    setChatInput("")

    void channelRef.current?.send({
      type: "broadcast",
      event: "chat_message",
      payload: msg
    })

    setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
    }, 100)
  }

  const handleInviteUser = async () => {
    if (!inviteUsername.trim()) return
    setInviteSearching(true)
    try {
      // Find user profile
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(inviteUsername.trim())}`)
      const data = await res.json().catch(() => ({}))
      const targetUser = data.users?.[0] || data.user

      if (!targetUser) {
        toast({ title: "User not found", description: `Could not find @${inviteUsername}`, variant: "destructive" })
        return
      }

      const newCollab: Collaborator = {
        id: targetUser.id,
        username: targetUser.username,
        display_name: targetUser.display_name || targetUser.username,
        avatar_url: targetUser.avatar_url,
        role: "Co-Author"
      }

      if (collaborators.some((c) => c.id === newCollab.id)) {
        toast({ title: "Already added", description: `@${newCollab.username} is already in the Co-Loop!` })
        return
      }

      const updated = [...collaborators, newCollab]
      setCollaborators(updated)

      // Send real invitation to Supabase invitations table & chat
      await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          inviteeId: targetUser.id,
          type: "loop_collaboration",
          resourceId: collabId,
          message: `${user?.display_name || "Someone"} invited you to co-create a loop in Co-Loop Studio! Code: ${collabId}`
        })
      }).catch(() => {})

      toast({
        title: "Collaborator Invited! 🤝",
        description: `@${newCollab.username} was added to the Co-Loop team.`
      })

      setInviteUsername("")
    } catch (err: any) {
      toast({ title: "Could not invite", description: err.message || "Try again", variant: "destructive" })
    } finally {
      setInviteSearching(false)
    }
  }

  const handleCopyCode = () => {
    void navigator.clipboard.writeText(collabId)
    setCopiedCode(true)
    toast({ title: "Collab Code Copied", description: "Share this code with your co-creators!" })
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handlePublishCoLoop = async () => {
    if (!content.trim()) {
      toast({ title: "Empty loop", description: "Please enter some content for your Co-Loop.", variant: "destructive" })
      return
    }

    setPublishing(true)
    try {
      const tagList = hashtags
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim())
        .filter(Boolean)

      const payload = {
        content,
        media_type: mediaType,
        media_url: mediaUrl || undefined,
        hashtags: tagList,
        content_metadata: {
          is_co_loop: true,
          collab_id: collabId,
          co_authors: collaborators
        }
      }

      const res = await fetch("/api/loops", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Publishing failed")

      toast({
        title: "Co-Loop Published! 🎉",
        description: `Your collaborative post with ${collaborators.length} authors is live on the feed!`
      })

      if (onPublished) onPublished(data.loop || data)
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: "Publish error", description: err.message, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-cyan-500/30 bg-[#070c18] text-white p-0 overflow-hidden shadow-2xl shadow-cyan-500/10">
        <DialogHeader className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-purple-950/20 to-background flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                Co-Loop Realtime Studio
                <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[10px] font-bold">
                  LIVE SYNC
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Write & curate posts simultaneously with up to 4 co-authors
              </DialogDescription>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyCode}
            className="rounded-full border-cyan-500/40 bg-cyan-950/40 text-xs text-cyan-300 hover:bg-cyan-900/40"
          >
            {copiedCode ? <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            Code: {collabId.slice(0, 8)}...
          </Button>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row h-[75vh] max-h-[650px]">
          {/* Main Editor Section */}
          <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-4 overflow-y-auto border-b lg:border-b-0 lg:border-r border-white/10">
            {/* Stacked Avatars & Collaborator Roster Header */}
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-cyan-300">Co-Authors:</span>
                {/* Stacked PFPs */}
                <div className="flex -space-x-3 overflow-hidden">
                  {collaborators.map((c, i) => (
                    <Avatar key={c.id || i} className="h-8 w-8 ring-2 ring-cyan-400/80 shadow">
                      <AvatarImage src={c.avatar_url} />
                      <AvatarFallback className="bg-cyan-900 text-xs font-bold">{c.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <span className="text-xs text-slate-300 font-medium">
                  {collaborators.map((c) => `@${c.username}`).join(" × ")}
                </span>
              </div>

              {/* Active Online Presence */}
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span>{Math.max(activePeers.length, 1)} Active in Studio</span>
              </div>
            </div>

            {/* Peer Typing Alert */}
            {peerTyping && (
              <div className="text-xs text-cyan-400 animate-pulse flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{peerTyping} is typing changes...</span>
              </div>
            )}

            {/* Realtime Content Textarea */}
            <div className="flex-1 space-y-2 flex flex-col min-h-[160px]">
              <label className="text-xs font-semibold text-slate-300">Co-Loop Story / Article</label>
              <Textarea
                placeholder="Write your collaborative loop here... edits sync instantly across co-authors!"
                value={content}
                onChange={(e) => handleTextChange(e.target.value)}
                className="flex-1 min-h-[140px] resize-none border-white/10 bg-black/60 text-sm text-white focus-visible:ring-cyan-500"
              />
            </div>

            {/* Media & Hashtag Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Hashtags</label>
                <Input
                  placeholder="#tech #collab #design"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="border-white/10 bg-black/60 text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 mb-1 block">Media URL (Optional)</label>
                <Input
                  placeholder="https://..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="border-white/10 bg-black/60 text-xs text-white"
                />
              </div>
            </div>

            {/* Publish & Invite Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-white/10">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Invite @username..."
                  value={inviteUsername}
                  onChange={(e) => setInviteUsername(e.target.value)}
                  className="w-40 sm:w-48 h-9 border-white/10 bg-black/60 text-xs text-white"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleInviteUser}
                  disabled={inviteSearching}
                  className="h-9 rounded-full border-cyan-500/40 text-xs text-cyan-300 hover:bg-cyan-950"
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>

              <Button
                onClick={handlePublishCoLoop}
                disabled={publishing || !content.trim()}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 font-bold text-white shadow-lg shadow-cyan-500/20 hover:brightness-110"
              >
                <Zap className="mr-1.5 h-4 w-4 fill-white" />
                {publishing ? "Publishing..." : "Publish Co-Loop"}
              </Button>
            </div>
          </div>

          {/* Studio Chat & Collaborator Panel */}
          <div className="w-full lg:w-80 bg-[#050812] flex flex-col justify-between p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="font-bold text-white text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-cyan-400" /> Studio Live Chat
              </h4>
              <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px]">
                Collaborators
              </Badge>
            </div>

            {/* Chat Stream */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2.5 my-2 pr-1 text-xs">
              {studioMessages.map((msg) => (
                <div key={msg.id} className="rounded-xl bg-white/[0.04] p-2.5 border border-white/5 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-cyan-300">{msg.sender_name}</span>
                    <span className="text-slate-500 text-[10px]">{msg.timestamp}</span>
                  </div>
                  <p className="text-slate-200 leading-normal">{msg.text}</p>
                </div>
              ))}
            </div>

            {/* Chat Input */}
            <div className="flex gap-2 pt-2 border-t border-white/10">
              <Input
                placeholder="Studio chat..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendStudioChat()}
                className="rounded-full border-white/10 bg-black/60 text-xs text-white"
              />
              <Button
                size="icon"
                onClick={handleSendStudioChat}
                className="rounded-full bg-cyan-500 text-black hover:bg-cyan-400 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

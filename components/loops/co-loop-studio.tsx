"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import {
  Sparkles,
  Users,
  Send,
  Image as ImageIcon,
  Share2,
  CheckCircle2,
  Lock,
  MessageSquare,
  Plus,
  Trash2,
  UploadCloud,
  Loader2,
  Radio,
  History,
  RotateCcw,
  GitCommit,
  UserPlus,
  Gift,
  Copy,
  Check,
  Crown,
  Coins,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { CoLoopVersionHistory, CoLoopVersion } from "./co-loop-version-history"

interface Collaborator {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  role?: string
  typingField?: string | null
  color?: string
}

interface ChatMessage {
  id: string
  sender_id: string
  sender_name: string
  sender_avatar?: string
  text: string
  timestamp: string
}

const AVATAR_COLORS = ["#3b82f6", "#ec4899", "#10b981", "#8b5cf6"]

export function CoLoopStudio() {
  const { user, getAuthHeader } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const sessionId = searchParams.get("session") || "demo-session-1"

  // Live Post State
  const [postTitle, setPostTitle] = useState("")
  const [postContent, setPostContent] = useState("")
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text")

  // Real-time Collaboration & Version History State
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [publishing, setPublishing] = useState(false)
  const [invitedUserInput, setInvitedUserInput] = useState("")
  const [coAuthors, setCoAuthors] = useState<Collaborator[]>([])
  const [userSuggestions, setUserSuggestions] = useState<any[]>([])
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Version History State
  const [versions, setVersions] = useState<CoLoopVersion[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  const supabaseRef = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Load saved versions from local storage for session
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`co-loop-versions:${sessionId}`)
      if (stored) {
        setVersions(JSON.parse(stored))
      }
    } catch (err) {
      console.error("Failed loading local version history:", err)
    }
  }, [sessionId])

  // Live user search effect for co-author matching
  useEffect(() => {
    const q = invitedUserInput.trim().replace(/^@/, "")
    if (!q) {
      setUserSuggestions([])
      setShowSuggestions(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=users&limit=6`)
        if (res.ok) {
          const data = await res.json()
          setUserSuggestions(data.users || [])
          setShowSuggestions(true)
        }
      } catch (err) {
        console.error("Co-author search error:", err)
      } finally {
        setSearchingUsers(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [invitedUserInput])

  // Initialize Supabase Client
  useEffect(() => {
    supabaseRef.current = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
  }, [])

  // Join Realtime Channel for Studio Presence & Broadcast
  useEffect(() => {
    if (!user || !supabaseRef.current) return

    const supabase = supabaseRef.current
    const channel = supabase.channel(`co-loop-studio:${sessionId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    channelRef.current = channel

    // Handle Presence state updates
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState()
        const activeUsers: Collaborator[] = []
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[]
          if (presences && presences[0]) {
            activeUsers.push(presences[0])
          }
        })
        setCollaborators(activeUsers)
      })
      .on("presence", { event: "join" }, ({ newPresences }: any) => {
        if (newPresences?.[0]?.display_name) {
          toast({
            title: "Creator Joined!",
            description: `${newPresences[0].display_name} entered the Co-Loop Studio.`,
          })
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: any) => {
        if (leftPresences?.[0]?.display_name) {
          toast({
            title: "Creator Left",
            description: `${leftPresences[0].display_name} disconnected from studio.`,
          })
        }
      })
      // Handle Studio Broadcast Edits
      .on("broadcast", { event: "doc-update" }, ({ payload }: any) => {
        if (payload.title !== undefined) setPostTitle(payload.title)
        if (payload.content !== undefined) setPostContent(payload.content)
        if (payload.hashtags !== undefined) setHashtags(payload.hashtags)
        if (payload.mediaUrl !== undefined) setMediaUrl(payload.mediaUrl)
        if (payload.mediaType !== undefined) setMediaType(payload.mediaType)
        if (payload.coAuthors !== undefined) setCoAuthors(payload.coAuthors)
      })
      .on("broadcast", { event: "co-author-accepted" }, ({ payload }: any) => {
        if (payload?.user) {
          const acceptedUser = payload.user
          setCoAuthors((prev) => {
            if (prev.some((c) => c.id === acceptedUser.id)) return prev
            const updated = [...prev, acceptedUser]
            toast({
              title: "Invite Accepted! 🎉",
              description: `@${acceptedUser.username} joined as an official co-author!`,
            })
            return updated
          })
        }
      })
      .on("broadcast", { event: "co-loop-gift" }, ({ payload }: any) => {
        if (payload) {
          toast({
            title: "Co-Loop Split Gift! 🎁",
            description: `${payload.senderName} gifted ${payload.amount} coins! Each co-author received ${payload.splitAmount} Loop Coins!`,
          })
        }
      })
      // Handle Studio Chat Messages
      .on("broadcast", { event: "chat-msg" }, ({ payload }: any) => {
        setChatMessages((prev) => [...prev, payload])
      })
      // Handle Studio Version Snapshots
      .on("broadcast", { event: "version-saved" }, ({ payload }: any) => {
        setVersions((prev) => [payload, ...prev.filter((v) => v.id !== payload.id)])
        toast({
          title: "Version Snapshot Saved 📸",
          description: `${payload.savedBy?.name || "Collaborator"} created Version v${payload.versionNumber}`,
        })
      })
      .on("broadcast", { event: "version-restored" }, ({ payload }: any) => {
        if (payload.version) {
          const v = payload.version
          setPostTitle(v.title || "")
          setPostContent(v.content || "")
          setHashtags(v.hashtags || [])
          setMediaUrl(v.mediaUrl || "")
          setMediaType(v.mediaType || "text")
          if (v.coAuthors) {
            setCoAuthors(v.coAuthors.map((ca: any) => ({ ...ca, role: ca.role || "Co-Author" })))
          }
          toast({
            title: "Version Restored 🔄",
            description: `${payload.restoredBy || "Collaborator"} restored Version v${v.versionNumber}`,
          })
        }
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          const myProfile: Collaborator = {
            id: user.id,
            username: user.username || "creator",
            display_name: user.display_name || user.username || "Creator",
            avatar_url: user.avatar_url,
            role: "Co-Creator",
            color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          }
          await channel.track(myProfile)
        }
      })

    return () => {
      channel.unsubscribe()
    }
  }, [user, sessionId])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  // Save version snapshot
  const handleSaveSnapshot = (label?: string) => {
    if (!user) return
    const nextVerNum = versions.length > 0 ? Math.max(...versions.map((v) => v.versionNumber)) + 1 : 1

    const newVersion: CoLoopVersion = {
      id: `ver-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      versionNumber: nextVerNum,
      title: postTitle,
      content: postContent,
      hashtags,
      mediaUrl,
      mediaType,
      coAuthors,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }),
      savedBy: {
        id: user.id,
        name: user.display_name || user.username || "Creator",
        avatar: user.avatar_url,
      },
      label: label || (nextVerNum === 1 ? "Initial Draft" : `Checkpoint #${nextVerNum}`),
    }

    const updated = [newVersion, ...versions]
    setVersions(updated)
    try {
      localStorage.setItem(`co-loop-versions:${sessionId}`, JSON.stringify(updated))
    } catch (err) {
      console.error("Localstorage snapshot save error:", err)
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "version-saved",
        payload: newVersion,
      })
    }

    toast({
      title: "Snapshot Saved! 📸",
      description: `Version v${nextVerNum} ("${newVersion.label}") recorded.`,
    })
  }

  // Restore previous version
  const handleRestoreVersion = (version: CoLoopVersion) => {
    setPostTitle(version.title || "")
    setPostContent(version.content || "")
    setHashtags(version.hashtags || [])
    setMediaUrl(version.mediaUrl || "")
    setMediaType(version.mediaType || "text")
    if (version.coAuthors) {
      setCoAuthors(version.coAuthors.map((ca: any) => ({ ...ca, role: ca.role || "Co-Author" })))
    }

    const docUpdatePayload = {
      title: version.title || "",
      content: version.content || "",
      hashtags: version.hashtags || [],
      mediaUrl: version.mediaUrl || "",
      mediaType: version.mediaType || "text",
      coAuthors: version.coAuthors || [],
    }

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "doc-update",
        payload: docUpdatePayload,
      })
      channelRef.current.send({
        type: "broadcast",
        event: "version-restored",
        payload: {
          version,
          restoredBy: user?.display_name || user?.username || "Collaborator",
        },
      })
    }

    toast({
      title: "Version Restored! 🔄",
      description: `Reverted post to Version v${version.versionNumber}`,
    })
  }

  // Broadcast Live Changes
  const broadcastDocUpdate = (update: Record<string, any>) => {
    if (!channelRef.current) return
    channelRef.current.send({
      type: "broadcast",
      event: "doc-update",
      payload: update,
    })
  }

  const handleTitleChange = (val: string) => {
    setPostTitle(val)
    broadcastDocUpdate({ title: val })
  }

  const handleContentChange = (val: string) => {
    setPostContent(val)
    broadcastDocUpdate({ content: val })
  }

  const handleAddHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, "")
    if (!tag || hashtags.includes(tag)) return
    const nextTags = [...hashtags, tag]
    setHashtags(nextTags)
    setHashtagInput("")
    broadcastDocUpdate({ hashtags: nextTags })
  }

  const handleRemoveHashtag = (tagToRemove: string) => {
    const nextTags = hashtags.filter((t) => t !== tagToRemove)
    setHashtags(nextTags)
    broadcastDocUpdate({ hashtags: nextTags })
  }

  // Send In-Studio Chat
  const handleSendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const text = chatInput.trim()
    if (!text || !user || !channelRef.current) return

    const msg: ChatMessage = {
      id: "msg-" + Date.now(),
      sender_id: user.id,
      sender_name: user.display_name || user.username || "Creator",
      sender_avatar: user.avatar_url,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setChatMessages((prev) => [...prev, msg])
    channelRef.current.send({
      type: "broadcast",
      event: "chat-msg",
      payload: msg,
    })
    setChatInput("")
  }

  // Modals & Links state
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [isSendingGift, setIsSendingGift] = useState(false)

  // Copy shareable session link
  const handleCopyInviteLink = () => {
    const url = `${window.location.origin}/co-loop/studio?session=${sessionId}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    toast({
      title: "Session Link Copied! 🔗",
      description: "Shareable link copied to clipboard. Anyone with this link can request to join.",
    })
    setTimeout(() => setLinkCopied(false), 3000)
  }

  // Send Direct DM & Notification Invite to a creator
  const handleSendInviteToUser = async (targetUser: any) => {
    if (!targetUser?.id) return
    setSendingInvite(true)
    try {
      const res = await fetch("/api/co-loop/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          invitee_id: targetUser.id,
          session_id: sessionId,
          session_title: postTitle || "Untitled Co-Loop",
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: "Invitation Sent! 📩",
          description: `Sent DM & notification to @${targetUser.username || targetUser.display_name}. They will be listed as co-author once they accept!`,
        })
      } else {
        toast({
          title: "Failed to send invite",
          description: data.error || "Could not send invitation",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({ title: "Error sending invite", variant: "destructive" })
    } finally {
      setSendingInvite(false)
      setInvitedUserInput("")
      setUserSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle Split Gifting among co-authors
  const handleSendSplitGift = async (amount: number) => {
    if (!user) return
    setIsSendingGift(true)
    try {
      // Gather active authors (Primary Creator + Accepted Co-Authors)
      const allAuthors = [
        { id: user.id, username: user.username, display_name: user.display_name },
        ...coAuthors,
      ]

      const res = await fetch("/api/co-loop/gift", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          session_id: sessionId,
          gift_amount: amount,
          recipients: allAuthors,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast({
          title: "Co-Loop Gift Sent! 🎁",
          description: `Gifted ${amount} coins! Each co-author received ${data.splitAmount} Loop Coins!`,
        })

        // Broadcast gift event live to studio
        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "co-loop-gift",
            payload: {
              senderName: user.display_name || user.username,
              amount,
              splitAmount: data.splitAmount,
            },
          })
        }
        setGiftModalOpen(false)
      } else {
        toast({
          title: "Gifting Failed",
          description: data.error || "Could not process gift",
          variant: "destructive",
        })
      }
    } catch (err) {
      toast({ title: "Gifting Error", variant: "destructive" })
    } finally {
      setIsSendingGift(false)
    }
  }

  // Publish Co-Loop Post
  const handlePublishCoLoop = async () => {
    if (!postContent.trim()) {
      toast({ title: "Content required", description: "Write something for your co-loop post!", variant: "destructive" })
      return
    }

    setPublishing(true)
    try {
      const coAuthorsMetadata = coAuthors.map((ca) => ({
        id: ca.id,
        username: ca.username,
        display_name: ca.display_name,
        avatar_url: ca.avatar_url,
        role: ca.role || "Co-Author",
      }))

      const payload = {
        content: postContent,
        content_title: postTitle || null,
        media_url: mediaUrl || null,
        media_type: mediaType,
        hashtags,
        is_co_loop: true,
        co_authors: coAuthorsMetadata,
        content_metadata: {
          is_co_loop: true,
          co_authors: coAuthorsMetadata,
          studio_session_id: sessionId,
        },
      }

      const res = await fetch("/api/loops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish co-loop")

      toast({
        title: "Co-Loop Published! 🎉",
        description: "Your collaborative post is live with stacked co-author credits!",
      })
      router.push("/")
    } catch (err: any) {
      toast({
        title: "Publish failed",
        description: err.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setPublishing(false)
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
        <Card className="max-w-md p-6 border-cyan-500/30">
          <Lock className="mx-auto h-12 w-12 text-cyan-400 mb-3" />
          <h2 className="text-xl font-bold">Studio Authentication Required</h2>
          <p className="text-sm text-muted-foreground mt-2">Log in to collaborate live in the Co-Loop Studio.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-card to-purple-950/40 p-5 shadow-lg shadow-cyan-500/10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white font-bold shadow-md shadow-cyan-500/20">
            <Sparkles className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-400 bg-clip-text text-transparent">
                Co-Loop Studio
              </h1>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-bold">
                <Radio className="h-3 w-3 mr-1 text-cyan-400 animate-pulse" />
                LIVE SUPABASE SYNC
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time multi-author co-creation stage • Session #{sessionId}
            </p>
          </div>
        </div>

        {/* Active Collaborators, Invites & Version History Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setInviteModalOpen(true)}
            className="rounded-xl border-cyan-500/50 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-bold gap-1.5 shadow-md shadow-cyan-500/10"
          >
            <UserPlus className="h-4 w-4 text-cyan-400 animate-bounce" />
            Invite Collaborator
          </Button>

          <Button
            variant="outline"
            onClick={() => setGiftModalOpen(true)}
            className="rounded-xl border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-500/20 text-xs font-bold gap-1.5 shadow-sm"
          >
            <Coins className="h-4 w-4 text-amber-400" />
            Gift Co-Loop
          </Button>

          <Button
            variant="outline"
            onClick={() => setHistoryOpen(true)}
            className="rounded-xl border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold gap-1.5 shadow-sm"
          >
            <History className="h-4 w-4 text-cyan-400" />
            Version History
            {versions.length > 0 && (
              <Badge className="bg-cyan-500 text-black text-[10px] px-1.5 py-0 rounded-full font-extrabold ml-1">
                {versions.length}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-3 bg-muted/40 border border-border/60 rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-cyan-400" />
              Active ({collaborators.length || 1}/4):
            </span>
            <div className="flex items-center -space-x-2 overflow-hidden">
              <Avatar className="h-8 w-8 ring-2 ring-cyan-500">
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback>{(user.display_name || user.username || "U").charAt(0)}</AvatarFallback>
              </Avatar>
              {collaborators
                .filter((c) => c.id !== user.id)
                .map((collab) => (
                  <Avatar key={collab.id} className="h-8 w-8 ring-2 ring-purple-500" title={collab.display_name}>
                    <AvatarImage src={collab.avatar_url} />
                    <AvatarFallback>{collab.display_name?.charAt(0) || "C"}</AvatarFallback>
                  </Avatar>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Left Editor & Right Chat/Co-Authors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor Area (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-border/60 bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Co-Loop Editor
              </span>
              <span className="text-[11px] text-muted-foreground italic">
                Changes sync live across all collaborators
              </span>
            </div>

            {/* Optional Title Input */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                Co-Loop Title (Optional)
              </label>
              <Input
                value={postTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Next-Gen AI Social Architecture..."
                className="rounded-xl border-border bg-muted/40 text-sm font-semibold"
              />
            </div>

            {/* Post Content Input */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                Post Content
              </label>
              <Textarea
                value={postContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Co-write your story, insights, or code snippet live..."
                className="min-h-[180px] rounded-xl border-border bg-muted/40 text-sm leading-relaxed"
              />
            </div>

            {/* Hashtags Input */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                Hashtags
              </label>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHashtag())}
                  placeholder="e.g. #CoLoop #Tech"
                  className="rounded-xl border-border bg-muted/40 text-xs"
                />
                <Button type="button" onClick={handleAddHashtag} variant="secondary" size="sm" className="rounded-xl">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1"
                  >
                    #{tag}
                    <button type="button" onClick={() => handleRemoveHashtag(tag)} className="hover:text-rose-400">
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Media Attachment */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">
                Media URL (Image / Video)
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value)
                    broadcastDocUpdate({ mediaUrl: e.target.value })
                  }}
                  placeholder="https://images.unsplash.com/photo-..."
                  className="rounded-xl border-border bg-muted/40 text-xs"
                />
                <Button
                  type="button"
                  variant={mediaType === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMediaType("image")
                    broadcastDocUpdate({ mediaType: "image" })
                  }}
                  className="rounded-xl text-xs"
                >
                  Image
                </Button>
                <Button
                  type="button"
                  variant={mediaType === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setMediaType("video")
                    broadcastDocUpdate({ mediaType: "video" })
                  }}
                  className="rounded-xl text-xs"
                >
                  Video
                </Button>
              </div>
            </div>

            {/* Publish Action Button */}
            <div className="pt-3 border-t border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Stacked co-authors will receive post credits
              </div>
              <Button
                onClick={handlePublishCoLoop}
                disabled={publishing}
                className="rounded-xl bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 font-bold text-white shadow-lg shadow-cyan-500/25 px-6"
              >
                {publishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" /> Publish Co-Loop
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Side Panel: In-Studio Chat & Co-Authors List */}
        <div className="space-y-5">
          {/* Co-Authors Manager */}
          <Card className="border-border/60 bg-card p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-purple-400" />
              Co-Authors Roster ({coAuthors.length + 1})
            </h3>

            <div className="space-y-2">
              {/* Creator */}
              <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8 ring-2 ring-cyan-500">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>{(user.display_name || user.username).charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-bold">{user.display_name || user.username}</p>
                    <p className="text-[10px] text-cyan-400 font-semibold">Primary Creator</p>
                  </div>
                </div>
              </div>

              {/* Added Co-authors */}
              {coAuthors.map((ca) => (
                <div key={ca.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 ring-2 ring-purple-500">
                      <AvatarImage src={ca.avatar_url} />
                      <AvatarFallback>{ca.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-bold">{ca.display_name}</p>
                      <p className="text-[10px] text-muted-foreground">@{ca.username}</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const updated = coAuthors.filter((c) => c.id !== ca.id)
                      setCoAuthors(updated)
                      broadcastDocUpdate({ coAuthors: updated })
                    }}
                    className="h-7 w-7 text-muted-foreground hover:text-rose-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add Co-author input with live suggestions */}
            <div className="relative pt-1">
              <div className="flex items-center gap-2">
                <Input
                  value={invitedUserInput}
                  onChange={(e) => setInvitedUserInput(e.target.value)}
                  onFocus={() => invitedUserInput.trim() && setShowSuggestions(true)}
                  placeholder="Search @username to send invite..."
                  className="rounded-xl border-border bg-muted/40 text-xs h-8"
                />
                <Button onClick={() => setInviteModalOpen(true)} size="sm" variant="outline" className="rounded-xl text-xs h-8 shrink-0 gap-1 border-cyan-500/40 text-cyan-400">
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </Button>
              </div>

              {/* Suggestions Dropdown Overlay */}
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-cyan-500/30 bg-card/95 p-1.5 shadow-xl backdrop-blur-md space-y-1 max-h-48 overflow-y-auto">
                  {searchingUsers ? (
                    <div className="flex items-center justify-center py-2 text-xs text-muted-foreground gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                      Searching creators...
                    </div>
                  ) : userSuggestions.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground text-center italic">No matching creators found</p>
                  ) : (
                    userSuggestions.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSendInviteToUser(u)}
                        className="w-full flex items-center justify-between rounded-lg p-1.5 text-left text-xs hover:bg-cyan-500/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={u.avatar_url} />
                            <AvatarFallback className="text-[10px] bg-cyan-500/20 text-cyan-300">
                              {(u.display_name || u.username || "U").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate text-foreground">{u.display_name || u.username}</p>
                            <p className="text-[10px] text-muted-foreground truncate">@{u.username}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-cyan-500/30 text-cyan-400 font-bold shrink-0">
                          Send Invite
                        </Badge>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* In-Studio Chat Panel */}
          <Card className="border-border/60 bg-card p-4 flex flex-col h-[380px]">
            <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-cyan-400" />
                In-Studio Chat
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">Real-time</span>
            </div>

            <ScrollArea className="flex-1 pr-2">
              <div className="space-y-3 py-1">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 italic">
                    No messages yet. Brainstorm ideas live with your co-authors!
                  </p>
                ) : (
                  chatMessages.map((msg) => {
                    const isMe = msg.sender_id === user.id
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-2 text-xs ${isMe ? "flex-row-reverse" : "flex-row"}`}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={msg.sender_avatar} />
                          <AvatarFallback>{msg.sender_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div
                          className={`rounded-xl px-3 py-2 max-w-[80%] ${
                            isMe
                              ? "bg-cyan-500 text-black font-medium"
                              : "bg-muted border border-border/60 text-foreground"
                          }`}
                        >
                          <p className="text-[10px] font-bold opacity-75">{msg.sender_name}</p>
                          <p className="text-xs">{msg.text}</p>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSendChatMessage} className="flex gap-2 pt-2 border-t border-border/60 mt-2">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Discuss post..."
                className="rounded-xl border-border bg-muted/40 text-xs h-8"
              />
              <Button type="submit" size="icon" className="rounded-xl h-8 w-8 bg-cyan-500 text-black hover:bg-cyan-400">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {/* Version History Sidebar Drawer */}
      <CoLoopVersionHistory
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        versions={versions}
        currentDraft={{
          title: postTitle,
          content: postContent,
          hashtags,
          mediaUrl,
          mediaType,
          coAuthors,
        }}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreVersion={handleRestoreVersion}
      />

      {/* Invite Collaborator Dialog */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-md border-cyan-500/40 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <UserPlus className="h-5 w-5" /> Invite Collaborator to Co-Loop
            </DialogTitle>
            <DialogDescription className="text-xs">
              Generate a shareable live session link or search a creator to send an invitation via DM and Notification. (Invitations require acceptance before co-author credit is added).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Shareable Link Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Shareable Session Link
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/co-loop/studio?session=${sessionId}` : ""}
                  className="rounded-xl border-cyan-500/30 bg-muted/50 text-xs font-mono"
                />
                <Button
                  onClick={handleCopyInviteLink}
                  className="rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-bold shrink-0 text-xs gap-1"
                >
                  {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {linkCopied ? "Copied!" : "Copy Link"}
                </Button>
              </div>
            </div>

            {/* Direct DM Search */}
            <div className="space-y-1.5 relative">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Invite via DM & Notification
              </label>
              <Input
                value={invitedUserInput}
                onChange={(e) => setInvitedUserInput(e.target.value)}
                onFocus={() => invitedUserInput.trim() && setShowSuggestions(true)}
                placeholder="Search @username..."
                className="rounded-xl border-border bg-muted/40 text-xs"
              />

              {showSuggestions && userSuggestions.length > 0 && (
                <div className="rounded-xl border border-cyan-500/30 bg-card p-2 space-y-1 shadow-xl max-h-48 overflow-y-auto">
                  {userSuggestions.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-2 hover:bg-cyan-500/10 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={u.avatar_url} />
                          <AvatarFallback>{u.username?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-bold">{u.display_name || u.username}</p>
                          <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={sendingInvite}
                        onClick={() => handleSendInviteToUser(u)}
                        className="rounded-lg bg-cyan-500 text-black font-bold text-[11px] h-7"
                      >
                        {sendingInvite ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send Invite"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Gift Dialog */}
      <Dialog open={giftModalOpen} onOpenChange={setGiftModalOpen}>
        <DialogContent className="sm:max-w-md border-amber-500/40 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Coins className="h-5 w-5" /> Co-Loop Split Gift 🎁
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gift Loop Coins to this Co-Loop! Coins will be split equally among all ({coAuthors.length + 1}) active co-authors on this session.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              {[100, 500, 1000, 5000].map((amount) => {
                const perAuthor = Math.floor(amount / (coAuthors.length + 1))
                return (
                  <Button
                    key={amount}
                    disabled={isSendingGift}
                    onClick={() => handleSendSplitGift(amount)}
                    className="flex flex-col items-center justify-center h-20 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-card to-amber-900/20 hover:border-amber-400 text-amber-300 font-bold"
                  >
                    <span className="text-lg font-extrabold flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-400" /> {amount} Coins
                    </span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      ({perAuthor} coins each)
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

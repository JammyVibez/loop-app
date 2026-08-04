"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@supabase/supabase-js"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
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
  Loader2,
  Radio,
  History,
  UserPlus,
  Copy,
  Check,
  Crown,
  Coins,
  X,
  Flame,
  Zap,
  Rocket,
  ShieldCheck,
  ExternalLink,
  Layers,
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

const AVATAR_COLORS = ["#22d3ee", "#a855f7", "#34d399", "#f43f5e", "#fbbf24"]

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

  // Side Chat Thread Drawer State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // Ceremonial Publish State
  const [publishCeremonyOpen, setPublishCeremonyOpen] = useState(false)
  const [publishedLoopData, setPublishedLoopData] = useState<any>(null)

  // Version History & Modals State
  const [versions, setVersions] = useState<CoLoopVersion[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [isSendingGift, setIsSendingGift] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)

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
            title: "Creator Entered Room! 🌟",
            description: `${newPresences[0].display_name} joined the live studio table.`,
          })
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: any) => {
        if (leftPresences?.[0]?.display_name) {
          toast({
            title: "Creator Left Room",
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
        if (payload.coAuthors !== undefined) {
          setCoAuthors((prev) => {
            const map = new Map<string, Collaborator>()
            prev.forEach((c) => map.set(c.id, c))
            payload.coAuthors.forEach((c: Collaborator) => map.set(c.id, c))
            return Array.from(map.values())
          })
        }
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
        if (!isChatOpen) {
          setUnreadChatCount((prev) => prev + 1)
        }
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
  }, [user, sessionId, isChatOpen])

  // Handle accepting invitation when arriving via invite link
  useEffect(() => {
    if (!user || searchParams.get("invited") !== "true") return

    const acceptInvitation = async () => {
      try {
        await fetch("/api/co-loop/invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ sessionId, status: "accepted" }),
        })

        const joiningUser: Collaborator = {
          id: user.id,
          username: user.username || "creator",
          display_name: user.display_name || user.username || "Co-Author",
          avatar_url: user.avatar_url,
          role: "Co-Author",
        }

        setCoAuthors((prev) => {
          if (prev.some((c) => c.id === joiningUser.id)) return prev
          return [...prev, joiningUser]
        })

        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "co-author-accepted",
            payload: { user: joiningUser },
          })
        }

        toast({
          title: "Invitation Accepted! 🎉",
          description: "You have joined this Co-Loop session as an official co-author.",
        })
      } catch (err) {
        console.error("Failed accepting co-loop invite:", err)
      }
    }

    acceptInvitation()
  }, [user, sessionId, searchParams, getAuthHeader, toast])

  // Scroll chat to bottom
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages, isChatOpen])

  // Clear unread count when chat drawer opens
  useEffect(() => {
    if (isChatOpen) {
      setUnreadChatCount(0)
    }
  }, [isChatOpen])

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

  // Copy shareable session link
  const handleCopyInviteLink = () => {
    const inviterNameParam = user?.username ? `?invitedBy=${encodeURIComponent(user.username)}` : ""
    const url = `${window.location.origin}/co-loop/join/${sessionId}${inviterNameParam}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    toast({
      title: "Session Invite Link Copied! 🔗",
      description: "Asymmetric invite link copied to clipboard. Anyone clicking will see your invite & landing screen!",
    })
    setTimeout(() => setLinkCopied(false), 3000)
  }

  // Send Direct Invite to User
  const handleSendInviteToUser = async (targetUser: any) => {
    setSendingInvite(true)
    try {
      const res = await fetch("/api/co-loop/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          session_id: sessionId,
          session_title: postTitle || "New Collaborative Loop",
          invitee_id: targetUser.id,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send invitation")

      toast({
        title: "Invitation Sent! 🚀",
        description: `Direct invite sent to @${targetUser.username} via DM & Notification.`,
      })

      setInvitedUserInput("")
      setShowSuggestions(false)
      setInviteModalOpen(false)
    } catch (err: any) {
      toast({
        title: "Invite Failed",
        description: err.message || "Could not send invite",
        variant: "destructive",
      })
    } finally {
      setSendingInvite(false)
    }
  }

  // Send In-Studio Chat Message
  const handleSendChatMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !user) return

    const msg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender_id: user.id,
      sender_name: user.display_name || user.username || "Creator",
      sender_avatar: user.avatar_url,
      text: chatInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setChatMessages((prev) => [...prev, msg])
    setChatInput("")

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "chat-msg",
        payload: msg,
      })
    }
  }

  // Send Split Gift to Co-Authors
  const handleSendSplitGift = async (amount: number) => {
    if (!user) return
    setIsSendingGift(true)
    try {
      const res = await fetch("/api/co-loop/gift", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          session_id: sessionId,
          amount,
          co_author_ids: coAuthors.map((c) => c.id),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send split gift")

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "co-loop-gift",
          payload: {
            senderName: user.display_name || user.username,
            amount,
            splitAmount: data.split_amount || Math.floor(amount / (coAuthors.length + 1)),
          },
        })
      }

      toast({
        title: "Split Gift Sent! 🎁",
        description: `Successfully distributed ${amount} Loop Coins equally across active co-authors!`,
      })
      setGiftModalOpen(false)
    } catch (err: any) {
      toast({
        title: "Gift Failed",
        description: err.message || "Could not send gift",
        variant: "destructive",
      })
    } finally {
      setIsSendingGift(false)
    }
  }

  // Handle Ceremonial Publish
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

      // Trigger ceremonial publish modal celebration
      setPublishedLoopData({
        ...data,
        title: postTitle || "Co-Loop Collaboration",
        coAuthorsCount: coAuthors.length + 1,
      })
      setPublishCeremonyOpen(true)
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
        <Card className="max-w-md p-6 border-cyan-500/30 bg-[#090d1a] text-slate-100 shadow-2xl">
          <Lock className="mx-auto h-12 w-12 text-cyan-400 mb-3 animate-pulse" />
          <h2 className="text-xl font-bold">Studio Authentication Required</h2>
          <p className="text-sm text-slate-400 mt-2">Log in to collaborate live in the Co-Loop Studio.</p>
        </Card>
      </div>
    )
  }

  // Combine creator and connected collaborators for the Studio Presence Ring
  const activeParticipants = [
    {
      id: user.id,
      username: user.username || "creator",
      display_name: user.display_name || user.username || "Primary Creator",
      avatar_url: user.avatar_url,
      role: "Primary Creator",
      isCreator: true,
    },
    ...coAuthors.map((ca) => ({
      ...ca,
      role: ca.role || "Co-Author",
      isCreator: false,
    })),
  ]

  const wordCount = postContent.trim() ? postContent.trim().split(/\s+/).length : 0
  const charCount = postContent.length

  return (
    <div className="relative min-h-[92vh] overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#030712] text-slate-100 p-3 sm:p-6 shadow-2xl">
      {/* Dark Ambient Studio Background Lights & Grid */}
      <div className="landing-grid-bg pointer-events-none absolute inset-0 opacity-20" />
      <div className="landing-aurora-blob pointer-events-none absolute left-1/2 top-[-10%] h-[75vmin] w-[75vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.25),transparent_65%)] blur-3xl" />
      <div className="landing-aurora-blob pointer-events-none absolute -right-1/4 top-[40%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2),transparent_65%)] blur-3xl [animation-delay:-4s]" />
      <div className="landing-aurora-blob pointer-events-none absolute -left-1/4 bottom-[10%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_65%)] blur-3xl [animation-delay:-8s]" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        {/* Studio Control Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-[#080d1e]/80 p-4 sm:p-5 backdrop-blur-xl shadow-lg shadow-cyan-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 text-white font-bold shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-400 via-teal-300 to-indigo-300 bg-clip-text text-transparent">
                  Co-Loop Studio Room
                </h1>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-bold px-2 py-0.5">
                  <Radio className="h-3 w-3 mr-1 text-cyan-400 animate-pulse" />
                  LIVE STAGE
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time collaborative room • Session #{sessionId}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
            <Button
              variant="outline"
              onClick={() => setGiftModalOpen(true)}
              className="rounded-xl border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-500/20 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Coins className="h-4 w-4 text-amber-400" />
              Split Gift
            </Button>

            <Button
              variant="outline"
              onClick={() => setHistoryOpen(true)}
              className="rounded-xl border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold gap-1.5 shadow-sm"
            >
              <History className="h-4 w-4 text-cyan-400" />
              History
              {versions.length > 0 && (
                <Badge className="bg-cyan-500 text-black text-[10px] px-1.5 py-0 rounded-full font-extrabold ml-1">
                  {versions.length}
                </Badge>
              )}
            </Button>

            {/* Slide-In Chat Toggle Button */}
            <Button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`rounded-xl text-xs font-bold gap-1.5 transition-all shadow-md ${
                isChatOpen
                  ? "bg-cyan-500 text-black hover:bg-cyan-400"
                  : "border border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-500/20"
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              In-Studio Chat
              {unreadChatCount > 0 && !isChatOpen && (
                <Badge className="bg-rose-500 text-white text-[10px] px-1.5 py-0 rounded-full font-black animate-bounce">
                  {unreadChatCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>

        {/* PRESENCE STAGE ORBS ("Sitting Around the Table") */}
        <div className="relative rounded-3xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1128]/90 via-[#060b18]/80 to-[#080e22]/90 p-4 sm:p-6 backdrop-blur-xl shadow-inner">
          <div className="flex items-center justify-between mb-4 border-b border-cyan-500/20 pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" />
              <span className="text-xs font-extrabold tracking-wider uppercase text-cyan-300">
                Collaborators Around the Room ({activeParticipants.length})
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block italic">
              Avatars pulse live as creators co-write together
            </p>
          </div>

          {/* Glowing Orbs Grid/Arc */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-2">
            {activeParticipants.map((participant, idx) => {
              const isMe = participant.id === user.id
              const orbColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]

              return (
                <div
                  key={participant.id}
                  className="group relative flex flex-col items-center transition-all duration-300 hover:scale-105"
                >
                  {/* Glowing Aura Orb Ring */}
                  <div className="relative">
                    <div
                      className="absolute -inset-1.5 rounded-full blur-md opacity-75 group-hover:opacity-100 transition-opacity animate-pulse"
                      style={{ backgroundColor: orbColor }}
                    />
                    <Avatar className="relative h-14 w-14 sm:h-16 sm:w-16 border-2 border-white/20 ring-4 ring-cyan-500/50 shadow-2xl">
                      <AvatarImage src={participant.avatar_url || undefined} />
                      <AvatarFallback className="bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white font-black text-lg">
                        {participant.display_name?.charAt(0) || "C"}
                      </AvatarFallback>
                    </Avatar>

                    {/* Role / Crown Badge */}
                    {participant.isCreator ? (
                      <div className="absolute -top-1 -right-1 bg-amber-500 text-black p-1 rounded-full shadow-lg border border-amber-300">
                        <Crown className="h-3 w-3" />
                      </div>
                    ) : (
                      <div className="absolute -bottom-1 -right-1 bg-cyan-500 text-black px-1.5 py-0.5 rounded-full text-[9px] font-black border border-cyan-200">
                        Co
                      </div>
                    )}
                  </div>

                  {/* Name Tag */}
                  <div className="mt-2 text-center max-w-[100px]">
                    <p className="text-xs font-extrabold text-white truncate">
                      {participant.display_name} {isMe && "(You)"}
                    </p>
                    <p className="text-[10px] text-cyan-300/80 truncate">@{participant.username}</p>
                  </div>
                </div>
              )
            })}

            {/* Quick Invite Orb Button */}
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="group flex flex-col items-center justify-center transition-all hover:scale-105"
            >
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-dashed border-cyan-400/60 bg-cyan-950/30 text-cyan-300 hover:border-cyan-300 hover:bg-cyan-500/20 shadow-lg">
                <Plus className="h-6 w-6 group-hover:scale-110 transition-transform" />
              </div>
              <span className="mt-2 text-xs font-bold text-cyan-300">Add Co-Author</span>
            </button>

            {/* Quick Link Orb Button */}
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="group flex flex-col items-center justify-center transition-all hover:scale-105"
            >
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-400 hover:text-cyan-300 shadow-lg">
                {linkCopied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
              </div>
              <span className="mt-2 text-xs font-bold text-slate-300">{linkCopied ? "Copied Link!" : "Copy Invite"}</span>
            </button>
          </div>
        </div>

        {/* FLOATING GLASS PANEL EDITOR (CENTERED CANVAS) */}
        <div className="relative mx-auto max-w-4xl">
          <Card className="border-cyan-500/30 bg-[#080d1e]/85 p-5 sm:p-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(6,182,212,0.12)] rounded-3xl space-y-6 text-slate-100">
            {/* Live Synchronized Notice */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  Interactive Collaborative Canvas
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} characters</span>
              </div>
            </div>

            {/* Post Title Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Co-Loop Title (Optional)
              </label>
              <Input
                value={postTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Next-Gen Collaborative Social OS..."
                className="rounded-2xl border-white/10 bg-slate-950/60 text-base font-bold text-white placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 h-12"
              />
            </div>

            {/* Main Content Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Story / Post Content
              </label>
              <Textarea
                value={postContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Co-author your story, announcement, or code snippet live in real-time..."
                className="min-h-[220px] rounded-2xl border-white/10 bg-slate-950/60 text-sm sm:text-base leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 p-4"
              />
            </div>

            {/* Hashtags & Media Rows */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Hashtags */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Hashtags
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHashtag())}
                    placeholder="e.g. #CoLoop #Innovation"
                    className="rounded-xl border-white/10 bg-slate-950/60 text-xs h-9"
                  />
                  <Button type="button" onClick={handleAddHashtag} size="sm" className="rounded-xl bg-cyan-600 text-white font-bold h-9">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {hashtags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1"
                    >
                      #{tag}
                      <button type="button" onClick={() => handleRemoveHashtag(tag)} className="hover:text-rose-400 ml-1">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Media URL */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Media Attachment URL
                </label>
                <Input
                  value={mediaUrl}
                  onChange={(e) => {
                    setMediaUrl(e.target.value)
                    broadcastDocUpdate({ mediaUrl: e.target.value })
                  }}
                  placeholder="https://images.unsplash.com/..."
                  className="rounded-xl border-white/10 bg-slate-950/60 text-xs h-9"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={mediaType === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setMediaType("image")
                      broadcastDocUpdate({ mediaType: "image" })
                    }}
                    className={`rounded-xl text-xs h-7 ${mediaType === "image" ? "bg-cyan-500 text-black font-bold" : "border-white/10 text-slate-300"}`}
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
                    className={`rounded-xl text-xs h-7 ${mediaType === "video" ? "bg-cyan-500 text-black font-bold" : "border-white/10 text-slate-300"}`}
                  >
                    Video
                  </Button>
                </div>
              </div>
            </div>

            {/* CEREMONIAL PUBLISH BAR */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Stacked co-author credits will display on feed with +50 activation bonus</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  onClick={() => handleSaveSnapshot()}
                  variant="outline"
                  className="rounded-xl border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10 text-xs font-bold h-11"
                >
                  Save Snapshot
                </Button>

                <Button
                  onClick={handlePublishCoLoop}
                  disabled={publishing}
                  className="flex-1 sm:flex-initial rounded-xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-purple-600 text-white font-extrabold shadow-xl shadow-cyan-500/25 px-8 h-11 hover:scale-105 transition-all"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" /> Publish Co-Loop
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* SLIDE-IN SIDE CHAT THREAD DRAWER */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-80 sm:w-96 border-l border-cyan-500/30 bg-[#080d1e]/95 backdrop-blur-2xl shadow-2xl p-4 flex flex-col transition-transform duration-300 ease-in-out ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-extrabold text-white">In-Studio Thread</h3>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsChatOpen(false)}
            className="h-8 w-8 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 py-4 pr-2">
          <div className="space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12 px-4 text-slate-400 space-y-2">
                <Sparkles className="h-8 w-8 text-cyan-400 mx-auto animate-pulse" />
                <p className="text-xs font-semibold">No thread messages yet.</p>
                <p className="text-[11px] text-slate-500">
                  Discuss ideas live with your co-authors sitting in the room!
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender_id === user.id
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 text-xs ${isMe ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <Avatar className="h-7 w-7 border border-cyan-500/30">
                      <AvatarImage src={msg.sender_avatar} />
                      <AvatarFallback className="bg-cyan-600 text-white font-bold text-xs">
                        {msg.sender_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 max-w-[82%] shadow-md ${
                        isMe
                          ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium"
                          : "bg-slate-900 border border-white/10 text-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[10px] font-bold opacity-80">{msg.sender_name}</span>
                        <span className="text-[9px] opacity-60">{msg.timestamp}</span>
                      </div>
                      <p className="text-xs leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>
        </ScrollArea>

        {/* Chat Input Form */}
        <form onSubmit={handleSendChatMessage} className="pt-2 border-t border-white/10 flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type message to room..."
            className="rounded-xl border-white/10 bg-slate-900 text-white text-xs h-10"
          />
          <Button type="submit" className="rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-bold h-10 px-4">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* CEREMONIAL PUBLISH CELEBRATION MODAL */}
      <Dialog open={publishCeremonyOpen} onOpenChange={setPublishCeremonyOpen}>
        <DialogContent className="sm:max-w-lg border-cyan-500/40 bg-[#080d1e] text-slate-100 p-6 overflow-hidden">
          {/* Background Ring Effects */}
          <div className="pointer-events-none absolute -inset-10 rounded-full border border-cyan-500/30 animate-ping opacity-20" />
          <div className="pointer-events-none absolute -inset-20 rounded-full border border-purple-500/20 animate-pulse opacity-20" />

          <DialogHeader className="text-center space-y-3 relative z-10">
            <div className="flex justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-600 to-purple-600 shadow-2xl shadow-cyan-500/50">
                <Rocket className="h-10 w-10 text-white animate-bounce" />
              </div>
            </div>

            <DialogTitle className="text-2xl font-black text-white tracking-tight">
              Co-Loop Broadcasted Live! 🚀
            </DialogTitle>
            <DialogDescription className="text-slate-300 text-xs sm:text-sm">
              Your collaborative creation is officially published to the community feed with stacked co-author credit!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 relative z-10">
            {/* Reward Highlight */}
            <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/60 via-amber-900/30 to-amber-950/60 p-3.5 text-center shadow-lg">
              <p className="text-xs font-bold text-amber-300 flex items-center justify-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-400" />
                Collaboration Bonus Unlocked!
              </p>
              <p className="text-xs text-amber-200/90 mt-1">
                +50 Loop Coins awarded to all {publishedLoopData?.coAuthorsCount || coAuthors.length + 1} active co-authors!
              </p>
            </div>

            {/* Stacked Co-Authors Credit */}
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-3.5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Official Co-Authors</p>
              <div className="flex items-center -space-x-3 overflow-hidden py-1">
                <Avatar className="h-9 w-9 ring-2 ring-cyan-400">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-cyan-600 font-bold">{user.username?.charAt(0)}</AvatarFallback>
                </Avatar>
                {coAuthors.map((ca) => (
                  <Avatar key={ca.id} className="h-9 w-9 ring-2 ring-purple-500">
                    <AvatarImage src={ca.avatar_url} />
                    <AvatarFallback className="bg-purple-600 font-bold">{ca.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => {
                  setPublishCeremonyOpen(false)
                  router.push("/")
                }}
                className="w-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white font-bold h-11 rounded-xl shadow-lg shadow-cyan-500/25"
              >
                View in Community Feed <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setPublishCeremonyOpen(false)
                  setPostTitle("")
                  setPostContent("")
                }}
                className="w-full border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl h-10 text-xs"
              >
                Start Another Co-Loop Session
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
        <DialogContent className="sm:max-w-md border-cyan-500/40 bg-[#080d1e] text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <UserPlus className="h-5 w-5" /> Invite Collaborator to Co-Loop
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Generate a shareable live session link or search a creator to send an invitation via DM and Notification.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Shareable Link Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Shareable Asymmetric Session Link
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={
                    typeof window !== "undefined"
                      ? `${window.location.origin}/co-loop/join/${sessionId}${user?.username ? `?invitedBy=${encodeURIComponent(user.username)}` : ""}`
                      : ""
                  }
                  className="rounded-xl border-cyan-500/30 bg-slate-900 text-xs font-mono text-cyan-200"
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
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Invite via DM & Notification
              </label>
              <Input
                value={invitedUserInput}
                onChange={(e) => setInvitedUserInput(e.target.value)}
                onFocus={() => invitedUserInput.trim() && setShowSuggestions(true)}
                placeholder="Search @username..."
                className="rounded-xl border-white/10 bg-slate-900 text-xs"
              />

              {showSuggestions && userSuggestions.length > 0 && (
                <div className="rounded-xl border border-cyan-500/30 bg-slate-900 p-2 space-y-1 shadow-xl max-h-48 overflow-y-auto">
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
                          <p className="text-[10px] text-slate-400">@{u.username}</p>
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
        <DialogContent className="sm:max-w-md border-amber-500/40 bg-[#080d1e] text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Coins className="h-5 w-5" /> Co-Loop Split Gift 🎁
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Gift Loop Coins to this Co-Loop! Coins will be split equally among all ({coAuthors.length + 1}) active co-authors sitting in the room.
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
                    className="flex flex-col items-center justify-center h-20 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-amber-900/20 hover:border-amber-400 text-amber-300 font-bold"
                  >
                    <span className="text-lg font-extrabold flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-400" /> {amount} Coins
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
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

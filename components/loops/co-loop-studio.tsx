"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { absoluteAppUrl, shareContent } from "@/lib/share"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import {
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
  Upload,
  Paperclip,
  Power,
  Globe,
  List,
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
const MAX_CO_AUTHORS = 4 // 1 primary creator + up to 4 invited co-authors

export function CoLoopStudio() {
  const { user, getAuthHeader } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  // Ensure every session has a unique session ID
  const paramSession = searchParams.get("session")
  const [sessionId, setSessionId] = useState<string>(() => {
    return paramSession || `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
  })

  // Keep URL searchParam in sync with active sessionId
  useEffect(() => {
    const currentParam = searchParams.get("session")
    if (!currentParam && sessionId) {
      router.replace(`/co-loop/studio?session=${encodeURIComponent(sessionId)}`)
    } else if (currentParam && currentParam !== sessionId) {
      setSessionId(currentParam)
    }
  }, [searchParams, sessionId, router])

  // Live Post State
  const [postTitle, setPostTitle] = useState("")
  const [postContent, setPostContent] = useState("")
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState("")
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaUrls, setMediaUrls] = useState<string[]>([])
  const [mediaType, setMediaType] = useState<"text" | "image" | "video">("text")
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const dragDepthRef = useRef(0)

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
  // Mirrors isChatOpen for use inside the realtime channel's broadcast
  // handlers without making the channel-setup effect depend on it (see
  // isChatOpenRef usage below for why).
  const isChatOpenRef = useRef(false)
  useEffect(() => {
    isChatOpenRef.current = isChatOpen
  }, [isChatOpen])

  // Real-time Typing Status State
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; display_name: string; field: "title" | "content" }>>({})
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
  const [openInviteModal, setOpenInviteModal] = useState(false)
  const [openInviteTopic, setOpenInviteTopic] = useState("")
  const [openInviteMax, setOpenInviteMax] = useState(4)
  const [publishingOpenInvite, setPublishingOpenInvite] = useState(false)

  const supabaseRef = useRef<any>(null)
  const channelRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Session Owner & Ownership State
  const [sessionOwner, setSessionOwner] = useState<{ id?: string; username?: string; display_name?: string; avatar_url?: string } | null>(null)
  const [isOwner, setIsOwner] = useState<boolean>(false)
  const [isSessionOwnerLoading, setIsSessionOwnerLoading] = useState<boolean>(true)

  // Ref to hold latest doc state for doc-sync broadcasts without re-subscribing channel
  const docStateRef = useRef({
    title: "",
    content: "",
    hashtags: [] as string[],
    mediaUrl: "",
    mediaUrls: [] as string[],
    mediaType: "text" as "text" | "image" | "video",
    coAuthors: [] as Collaborator[],
    chatMessages: [] as ChatMessage[],
  })

  useEffect(() => {
    docStateRef.current = {
      title: postTitle,
      content: postContent,
      hashtags,
      mediaUrl,
      mediaUrls,
      mediaType,
      coAuthors,
      chatMessages,
    }
  }, [postTitle, postContent, hashtags, mediaUrl, mediaUrls, mediaType, coAuthors, chatMessages])

  // Fetch Session Info to resolve Primary Creator vs Co-Author
  useEffect(() => {
    if (!user || !sessionId) return

    const resolveSessionInfo = async () => {
      try {
        setIsSessionOwnerLoading(true)
        const authHeaders = getAuthHeader()

        // POST is used for both the owner (creates the session record) and
        // any invited co-author (durably joins the session's co_authors
        // roster). This is the single source of truth both the Primary
        // Creator's and every Co-Author's studio view read from — it used to
        // be presence-only, which meant the Primary Creator could miss a
        // co-author whose "join" broadcast arrived before their own
        // subscription settled, or after a reconnect.
        const res = await fetch("/api/co-loop/session-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const data = await res.json()

        if (data.owner_id || data.inviter) {
          const ownerObj = data.inviter || { id: data.owner_id, username: data.owner_username }
          setSessionOwner(ownerObj)
          const isCallerOwner = Boolean(
            (data.owner_id && data.owner_id === user.id) ||
            (ownerObj.id && ownerObj.id === user.id) ||
            (ownerObj.username && user.username && ownerObj.username.toLowerCase() === user.username.toLowerCase())
          )
          setIsOwner(isCallerOwner)
        } else {
          setSessionOwner({
            id: user.id,
            username: user.username,
            display_name: user.display_name || user.username,
          })
          setIsOwner(true)
        }

        if (Array.isArray(data.co_authors) && data.co_authors.length > 0) {
          setCoAuthors((prev) => {
            const map = new Map<string, Collaborator>()
            prev.forEach((c) => map.set(c.id, c))
            data.co_authors.forEach((c: Collaborator) => map.set(c.id, { ...c, role: "Co-Author" }))
            return Array.from(map.values())
          })
        }
      } catch (err) {
        console.error("Session info fetch error:", err)
      } finally {
        setIsSessionOwnerLoading(false)
      }
    }

    resolveSessionInfo()
  }, [sessionId, searchParams, user, getAuthHeader])

  const currentUserRole = isOwner ? "Primary Creator" : "Co-Author"

  // Pull the durable co-author roster from the server. Called on mount (via
  // resolveSessionInfo) and again whenever a realtime "join" fires, so the
  // Primary Creator's view self-heals even if a presence event was missed.
  const refetchCoAuthors = async () => {
    if (!user || !sessionId) return
    try {
      const res = await fetch("/api/co-loop/session-info", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      if (Array.isArray(data.co_authors) && data.co_authors.length > 0) {
        setCoAuthors((prev) => {
          const map = new Map<string, Collaborator>()
          prev.forEach((c) => map.set(c.id, c))
          data.co_authors.forEach((c: Collaborator) => map.set(c.id, { ...c, role: "Co-Author" }))
          return Array.from(map.values())
        })
      }
    } catch {
      /* best-effort — presence sync remains the primary live path */
    }
  }

  // Initialize Supabase Client
  useEffect(() => {
    supabaseRef.current = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
  }, [])

  // Join Realtime Channel for Studio Presence & Broadcast
  useEffect(() => {
    if (!user || !supabaseRef.current || isSessionOwnerLoading) return

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

        // Automatically list active non-owner participants as co-authors
        const coAuthList = activeUsers.filter(
          (u) => u.role === "Co-Author" || (sessionOwner?.id && u.id !== sessionOwner.id)
        )
        if (coAuthList.length > 0) {
          setCoAuthors((prev) => {
            const map = new Map<string, Collaborator>()
            prev.forEach((c) => map.set(c.id, c))
            coAuthList.forEach((c) => map.set(c.id, { ...c, role: "Co-Author" }))
            return Array.from(map.values())
          })
        }
      })
      .on("presence", { event: "join" }, ({ newPresences }: any) => {
        if (newPresences?.[0]?.display_name) {
          const joinedUser = newPresences[0]
          toast({
            title: `${joinedUser.role === "Primary Creator" ? "Primary Creator" : "Co-Author"} Entered Room! 🚀`,
            description: `${joinedUser.display_name} joined the live studio table.`,
          })
        }
        // Belt-and-suspenders: re-pull the durable co-author roster from the
        // server whenever anyone joins, instead of relying solely on
        // presence state (which is what caused the Primary Creator's view to
        // sometimes miss a co-author the co-author's own view already showed).
        void refetchCoAuthors()
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: any) => {
        if (leftPresences?.[0]?.display_name) {
          toast({
            title: "Collaborator Left Room",
            description: `${leftPresences[0].display_name} disconnected from studio.`,
          })
        }
      })
      // Request doc sync when a co-author enters
      .on("broadcast", { event: "request-doc-sync" }, () => {
        if (isOwner && channelRef.current) {
          const st = docStateRef.current
          channelRef.current.send({
            type: "broadcast",
            event: "doc-update",
            payload: {
              title: st.title,
              content: st.content,
              hashtags: st.hashtags,
              mediaUrl: st.mediaUrl,
              mediaUrls: st.mediaUrls,
              mediaType: st.mediaType,
              coAuthors: st.coAuthors,
              chatMessages: st.chatMessages,
            },
          })
        }
      })
      // Handle Studio Broadcast Edits
      .on("broadcast", { event: "doc-update" }, ({ payload }: any) => {
        if (payload.title !== undefined) setPostTitle(payload.title)
        if (payload.content !== undefined) setPostContent(payload.content)
        if (payload.hashtags !== undefined) setHashtags(payload.hashtags)
        if (payload.mediaUrl !== undefined) setMediaUrl(payload.mediaUrl)
        if (payload.mediaUrls !== undefined) setMediaUrls(payload.mediaUrls)
        if (payload.mediaType !== undefined) setMediaType(payload.mediaType)
        if (payload.chatMessages !== undefined && Array.isArray(payload.chatMessages)) {
          setChatMessages(payload.chatMessages)
        }
        if (payload.coAuthors !== undefined) {
          setCoAuthors((prev) => {
            const map = new Map<string, Collaborator>()
            prev.forEach((c) => map.set(c.id, c))
            payload.coAuthors.forEach((c: Collaborator) => map.set(c.id, { ...c, role: "Co-Author" }))
            return Array.from(map.values())
          })
        }
      })
      // Handle Typing Status Broadcast
      .on("broadcast", { event: "typing-status" }, ({ payload }: any) => {
        if (!payload?.userId || payload.userId === user?.id) return
        setTypingUsers((prev) => {
          const next = { ...prev }
          if (payload.field) {
            next[payload.userId] = {
              username: payload.username || "collaborator",
              display_name: payload.display_name || payload.username || "Collaborator",
              field: payload.field,
            }
          } else {
            delete next[payload.userId]
          }
          return next
        })
      })
      .on("broadcast", { event: "co-author-accepted" }, ({ payload }: any) => {
        if (payload?.user) {
          const acceptedUser = payload.user
          setCoAuthors((prev) => {
            if (prev.some((c) => c.id === acceptedUser.id)) return prev
            if (prev.length >= MAX_CO_AUTHORS) return prev
            const updated = [...prev, { ...acceptedUser, role: "Co-Author" }]
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
        if (!isChatOpenRef.current) {
          setUnreadChatCount((prev) => prev + 1)
        }
      })
      // Handle Session Ended Broadcast
      .on("broadcast", { event: "session_ended" }, ({ payload }: any) => {
        toast({
          title: "Co-Loop Session Ended 🛑",
          description: `${payload?.endedBy || "The Primary Creator"} has closed this Co-Loop session.`,
        })
        setTimeout(() => {
          router.push("/")
        }, 1500)
      })
      // Publishing closes the session for everyone still in the room — only
      // the publisher sees the ceremony modal (set locally in
      // handlePublishCoLoop); every other participant gets redirected home
      // automatically since there's nothing left to collaborate on.
      .on("broadcast", { event: "coloop_published" }, ({ payload }: any) => {
        toast({
          title: "Co-Loop Published! 🚀",
          description: `${payload?.publishedBy || "A collaborator"} published this Co-Loop. This session has ended — taking you to the community feed…`,
        })
        setTimeout(() => {
          router.push("/")
        }, 1500)
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
          setMediaUrls(v.mediaUrls || (v.mediaUrl ? [v.mediaUrl] : []))
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
            role: currentUserRole,
            color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          }
          await channel.track(myProfile)

          // If joining as Co-Author, request current document state from Primary Creator
          if (!isOwner) {
            channel.send({
              type: "broadcast",
              event: "request-doc-sync",
              payload: { requesterId: user.id },
            })
          }
        }
      })

    return () => {
      channel.unsubscribe()
    }
    // isChatOpen is intentionally excluded — it's read via isChatOpenRef inside
    // the chat-msg handler so toggling the chat drawer never tears down and
    // recreates this presence channel (that used to fire spurious "left the
    // room" / "entered the room" toasts for every other collaborator on every
    // open/close).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionId, isSessionOwnerLoading, isOwner, currentUserRole, sessionOwner, router, toast])

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
          username: user.username || "coauthor",
          display_name: user.display_name || user.username || "Co-Author",
          avatar_url: user.avatar_url,
          role: "Co-Author",
        }

        setCoAuthors((prev) => {
          if (prev.some((c) => c.id === joiningUser.id)) return prev
          if (prev.length >= MAX_CO_AUTHORS) return prev
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
      mediaUrls,
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
    setMediaUrls(version.mediaUrls || (version.mediaUrl ? [version.mediaUrl] : []))
    setMediaType(version.mediaType || "text")
    if (version.coAuthors) {
      setCoAuthors(version.coAuthors.map((ca: any) => ({ ...ca, role: ca.role || "Co-Author" })))
    }

    const docUpdatePayload = {
      title: version.title || "",
      content: version.content || "",
      hashtags: version.hashtags || [],
      mediaUrl: version.mediaUrl || "",
      mediaUrls: version.mediaUrls || (version.mediaUrl ? [version.mediaUrl] : []),
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

  // Broadcast Live Typing Signal
  const sendTypingSignal = (field: "title" | "content") => {
    if (!channelRef.current || !user) return
    channelRef.current.send({
      type: "broadcast",
      event: "typing-status",
      payload: {
        userId: user.id,
        username: user.username || "creator",
        display_name: user.display_name || user.username || "Collaborator",
        field,
      },
    })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      if (channelRef.current && user) {
        channelRef.current.send({
          type: "broadcast",
          event: "typing-status",
          payload: {
            userId: user.id,
            username: user.username || "creator",
            display_name: user.display_name || user.username || "Collaborator",
            field: null,
          },
        })
      }
    }, 2500)
  }

  const handleTitleChange = (val: string) => {
    setPostTitle(val)
    broadcastDocUpdate({ title: val })
    sendTypingSignal("title")
  }

  const handleContentChange = (val: string) => {
    setPostContent(val)
    broadcastDocUpdate({ content: val })
    sendTypingSignal("content")
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

  // Handle Media File Uploads for all co-authors (with Pro multi-file support)
  const handleFileUpload = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return
    const isPro = Boolean(user?.is_premium)
    const fileArray = Array.from(files)

    // Non-Pro users are limited to 1 file upload; Pro users can upload multiple files (max 4)
    if (!isPro && fileArray.length > 1) {
      toast({
        title: "Pro Feature",
        description: "Multiple media uploads are available for Pro members! Single file uploaded.",
      })
    }

    const filesToUpload = isPro ? fileArray.slice(0, 4) : [fileArray[0]]
    setUploadingMedia(true)

    try {
      const uploadedUrls: string[] = []
      let detectedType: "image" | "video" = "image"

      for (const file of filesToUpload) {
        const type = file.type.startsWith("video/") ? "video" : "image"
        if (type === "video") detectedType = "video"

        const res = await uploadMediaFile(file, {
          authHeaders: getAuthHeader(),
          type,
          folder: "co-loops",
        })

        if (res.url) {
          uploadedUrls.push(res.url)
        }
      }

      if (uploadedUrls.length > 0) {
        const newUrls = isPro ? [...mediaUrls, ...uploadedUrls].slice(0, 4) : [uploadedUrls[0]]
        setMediaUrls(newUrls)
        setMediaUrl(newUrls[0] || "")
        setMediaType(detectedType)

        broadcastDocUpdate({
          mediaUrls: newUrls,
          mediaUrl: newUrls[0] || "",
          mediaType: detectedType,
        })

        toast({
          title: "Media Attached! 📸",
          description: `${uploadedUrls.length} file(s) attached by ${user?.display_name || "co-author"}.`,
        })
      }
    } catch (err: any) {
      console.error("Co-loop media upload error:", err)
      toast({
        title: "Upload Failed",
        description: err.message || "Failed to upload media attachment.",
        variant: "destructive",
      })
    } finally {
      setUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleRemoveMedia = (index: number) => {
    const updated = mediaUrls.filter((_, i) => i !== index)
    setMediaUrls(updated)
    setMediaUrl(updated[0] || "")
    if (updated.length === 0) setMediaType("text")

    broadcastDocUpdate({
      mediaUrls: updated,
      mediaUrl: updated[0] || "",
      mediaType: updated.length === 0 ? "text" : mediaType,
    })
  }

  // Share / copy shareable session link
  const handleCopyInviteLink = async () => {
    if (coAuthors.length >= MAX_CO_AUTHORS) {
      toast({
        title: "Collaborator Limit Reached",
        description: `Maximum limit of ${MAX_CO_AUTHORS} invited co-authors per Co-Loop has been reached.`,
        variant: "destructive",
      })
      return
    }

    const inviterNameParam = user?.username ? `?invitedBy=${encodeURIComponent(user.username)}` : ""
    const url = absoluteAppUrl(`/co-loop/join/${sessionId}${inviterNameParam}`)
    const result = await shareContent({
      url,
      title: "Join my Co-Loop session",
      text: `Collaborate with @${user?.username || "me"} on Loop`,
    })
    if (result === "aborted" || result === "failed") {
      if (result === "failed") toast({ title: "Couldn't share", variant: "destructive" })
      return
    }
    setLinkCopied(true)
    toast({
      title: result === "shared" ? "Invite shared" : "Session invite link copied",
      description: "Anyone with the link can join your Co-Loop session.",
    })
    setTimeout(() => setLinkCopied(false), 3000)
  }

  // Send Direct Invite to User
  const handleSendInviteToUser = async (targetUser: any) => {
    if (coAuthors.length >= MAX_CO_AUTHORS) {
      toast({
        title: "Collaborator Limit Reached",
        description: `Maximum limit of ${MAX_CO_AUTHORS} invited co-authors per Co-Loop has been reached.`,
        variant: "destructive",
      })
      return
    }

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
          gift_amount: amount,
          recipients: coAuthors.map((c) => c.id),
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
        media_url: mediaUrls[0] || mediaUrl || null,
        media_urls: mediaUrls,
        media_type: mediaType,
        hashtags,
        is_co_loop: true,
        co_authors: coAuthorsMetadata,
        content_metadata: {
          is_co_loop: true,
          co_authors: coAuthorsMetadata,
          studio_session_id: sessionId,
          media_urls: mediaUrls,
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

      const publishedLoopId = data.loop?.id

      // Tell every other participant still in the room — they don't get a
      // ceremony modal, they just get redirected since the session is over.
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "coloop_published",
          payload: {
            publishedBy: user?.display_name || user?.username || "A collaborator",
            loopId: publishedLoopId,
          },
        })
      }

      // Mark the session closed server-side so it can't be re-joined/reused.
      try {
        await fetch("/api/co-loop/session-info", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ session_id: sessionId, status: "published", published_loop_id: publishedLoopId }),
        })
      } catch {
        /* best-effort */
      }

      // If this was an open invite session, update the feed post status so the card
      // shows "Published" and disables the Join button for everyone else.
      try {
        const sessionInfoRes = await fetch("/api/co-loop/session-info?session_id=" + encodeURIComponent(sessionId), {
          headers: getAuthHeader(),
        })
        const sessionInfo = await sessionInfoRes.json()
        if (sessionInfo?.session?.feed_post_id) {
          const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser")
          const supabaseBrowser = getSupabaseBrowserClient()
          const existingMeta = sessionInfo.session.open_invite_topic ? {
            is_open_coloop_invite: true,
            session_id: sessionId,
            max_collaborators: sessionInfo.session.max_collaborators || 4,
            topic: sessionInfo.session.open_invite_topic || "",
            current_participants: (coAuthors.length + 1),
            status: "published",
          } : undefined
          if (existingMeta) {
            await supabaseBrowser
              .from("loops")
              .update({ content_metadata: existingMeta })
              .eq("id", sessionInfo.session.feed_post_id)
          }
        }
      } catch {
        /* best-effort — open invite status update */
      }

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

  // Combine session owner and collaborators for the Studio Presence Ring.
  // Computed unconditionally (before the `!user` early return below) — this
  // used to be called after that return, which violated React's Rules of
  // Hooks (a hook can never be called conditionally).
  const activeParticipants = useMemo(() => {
    const list: (Collaborator & { isCreator: boolean })[] = []
    const seenIds = new Set<string>()

    // 1. Session Owner
    if (sessionOwner?.id) {
      list.push({
        id: sessionOwner.id,
        username: sessionOwner.username || "creator",
        display_name: sessionOwner.display_name || sessionOwner.username || "Primary Creator",
        avatar_url: sessionOwner.avatar_url,
        role: "Primary Creator",
        isCreator: true,
      })
      seenIds.add(sessionOwner.id)
    } else if (isOwner && user) {
      list.push({
        id: user.id,
        username: user.username || "creator",
        display_name: user.display_name || user.username || "Primary Creator",
        avatar_url: user.avatar_url,
        role: "Primary Creator",
        isCreator: true,
      })
      seenIds.add(user.id)
    }

    // 2. Collaborators from Supabase Presence
    collaborators.forEach((c) => {
      if (!seenIds.has(c.id)) {
        const isThisOwner = sessionOwner?.id ? c.id === sessionOwner.id : c.role === "Primary Creator"
        list.push({
          ...c,
          role: isThisOwner ? "Primary Creator" : "Co-Author",
          isCreator: isThisOwner,
        })
        seenIds.add(c.id)
      }
    })

    // 3. Co-Authors list
    coAuthors.forEach((ca) => {
      if (!seenIds.has(ca.id)) {
        list.push({
          ...ca,
          role: "Co-Author",
          isCreator: false,
        })
        seenIds.add(ca.id)
      }
    })

    // 4. Current user if not yet listed
    if (user && !seenIds.has(user.id)) {
      list.push({
        id: user.id,
        username: user.username || "collaborator",
        display_name: user.display_name || user.username || (isOwner ? "Primary Creator" : "Co-Author"),
        avatar_url: user.avatar_url,
        role: isOwner ? "Primary Creator" : "Co-Author",
        isCreator: isOwner,
      })
    }

    return list
  }, [sessionOwner, isOwner, user, collaborators, coAuthors])

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
        <Card className="max-w-md p-6 border-cyan-500/30 bg-card text-card-foreground dark:bg-[#090d1a] dark:text-slate-100 shadow-2xl">
          <Lock className="mx-auto h-12 w-12 text-cyan-400 mb-3 animate-pulse" />
          <h2 className="text-xl font-bold">Studio Authentication Required</h2>
          <p className="text-sm text-muted-foreground mt-2">Log in to collaborate live in the Co-Loop Studio.</p>
        </Card>
      </div>
    )
  }

  // Handle Primary Creator Ending the Co-Loop Session
  const handleEndSession = async () => {
    if (!isOwner) return
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "session_ended",
          payload: { endedBy: user?.display_name || user?.username || "Primary Creator" },
        })
      }
      toast({
        title: "Session Ended 🛑",
        description: "You closed this Co-Loop studio room.",
      })
      setTimeout(() => {
        router.push("/")
      }, 1000)
    } catch (err: any) {
      console.error("End session error:", err)
    }
  }


  // Create public open invite from studio
  const handlePublishOpenInvite = async () => {
    if (!isOwner || !openInviteTopic.trim()) return
    setPublishingOpenInvite(true)
    try {
      const res = await fetch("/api/co-loop/open-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          session_id: sessionId,
          topic: openInviteTopic.trim(),
          max_collaborators: openInviteMax,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create open invite")
      toast({
        title: "Open Co-Loop Published! 🤝",
        description: "Your open invite is now live in the feed. Anyone can join!",
      })
      setOpenInviteModal(false)
      setOpenInviteTopic("")
    } catch (err: any) {
      toast({
        title: "Failed to publish",
        description: err.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setPublishingOpenInvite(false)
    }
  }

  const wordCount = postContent.trim() ? postContent.trim().split(/\s+/).length : 0
  const charCount = postContent.length

  return (
    <div className="relative min-h-[92vh] overflow-hidden rounded-3xl border border-cyan-500/20 bg-background text-foreground dark:bg-[#030712] dark:text-slate-100 p-3 sm:p-6 shadow-2xl">
      {/* Dark Ambient Studio Background Lights & Grid */}
      <div className="landing-grid-bg pointer-events-none absolute inset-0 opacity-20" />
      <div className="landing-aurora-blob pointer-events-none absolute left-1/2 top-[-10%] h-[75vmin] w-[75vmin] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.25),transparent_65%)] blur-3xl" />
      <div className="landing-aurora-blob pointer-events-none absolute -right-1/4 top-[40%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.2),transparent_65%)] blur-3xl [animation-delay:-4s]" />
      <div className="landing-aurora-blob pointer-events-none absolute -left-1/4 bottom-[10%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18),transparent_65%)] blur-3xl [animation-delay:-8s]" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-6">
        {/* Studio Control Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-card/85 dark:bg-[#080d1e]/80 p-4 sm:p-5 backdrop-blur-xl shadow-lg shadow-cyan-950/20 text-card-foreground">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 text-white font-bold shadow-lg shadow-cyan-500/25">
              <Radio className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-cyan-600 via-teal-600 to-indigo-600 dark:from-cyan-400 dark:via-teal-300 dark:to-indigo-300 bg-clip-text text-transparent">
                  Co-Loop Studio Room
                </h1>
                <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 text-[10px] font-bold px-2 py-0.5">
                  <Radio className="h-3 w-3 mr-1 text-cyan-500 animate-pulse" />
                  LIVE STAGE
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time collaborative room • Session #{sessionId}
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
            {isOwner && (
              <Button
                variant="outline"
                onClick={handleEndSession}
                className="rounded-xl border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 text-xs font-bold gap-1.5 shadow-sm"
              >
                <Power className="h-4 w-4 text-rose-500" />
                End Co-Loop
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setGiftModalOpen(true)}
              className="rounded-xl border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Coins className="h-4 w-4 text-amber-500" />
              Split Gift
            </Button>

            <Button
              variant="outline"
              onClick={() => setHistoryOpen(true)}
              className="rounded-xl border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20 text-xs font-bold gap-1.5 shadow-sm"
            >
              <History className="h-4 w-4 text-cyan-500" />
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
                  : "border border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/20"
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
        <div className="relative rounded-3xl border border-cyan-500/30 bg-card/85 dark:bg-gradient-to-b dark:from-[#0a1128]/90 dark:via-[#060b18]/80 dark:to-[#080e22]/90 p-4 sm:p-6 backdrop-blur-xl shadow-sm text-card-foreground">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" />
              <span className="text-xs font-extrabold tracking-wider uppercase text-cyan-600 dark:text-cyan-300">
                Collaborators Around the Room ({activeParticipants.length}/5)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground hidden sm:block italic">
              Avatars pulse live as creators co-write together
            </p>
          </div>

          {/* Glowing Orbs Grid/Arc */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-2">
            {activeParticipants.map((participant, idx) => {
              const isMe = participant.id === user.id
              const orbColor = AVATAR_COLORS[idx % AVATAR_COLORS.length]
              const userTyping = typingUsers[participant.id]

              return (
                <div
                  key={participant.id}
                  className="group relative flex flex-col items-center transition-all duration-300 hover:scale-105"
                >
                  {/* Typing Indicator Pill on Avatar */}
                  {userTyping && (
                    <div className="absolute -top-3 z-30 flex items-center gap-1 rounded-full bg-cyan-400 px-2 py-0.5 text-[9px] font-black text-slate-950 shadow-lg shadow-cyan-500/50 animate-bounce">
                      <span>✍️</span>
                      <span>{userTyping.field === "title" ? "Title" : "Writing"}</span>
                    </div>
                  )}

                  {/* Glowing Aura Orb Ring */}
                  <div className="relative">
                    <div
                      className={`absolute -inset-1.5 rounded-full blur-md transition-opacity ${
                        userTyping ? "opacity-100 bg-cyan-400 animate-ping" : "opacity-75 group-hover:opacity-100 animate-pulse"
                      }`}
                      style={{ backgroundColor: userTyping ? "#22d3ee" : orbColor }}
                    />
                    <VideoAvatar
                      src={participant.avatar_url}
                      videoSrc={(participant as any).video_avatar_url}
                      isPremium={(participant as any).is_premium}
                      fallback={participant.display_name?.charAt(0) || "C"}
                      size="lg"
                      className="relative h-14 w-14 sm:h-16 sm:w-16 border-2 border-white/20 ring-4 ring-cyan-500/50 shadow-2xl rounded-full shrink-0"
                    />

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
                    <p className="text-xs font-extrabold text-foreground truncate">
                      {participant.display_name} {isMe && "(You)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {userTyping ? (
                        <span className="text-cyan-500 font-bold animate-pulse">typing...</span>
                      ) : (
                        `@${participant.username}`
                      )}
                    </p>
                  </div>
                </div>
              )
            })}

            {/* Quick Invite Orb Button */}
            <button
              type="button"
              onClick={() => {
                if (coAuthors.length >= MAX_CO_AUTHORS) {
                  toast({
                    title: "Collaborator Limit Reached",
                    description: `Maximum limit of ${MAX_CO_AUTHORS} invited co-authors per Co-Loop has been reached.`,
                    variant: "destructive",
                  })
                  return
                }
                setInviteModalOpen(true)
              }}
              disabled={coAuthors.length >= MAX_CO_AUTHORS}
              className={`group flex flex-col items-center justify-center transition-all ${
                coAuthors.length >= MAX_CO_AUTHORS ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
              }`}
            >
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-dashed border-cyan-500/60 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/20 shadow-sm">
                <Plus className="h-6 w-6 group-hover:scale-110 transition-transform" />
              </div>
              <span className="mt-2 text-xs font-bold text-cyan-600 dark:text-cyan-300">
                {coAuthors.length >= MAX_CO_AUTHORS ? "Limit Reached" : "Add Co-Author"}
              </span>
            </button>

            {/* Quick Link Orb Button */}
            <button
              type="button"
              onClick={handleCopyInviteLink}
              className="group flex flex-col items-center justify-center transition-all hover:scale-105"
            >
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-border bg-muted/60 text-foreground hover:border-cyan-400 hover:text-cyan-500 shadow-sm">
                {linkCopied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
              </div>
              <span className="mt-2 text-xs font-bold text-muted-foreground">{linkCopied ? "Copied Link!" : "Copy Invite"}</span>
            </button>
          </div>

            {/* Quick Open Invite Orb Button (owner only) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  setOpenInviteTopic(postContent || postTitle || "")
                  setOpenInviteModal(true)
                }}
                className="group flex flex-col items-center justify-center transition-all hover:scale-105"
              >
                <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-amber-500/50 bg-amber-500/10 text-amber-500 hover:border-amber-400 hover:bg-amber-500/20 shadow-sm">
                  <Globe className="h-5 w-5" />
                </div>
                <span className="mt-2 text-xs font-bold text-amber-500">Open Invite</span>
              </button>
            )}

            {/* View All Sessions Link */}
            <button
              type="button"
              onClick={() => window.open('/co-loop', '_blank')}
              className="group flex flex-col items-center justify-center transition-all hover:scale-105"
            >
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-violet-500/50 bg-violet-500/10 text-violet-500 hover:border-violet-400 hover:bg-violet-500/20 shadow-sm">
                <List className="h-5 w-5" />
              </div>
              <span className="mt-2 text-xs font-bold text-violet-500">All Sessions</span>
            </button>
        </div>

        {/* FLOATING GLASS PANEL EDITOR (CENTERED CANVAS) */}
        <div className="relative mx-auto max-w-4xl">
          <Card className="border-cyan-500/30 bg-card/90 dark:bg-[#080d1e]/85 p-5 sm:p-8 backdrop-blur-2xl shadow-xl rounded-3xl space-y-6 text-card-foreground">
            {/* Live Synchronized Notice */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                  Interactive Collaborative Canvas
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{wordCount} words</span>
                <span>•</span>
                <span>{charCount} characters</span>
              </div>
            </div>

            {/* Post Title Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Co-Loop Title (Optional)
                </label>
                {Object.values(typingUsers).filter((u) => u.field === "title").length > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] font-black text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2.5 py-0.5 animate-pulse">
                    <span className="inline-block animate-bounce">✍️</span>
                    <span>
                      {Object.values(typingUsers)
                        .filter((u) => u.field === "title")
                        .map((u) => `@${u.username}`)
                        .join(", ")}{" "}
                      is typing title...
                    </span>
                  </span>
                )}
              </div>
              <Input
                value={postTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Next-Gen Collaborative Social OS..."
                className="rounded-2xl border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 text-base font-bold h-12"
              />
            </div>

            {/* Main Content Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Story / Post Content
                </label>
                {Object.values(typingUsers).filter((u) => u.field === "content").length > 0 && (
                  <span className="flex items-center gap-1.5 text-[11px] font-black text-cyan-600 dark:text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2.5 py-0.5 animate-pulse">
                    <span className="inline-block animate-bounce">✍️</span>
                    <span>
                      {Object.values(typingUsers)
                        .filter((u) => u.field === "content")
                        .map((u) => `@${u.username}`)
                        .join(", ")}{" "}
                      is co-writing story...
                    </span>
                  </span>
                )}
              </div>
              <Textarea
                value={postContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Co-author your story, announcement, or code snippet live in real-time..."
                className="min-h-[220px] rounded-2xl border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30 text-sm sm:text-base leading-relaxed p-4"
              />
            </div>

            {/* Hashtags & Media Attachments (Allowing image/video upload for creator and co-authors) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Hashtags */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  Hashtags
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddHashtag())}
                    placeholder="e.g. #CoLoop #Innovation"
                    className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground text-xs h-9"
                  />
                  <Button type="button" onClick={handleAddHashtag} size="sm" className="rounded-xl bg-cyan-600 text-white font-bold h-9">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {hashtags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40 text-xs py-1 px-2.5 rounded-lg flex items-center gap-1"
                    >
                      #{tag}
                      <button type="button" onClick={() => handleRemoveHashtag(tag)} className="hover:text-rose-400 ml-1">
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Media Attachments Section (All Co-Authors Upload Images/Videos) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-cyan-400" />
                    Media Attachments
                  </label>
                  {user?.is_premium && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                      PRO Multi-File Enabled
                    </Badge>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileUpload(e.target.files)}
                  multiple={Boolean(user?.is_premium)}
                  accept="image/*,video/*"
                  className="hidden"
                />

                {/* Drag & drop zone */}
                <div
                  onDragEnter={(e) => {
                    e.preventDefault()
                    dragDepthRef.current += 1
                    setDragActive(true)
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
                    if (dragDepthRef.current === 0) setDragActive(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    dragDepthRef.current = 0
                    setDragActive(false)
                    void handleFileUpload(e.dataTransfer.files)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors ${
                    dragActive
                      ? "border-cyan-400 bg-cyan-500/15"
                      : "border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-400/60 hover:bg-cyan-500/10"
                  }`}
                >
                  {uploadingMedia ? (
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                  ) : dragActive ? (
                    <Upload className="h-5 w-5 text-cyan-300" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-cyan-400" />
                  )}
                  <p className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                    {uploadingMedia ? "Uploading..." : dragActive ? "Drop to attach" : "Click or drag image / video here"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {user?.is_premium ? "Pro — up to 4 files" : "Free — 1 file"} · JPEG, PNG, GIF, HEIC, MP4, WebM
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      fileInputRef.current?.click()
                    }}
                    disabled={uploadingMedia}
                    variant="outline"
                    className="rounded-xl border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 dark:bg-cyan-950/30 hover:bg-cyan-500/20 text-xs font-bold gap-1.5 h-9"
                  >
                    <Paperclip className="h-4 w-4 text-cyan-400" />
                    Browse files
                  </Button>

                  {/* URL Fallback */}
                  <Input
                    value={mediaUrl}
                    onChange={(e) => {
                      setMediaUrl(e.target.value)
                      if (e.target.value && !mediaUrls.includes(e.target.value)) {
                        const updated = [e.target.value, ...mediaUrls]
                        setMediaUrls(updated)
                        broadcastDocUpdate({ mediaUrls: updated, mediaUrl: e.target.value })
                      } else {
                        broadcastDocUpdate({ mediaUrl: e.target.value })
                      }
                    }}
                    placeholder="or paste URL..."
                    className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-slate-950/60 dark:text-white text-xs h-9 flex-1 min-w-[120px]"
                  />
                </div>

                {/* Media Previews List */}
                {mediaUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {mediaUrls.map((url, index) => {
                      const isVid = url.match(/\.(mp4|webm|ogg|mov|m4v|avi)(\?|$)/i) || mediaType === "video"
                      return (
                        <div key={url + index} className="relative group rounded-xl overflow-hidden border border-cyan-500/30 bg-muted dark:bg-slate-900 h-20">
                          {isVid ? (
                            // eslint-disable-next-line jsx-a11y/media-has-caption
                            <video src={url} muted preload="metadata" playsInline className="h-full w-full object-cover" />
                          ) : (
                            <img src={url} alt="Media attachment" className="h-full w-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(index)}
                            className="absolute top-1 right-1 bg-rose-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* INLINE IN-STUDIO DISCUSSION SPACE */}
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs font-black uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                    In-Studio Thread Discussion ({chatMessages.length})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 font-bold h-7 px-2"
                >
                  {isChatOpen ? "Close Side Panel" : "Expand Side Panel →"}
                </Button>
              </div>

              {/* Embedded Chat Stream Box */}
              <div className="rounded-2xl border border-cyan-500/20 bg-muted/40 p-3.5 space-y-3 max-h-56 overflow-y-auto">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground space-y-1">
                    <MessageSquare className="h-6 w-6 text-cyan-500 mx-auto opacity-60" />
                    <p className="text-xs font-semibold">No in-studio thread messages yet.</p>
                    <p className="text-[11px] text-muted-foreground/80">
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
                        <VideoAvatar src={msg.sender_avatar} videoSrc={(msg as any).sender_video_avatar_url} isPremium={(msg as any).sender_is_premium} fallback={msg.sender_name.charAt(0)} size="sm" className="h-7 w-7 border border-cyan-500/30 shrink-0 rounded-full" />
                        <div
                          className={`rounded-2xl px-3.5 py-2 max-w-[85%] shadow-md ${
                            isMe
                              ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium"
                              : "bg-card border border-border text-card-foreground"
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
              </div>

              {/* Inline Chat Input Form */}
              <form onSubmit={handleSendChatMessage} className="flex gap-2">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Discuss live with co-authors..."
                  className="rounded-xl border-border bg-background text-foreground text-xs h-10"
                />
                <Button type="submit" className="rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-extrabold h-10 px-4 text-xs gap-1 shrink-0">
                  <Send className="h-3.5 w-3.5" />
                  <span>Send</span>
                </Button>
              </form>
            </div>

            {/* CEREMONIAL PUBLISH BAR */}
            <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Stacked co-author credits will display on feed with +50 activation bonus</span>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button
                  type="button"
                  onClick={() => handleSaveSnapshot()}
                  variant="outline"
                  className="rounded-xl border-cyan-500/40 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/10 text-xs font-bold h-11"
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

      {/* Floating Chat Drawer Trigger Button (Bottom Right) */}
      {!isChatOpen && (
        <button
          type="button"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[990] flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-3 text-black font-extrabold shadow-2xl shadow-cyan-500/50 hover:scale-105 transition-transform"
        >
          <MessageSquare className="h-5 w-5" />
          <span>In-Studio Chat</span>
          {unreadChatCount > 0 && (
            <Badge className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-black animate-bounce">
              {unreadChatCount}
            </Badge>
          )}
        </button>
      )}

      {/* Mobile Drawer Backdrop Overlay */}
      {isChatOpen && (
        <div
          onClick={() => setIsChatOpen(false)}
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm sm:hidden transition-opacity"
        />
      )}

      {/* SLIDE-IN SIDE CHAT THREAD DRAWER */}
      <div
        className={`fixed inset-y-0 right-0 z-[9999] w-full sm:w-96 border-l border-cyan-500/30 bg-card text-card-foreground backdrop-blur-2xl shadow-2xl p-4 flex flex-col h-full max-h-screen transition-transform duration-300 ease-in-out ${
          isChatOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-cyan-500" />
            <h3 className="text-sm font-extrabold text-foreground">In-Studio Thread</h3>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setIsChatOpen(false)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0 py-4 pr-2">
          <div className="space-y-3">
            {chatMessages.length === 0 ? (
              <div className="text-center py-12 px-4 text-muted-foreground space-y-2">
                <MessageSquare className="h-8 w-8 text-cyan-400 mx-auto opacity-70" />
                <p className="text-xs font-semibold">No thread messages yet.</p>
                <p className="text-[11px] text-muted-foreground/80">
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
                    <VideoAvatar src={msg.sender_avatar} videoSrc={(msg as any).sender_video_avatar_url} isPremium={(msg as any).sender_is_premium} fallback={msg.sender_name.charAt(0)} size="sm" className="h-7 w-7 border border-cyan-500/30 rounded-full" />
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 max-w-[82%] shadow-md ${
                        isMe
                          ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-medium"
                          : "bg-muted border-border text-foreground dark:bg-slate-900 dark:border-white/10 dark:text-slate-100"
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

        {/* Chat Input Form - Anchored at bottom */}
        <form onSubmit={handleSendChatMessage} className="pt-2 border-t border-border flex gap-2 shrink-0 pb-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type message to room..."
            className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-slate-900 dark:text-white text-xs h-10"
          />
          <Button type="submit" className="rounded-xl bg-cyan-500 text-black hover:bg-cyan-400 font-bold h-10 px-4">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* CEREMONIAL PUBLISH CELEBRATION MODAL */}
      <Dialog open={publishCeremonyOpen} onOpenChange={setPublishCeremonyOpen}>
        <DialogContent className="sm:max-w-lg border-cyan-500/40 dark:bg-[#080d1e] dark:text-slate-100 p-6 overflow-hidden">
          {/* Background Ring Effects */}
          <div className="pointer-events-none absolute -inset-10 rounded-full border border-cyan-500/30 animate-ping opacity-20" />
          <div className="pointer-events-none absolute -inset-20 rounded-full border border-purple-500/20 animate-pulse opacity-20" />

          <DialogHeader className="text-center space-y-3 relative z-10">
            <div className="flex justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-cyan-400 via-indigo-600 to-purple-600 shadow-2xl shadow-cyan-500/50">
                <Rocket className="h-10 w-10 text-white animate-bounce" />
              </div>
            </div>

            <DialogTitle className="text-2xl font-black text-foreground dark:text-white tracking-tight">
              Co-Loop Broadcasted Live! 🚀
            </DialogTitle>
            <DialogDescription className="text-muted-foreground dark:text-slate-300 text-xs sm:text-sm">
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
            <div className="rounded-2xl border border-cyan-500/30 bg-muted/80 dark:bg-slate-900/80 p-3.5 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-300">Official Co-Authors</p>
              <div className="flex items-center -space-x-3 overflow-hidden py-1">
                <VideoAvatar src={user.avatar_url} videoSrc={(user as any).video_avatar_url} isPremium={(user as any).is_premium} fallback={user.username?.charAt(0)} size="sm" className="h-9 w-9 ring-2 ring-cyan-400 rounded-full" />
                {coAuthors.map((ca) => (
                  <VideoAvatar key={ca.id} src={ca.avatar_url} videoSrc={(ca as any).video_avatar_url} isPremium={(ca as any).is_premium} fallback={ca.display_name?.charAt(0)} size="sm" className="h-9 w-9 ring-2 ring-purple-500 rounded-full" />
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
                  // This session is published/closed — start a genuinely new
                  // one rather than reusing this (now-stale) session id.
                  router.push("/co-loop/studio")
                }}
                className="w-full border-border text-foreground hover:bg-muted dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 rounded-xl h-10 text-xs"
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
          mediaUrls,
          mediaType,
          coAuthors,
        }}
        onSaveSnapshot={handleSaveSnapshot}
        onRestoreVersion={handleRestoreVersion}
      />

      {/* Invite Collaborator Dialog */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-md border-cyan-500/40 dark:bg-[#080d1e] dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-cyan-400">
              <UserPlus className="h-5 w-5" /> Invite Collaborator to Co-Loop
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground dark:text-slate-400">
              Generate a shareable live session link or search a creator to send an invitation via DM and Notification. (Maximum {MAX_CO_AUTHORS} invited co-authors per Co-Loop).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {coAuthors.length >= MAX_CO_AUTHORS ? (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-center text-xs text-rose-200">
                ⚠️ Collaborator Limit Reached ({MAX_CO_AUTHORS}/{MAX_CO_AUTHORS} invited co-authors). You cannot invite additional collaborators to this Co-Loop session.
              </div>
            ) : (
              <>
                {/* Shareable Link Box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 block">
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
                      className="rounded-xl border-cyan-500/30 bg-muted text-foreground dark:bg-slate-900 dark:text-cyan-200 text-xs font-mono"
                    />
                    <Button
                      onClick={() => void handleCopyInviteLink()}
                      className="rounded-xl font-bold shrink-0 text-xs gap-1"
                    >
                      {linkCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                      {linkCopied ? "Done!" : "Share"}
                    </Button>
                  </div>
                </div>

                {/* Direct DM Search */}
                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-slate-400 block">
                    Invite via DM & Notification
                  </label>
                  <Input
                    value={invitedUserInput}
                    onChange={(e) => setInvitedUserInput(e.target.value)}
                    onFocus={() => invitedUserInput.trim() && setShowSuggestions(true)}
                    placeholder="Search @username..."
                    className="rounded-xl border-border bg-muted text-foreground placeholder:text-muted-foreground dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 text-xs"
                  />

                  {showSuggestions && userSuggestions.length > 0 && (
                    <div className="rounded-xl border border-cyan-500/30 bg-card dark:bg-slate-900 p-2 space-y-1 shadow-xl max-h-48 overflow-y-auto">
                      {userSuggestions.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2 hover:bg-cyan-500/10 rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <VideoAvatar src={u.avatar_url} videoSrc={u.video_avatar_url} isPremium={u.is_premium} fallback={u.username?.charAt(0)} size="sm" className="h-7 w-7 rounded-full" />
                            <div>
                              <p className="font-bold">{u.display_name || u.username}</p>
                              <p className="text-[10px] text-muted-foreground dark:text-slate-400">@{u.username}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={sendingInvite || coAuthors.length >= MAX_CO_AUTHORS}
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
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Gift Dialog */}
      <Dialog open={giftModalOpen} onOpenChange={setGiftModalOpen}>
        <DialogContent className="sm:max-w-md border-amber-500/40 dark:bg-[#080d1e] dark:text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Coins className="h-5 w-5" /> Co-Loop Split Gift 🎁
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground dark:text-slate-400">
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
                    className="flex flex-col items-center justify-center h-20 rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-card to-amber-500/5 dark:from-amber-950/40 dark:via-slate-900 dark:to-amber-900/20 hover:border-amber-400 text-amber-700 dark:text-amber-300 font-bold"
                  >
                    <span className="text-lg font-extrabold flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-400" /> {amount} Coins
                    </span>
                    <span className="text-[10px] text-muted-foreground dark:text-slate-400 mt-0.5">
                      ({perAuthor} coins each)
                    </span>
                  </Button>
                )
              })}
            </div>
          </div>
        </DialogContent>

      {/* Open Invite Dialog */}
      <Dialog open={openInviteModal} onOpenChange={setOpenInviteModal}>
        <DialogContent className="sm:max-w-lg border-cyan-500/30 bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-amber-500" />
              Create Public Open Invite
            </DialogTitle>
            <DialogDescription>
              Publish an open call in the feed. Anyone on Loop can join your session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Topic / Prompt</label>
              <Textarea
                value={openInviteTopic}
                onChange={(e) => setOpenInviteTopic(e.target.value)}
                placeholder="What should we create together?"
                rows={3}
                className="resize-none"
              />
            </div>
            <div>
              <label className="text-sm font-semibold mb-1.5 block">Max Collaborators</label>
              <div className="flex gap-2">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setOpenInviteMax(n)}
                    className={`flex-1 rounded-xl border-2 px-3 py-2 text-center font-bold transition-all ${
                      openInviteMax === n
                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                        : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Button
              onClick={() => void handlePublishOpenInvite()}
              disabled={publishingOpenInvite || !openInviteTopic.trim()}
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 font-bold text-white shadow-lg"
            >
              {publishingOpenInvite ? "Publishing..." : "Publish Open Invite"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </Dialog>
    </div>
  )
}

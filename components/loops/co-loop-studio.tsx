"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { absoluteAppUrl, shareContent } from "@/lib/share"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { confirmDialog } from "@/components/ui/confirm-dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/skeletons"
import { Check, Coins, Crown, Globe, Lock, Rocket, Save, Unlock, Users, UserPlus } from "lucide-react"
import { CoLoopVersionHistory, type CoLoopVersion } from "./co-loop-version-history"
import { CoLoopCanvas, type RemoteEdit } from "./studio/co-loop-canvas"
import { CoLoopActivityRail } from "./studio/co-loop-activity-rail"
import { StudioCommandBar } from "./studio/studio-command-bar"
import { StudioDialogs } from "./studio/studio-dialogs"
import { useCoLoopRealtime } from "./studio/use-co-loop-realtime"
import {
  MAX_CO_AUTHORS,
  colorForParticipant,
  type StudioActivityAction,
  type StudioActivityEntry,
  type StudioChatMessage,
  type StudioDocState,
  type StudioField,
  type StudioMediaType,
  type StudioMetaPatch,
  type StudioParticipant,
  type StudioRoomEvent,
} from "./studio/studio-types"

const EMPTY_DOC: StudioDocState = {
  title: "",
  content: "",
  hashtags: [],
  mediaUrl: "",
  mediaUrls: [],
  mediaType: "text",
}

/** How long after the last keystroke the shared draft is persisted. */
const DRAFT_SAVE_MS = 3000
/** Minimum gap between one author's "edited the draft" entries in the feed. */
const EDIT_ENTRY_COOLDOWN_MS = 10 * 60 * 1000

function formatStamp(value?: string | null) {
  if (!value) return "just now"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "just now"
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function mapServerVersion(row: any): CoLoopVersion {
  return {
    id: String(row.id),
    versionNumber: Number(row.version_number) || 1,
    title: row.title || "",
    content: row.content || "",
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    mediaUrl: row.media_url || "",
    mediaUrls: Array.isArray(row.media_urls) ? row.media_urls : [],
    mediaType: (row.media_type || "text") as StudioMediaType,
    coAuthors: Array.isArray(row.co_authors) ? row.co_authors : [],
    timestamp: formatStamp(row.created_at),
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
    label: row.label || undefined,
    savedBy: {
      id: row.saved_by_id || "",
      name: row.saved_by_name || "Collaborator",
      avatar: row.saved_by_avatar || null,
    },
  }
}

export function CoLoopStudio() {
  const { user, getAuthHeader } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const paramSession = searchParams.get("session")
  const [sessionId, setSessionId] = useState(
    () => paramSession || `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  )

  // Keep the URL in sync so an invite link always points at the live room.
  useEffect(() => {
    const current = searchParams.get("session")
    if (!current && sessionId) {
      router.replace(`/co-loop/studio?session=${encodeURIComponent(sessionId)}`)
    } else if (current && current !== sessionId) {
      setSessionId(current)
    }
  }, [searchParams, sessionId, router])

  /* ── Document ─────────────────────────────────────────────────── */
  const [doc, setDoc] = useState<StudioDocState>(EMPTY_DOC)
  const docRef = useRef<StudioDocState>(EMPTY_DOC)
  useEffect(() => {
    docRef.current = doc
  }, [doc])

  const [remoteEdit, setRemoteEdit] = useState<RemoteEdit | null>(null)
  const remoteSeqRef = useRef(0)
  const bumpRemoteEdit = useCallback((field: StudioField, ops: RemoteEdit["ops"]) => {
    remoteSeqRef.current += 1
    setRemoteEdit({ field, ops, seq: remoteSeqRef.current })
  }, [])

  /* ── Session / roster / versions ──────────────────────────────── */
  const [owner, setOwner] = useState<{
    id?: string
    username?: string
    display_name?: string
    avatar_url?: string | null
  } | null>(null)
  const [roster, setRoster] = useState<StudioParticipant[]>([])
  const [isOwner, setIsOwner] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const [versions, setVersions] = useState<CoLoopVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savingVersion, setSavingVersion] = useState(false)
  const [activityFeed, setActivityFeed] = useState<StudioActivityEntry[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [locked, setLocked] = useState(false)
  const lastEditEntryRef = useRef(0)

  /* ── UI ───────────────────────────────────────────────────────── */
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [giftOpen, setGiftOpen] = useState(false)
  const [openInviteOpen, setOpenInviteOpen] = useState(false)
  const [ceremonyOpen, setCeremonyOpen] = useState(false)
  const [publishedAuthors, setPublishedAuthors] = useState(1)
  const [activityOpen, setActivityOpen] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [sendingGift, setSendingGift] = useState(false)
  const [publishingOpenInvite, setPublishingOpenInvite] = useState(false)
  const [inviteQuery, setInviteQuery] = useState("")
  const [inviteResults, setInviteResults] = useState<any[]>([])
  const [searchingInvite, setSearchingInvite] = useState(false)
  const [openInviteTopic, setOpenInviteTopic] = useState("")
  const [openInviteMax, setOpenInviteMax] = useState(4)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  /* ── Realtime callbacks ───────────────────────────────────────── */
  const handleRemoteText = useCallback(
    (field: StudioField, text: string, ops: RemoteEdit["ops"]) => {
      bumpRemoteEdit(field, ops)
      setDoc((prev) => (prev[field] === text ? prev : { ...prev, [field]: text }))
    },
    [bumpRemoteEdit]
  )

  const handleAdoptSnapshot = useCallback(
    (field: StudioField, text: string) => {
      bumpRemoteEdit(field, [])
      setDoc((prev) => (prev[field] === text ? prev : { ...prev, [field]: text }))
    },
    [bumpRemoteEdit]
  )

  const handleMeta = useCallback((patch: StudioMetaPatch) => {
    setDoc((prev) => ({
      ...prev,
      hashtags: patch.hashtags ?? prev.hashtags,
      mediaUrl: patch.mediaUrl ?? prev.mediaUrl,
      mediaUrls: patch.mediaUrls ?? prev.mediaUrls,
      mediaType: patch.mediaType ?? prev.mediaType,
    }))
  }, [])

  const handleRoomEvent = useCallback(
    (event: StudioRoomEvent) => {
      switch (event.type) {
        case "joined":
          toast({
            title: `${event.participant.display_name} joined the room`,
            description:
              event.participant.role === "Primary Creator"
                ? "The host is back in the studio."
                : "They can now write with you in real time.",
          })
          break
        case "left":
          toast({ title: `${event.participant.display_name} left the room` })
          break
        case "version-saved": {
          const version = event.version as unknown as CoLoopVersion
          setVersions((prev) => [version, ...prev.filter((v) => v.id !== version.id)])
          toast({
            title: `Version v${version.versionNumber} saved`,
            description: `${version.savedBy?.name || "A collaborator"} captured a checkpoint.`,
          })
          break
        }
        case "version-restored": {
          const version = event.version as unknown as CoLoopVersion
          if (!version) break
          bumpRemoteEdit("content", [])
          setDoc((prev) => ({
            ...prev,
            title: version.title || "",
            content: version.content || "",
            hashtags: version.hashtags || [],
            mediaUrl: version.mediaUrl || "",
            mediaUrls: version.mediaUrls?.length ? version.mediaUrls : version.mediaUrl ? [version.mediaUrl] : [],
            mediaType: version.mediaType || "text",
          }))
          toast({
            title: `Reverted to v${version.versionNumber}`,
            description: `${event.by} restored an earlier checkpoint.`,
          })
          break
        }
        case "gift":
          toast({
            title: `Gift from ${event.senderName}`,
            description: `${event.amount} coins split — each author received ${event.splitAmount}.`,
          })
          break
        case "session-ended":
          toast({ title: "Session ended", description: `${event.by} closed this Co-Loop room.` })
          setTimeout(() => router.push("/"), 1200)
          break
        case "published":
          toast({
            title: "Co-Loop published",
            description: `${event.by} published this collaboration — the session is now closed.`,
          })
          setTimeout(() => router.push("/"), 1200)
          break
        case "room-lock":
          setLocked(event.locked)
          toast({
            title: event.locked ? "Room locked" : "Room unlocked",
            description: event.locked
              ? `${event.by} froze the draft — everyone can read, only the host can edit.`
              : `${event.by} opened the draft for everyone again.`,
            variant: event.locked ? "warning" : "success",
            icon: event.locked ? Lock : Unlock,
          })
          break
        case "room-deleted":
          toast({
            title: "Room deleted",
            description: `${event.by} retired this studio room. Taking you back to the feed.`,
          })
          setTimeout(() => router.push("/"), 1400)
          break
        case "activity":
          setActivityFeed((prev) =>
            prev.some((e) => e.id === event.entry.id) ? prev : [event.entry, ...prev].slice(0, 50)
          )
          break
        case "error":
          toast({ title: "Studio problem", description: event.message, variant: "destructive" })
          break
      }
    },
    [bumpRemoteEdit, router, toast]
  )

  const realtime = useCoLoopRealtime({
    sessionId,
    enabled: Boolean(user && sessionReady),
    self: user
      ? {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: (user as any).avatar_url ?? null,
          video_avatar_url: (user as any).video_avatar_url ?? null,
          is_premium: user.is_premium,
        }
      : null,
    isOwner,
    role: isOwner ? "Primary Creator" : "Co-Author",
    onRemoteText: handleRemoteText,
    onAdoptSnapshot: handleAdoptSnapshot,
    onMeta: handleMeta,
    onRoomEvent: handleRoomEvent,
  })

  const { seedField, publishField, flushField, focusField, announceMeta, announceVersionSaved } = realtime

  /* ── Activity feed ────────────────────────────────────────────────
   * One durable record per meaningful room event — who saved, restored,
   * gifted, invited, locked, published, and (coarsely) who wrote what.
   */
  const recordActivity = useCallback(
    async (action: StudioActivityAction, summary?: string) => {
      if (!user) return
      try {
        const res = await fetch("/api/co-loop/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ session_id: sessionId, action, summary }),
        })
        if (!res.ok) return
        const data = await res.json()
        const entry = data.entry as StudioActivityEntry | undefined
        if (entry?.id) {
          setActivityFeed((prev) => [entry, ...prev.filter((e) => e.id !== entry.id)].slice(0, 50))
          realtime.announceActivity(entry)
        }
      } catch {
        /* the feed is supplementary — never block the action it describes */
      }
    },
    [getAuthHeader, realtime, sessionId, user]
  )

  /* ── Resolve session: owner, roster, shared draft ─────────────── */
  useEffect(() => {
    if (!user || !sessionId) return
    let cancelled = false

    const resolve = async () => {
      try {
        const res = await fetch("/api/co-loop/session-info", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ session_id: sessionId }),
        })
        const data = await res.json()
        if (cancelled) return

        // The host retired this room — there is nothing left to studio in.
        if (res.status === 410 || data.deleted) {
          toast({ title: "Room deleted", description: "This studio room no longer exists." })
          router.push("/")
          return
        }
        setLocked(Boolean(data.locked))

        const ownerObj = data.inviter || (data.owner_id ? { id: data.owner_id, username: data.owner_username } : null)
        setOwner(ownerObj)
        setIsOwner(
          Boolean(
            ownerObj?.id
              ? ownerObj.id === user.id
              : ownerObj?.username && user.username && ownerObj.username.toLowerCase() === user.username.toLowerCase()
          )
        )

        if (Array.isArray(data.co_authors)) {
          setRoster(
            data.co_authors.map((entry: any) => ({
              id: entry.id,
              username: entry.username || "collaborator",
              display_name: entry.display_name || entry.username || "Co-author",
              avatar_url: entry.avatar_url ?? null,
              video_avatar_url: entry.video_avatar_url ?? null,
              is_premium: Boolean(entry.is_premium),
              role: "Co-Author" as const,
              color: colorForParticipant(entry.id),
            }))
          )
        }

        // Rehydrate the shared draft. Realtime still wins once peers are in the
        // room: an authoritative snapshot replaces this without a typing fight.
        const draft = data.draft || {}
        if ((draft.title || draft.content) && !draftLoaded) {
          setDoc((prev) => ({
            ...prev,
            title: prev.title || draft.title || "",
            content: prev.content || draft.content || "",
          }))
          seedField("title", draft.title || "")
          seedField("content", draft.content || "")
        }
        setDraftLoaded(true)
      } catch (err) {
        console.error("Co-Loop session resolve failed:", err)
      } finally {
        if (!cancelled) setSessionReady(true)
      }
    }

    void resolve()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user, getAuthHeader])

  /* ── Load the shared version timeline ─────────────────────────── */
  const loadVersions = useCallback(async () => {
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/co-loop/versions?session_id=${encodeURIComponent(sessionId)}`, {
        headers: getAuthHeader(),
      })
      const data = await res.json()
      setVersions(Array.isArray(data.versions) ? data.versions.map(mapServerVersion) : [])
    } catch {
      setVersions([])
    } finally {
      setVersionsLoading(false)
    }
  }, [sessionId, getAuthHeader])

  useEffect(() => {
    if (!sessionReady) return
    void loadVersions()
  }, [sessionReady, loadVersions])

  /* ── Load the room's activity feed ────────────────────────────── */
  const loadActivity = useCallback(async () => {
    setActivityLoading(true)
    try {
      const res = await fetch(`/api/co-loop/activity?session_id=${encodeURIComponent(sessionId)}`, {
        headers: getAuthHeader(),
      })
      const data = await res.json()
      setActivityFeed(Array.isArray(data.entries) ? data.entries : [])
    } catch {
      setActivityFeed([])
    } finally {
      setActivityLoading(false)
    }
  }, [sessionId, getAuthHeader])

  useEffect(() => {
    if (!sessionReady) return
    void loadActivity()
  }, [sessionReady, loadActivity])

  /* ── Autosave the shared draft ───────────────────────────────── */
  const draftSnapshotRef = useRef("")
  useEffect(() => {
    if (!sessionReady || !draftLoaded) return
    const signature = JSON.stringify([doc.title, doc.content])
    if (signature === draftSnapshotRef.current) return
    const timer = setTimeout(async () => {
      // Captured before the snapshot advances — the very first save after
      // hydration is a rehydrate, not someone typing.
      const hadPriorDraft = draftSnapshotRef.current !== ""
      draftSnapshotRef.current = signature
      try {
        await fetch("/api/co-loop/session-info", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ session_id: sessionId, draft_title: doc.title, draft_content: doc.content }),
        })
        setSavedAt(Date.now())

        // Paper trail: who was writing, and roughly what, without logging a
        // row per keystroke — one entry per author per cooldown window.
        const excerpt = (doc.title || doc.content).trim().replace(/\s+/g, " ").slice(0, 120)
        if (
          hadPriorDraft &&
          excerpt &&
          Date.now() - lastEditEntryRef.current > EDIT_ENTRY_COOLDOWN_MS
        ) {
          lastEditEntryRef.current = Date.now()
          void recordActivity("edited", `“${excerpt}”`)
        }
      } catch {
        /* offline — realtime peers still hold the document */
      }
    }, DRAFT_SAVE_MS)
    return () => clearTimeout(timer)
  }, [doc.title, doc.content, sessionReady, draftLoaded, sessionId, getAuthHeader, recordActivity])

  /* ── Editing ──────────────────────────────────────────────────── */
  const handleTitleChange = useCallback(
    (value: string) => {
      setDoc((prev) => ({ ...prev, title: value }))
      publishField("title", value)
    },
    [publishField]
  )

  const handleContentChange = useCallback(
    (value: string) => {
      setDoc((prev) => ({ ...prev, content: value }))
      publishField("content", value)
    },
    [publishField]
  )

  const handleFieldFocus = useCallback(
    (field: StudioField | null) => {
      if (field === null) {
        flushField("title")
        flushField("content")
        realtime.publishCursor(null, 0)
      }
      focusField(field)
    },
    [flushField, focusField, realtime]
  )

  const handleCursorMove = useCallback(
    (field: StudioField | null, offset: number) => realtime.publishCursor(field, offset),
    [realtime]
  )

  /* ── Hashtags & media ─────────────────────────────────────────── */
  const handleAddHashtag = useCallback(
    (tag: string) => {
      setDoc((prev) => {
        if (!tag || prev.hashtags.includes(tag)) return prev
        const hashtags = [...prev.hashtags, tag]
        announceMeta({ hashtags })
        return { ...prev, hashtags }
      })
    },
    [announceMeta]
  )

  const handleRemoveHashtag = useCallback(
    (tag: string) => {
      setDoc((prev) => {
        const hashtags = prev.hashtags.filter((t) => t !== tag)
        announceMeta({ hashtags })
        return { ...prev, hashtags }
      })
    },
    [announceMeta]
  )

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !user) return
      const isPro = Boolean(user.is_premium)
      const list = Array.from(files)
      if (!isPro && list.length > 1) {
        toast({ title: "Pro feature", description: "Multiple attachments need Pro — uploading the first file only." })
      }
      const selected = isPro ? list.slice(0, 4) : [list[0]]
      setUploadingMedia(true)
      try {
        const { uploadMediaFile } = await import("@/lib/client-media-upload")
        const uploaded: string[] = []
        let detected: StudioMediaType = "image"
        for (const file of selected) {
          const kind = file.type.startsWith("video/") ? "video" : "image"
          if (kind === "video") detected = "video"
          const result = await uploadMediaFile(file, {
            authHeaders: getAuthHeader(),
            type: kind as "image" | "video",
            folder: "co-loops",
          })
          if (result.url) uploaded.push(result.url)
        }
        if (uploaded.length === 0) return

        const current = docRef.current
        const existing = current.mediaUrls?.length ? current.mediaUrls : current.mediaUrl ? [current.mediaUrl] : []
        const mediaUrls = isPro ? [...existing, ...uploaded].slice(0, 4) : [uploaded[0]]
        setDoc((prev) => ({ ...prev, mediaUrls, mediaUrl: mediaUrls[0] || "", mediaType: detected }))
        announceMeta({ mediaUrls, mediaUrl: mediaUrls[0] || "", mediaType: detected })
        toast({
          title: "Attached",
          description: `${uploaded.length} file${uploaded.length > 1 ? "s" : ""} added to the draft.`,
        })
      } catch (err: any) {
        toast({ title: "Upload failed", description: err?.message || "Could not attach that file.", variant: "destructive" })
      } finally {
        setUploadingMedia(false)
      }
    },
    [announceMeta, getAuthHeader, toast, user]
  )

  const handleRemoveMedia = useCallback(
    (index: number) => {
      setDoc((prev) => {
        const mediaUrls = prev.mediaUrls.filter((_, i) => i !== index)
        const mediaType: StudioMediaType = mediaUrls.length === 0 ? "text" : prev.mediaType
        announceMeta({ mediaUrls, mediaUrl: mediaUrls[0] || "", mediaType })
        return { ...prev, mediaUrls, mediaUrl: mediaUrls[0] || "", mediaType }
      })
    },
    [announceMeta]
  )

  const handleAddMediaUrl = useCallback(
    (url: string) => {
      setDoc((prev) => {
        if (prev.mediaUrls.includes(url)) return prev
        const mediaUrls = [...prev.mediaUrls, url].slice(0, 4)
        const mediaType: StudioMediaType = /\.(mp4|webm|ogg|mov|m4v|avi)(\?|$)/i.test(url)
          ? "video"
          : prev.mediaType === "text"
            ? "image"
            : prev.mediaType
        announceMeta({ mediaUrls, mediaUrl: mediaUrls[0] || url, mediaType })
        return { ...prev, mediaUrls, mediaUrl: mediaUrls[0] || url, mediaType }
      })
    },
    [announceMeta]
  )

  /* ── Version snapshots ────────────────────────────────────────── */
  const handleSaveSnapshot = useCallback(
    async (label?: string) => {
      if (!doc.title.trim() && !doc.content.trim()) {
        toast({ title: "Nothing to snapshot", description: "Write something first.", variant: "destructive" })
        return
      }
      setSavingVersion(true)
      try {
        const res = await fetch("/api/co-loop/versions", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({
            session_id: sessionId,
            title: doc.title,
            content: doc.content,
            hashtags: doc.hashtags,
            media_url: doc.mediaUrl,
            media_urls: doc.mediaUrls,
            media_type: doc.mediaType,
            co_authors: roster.map((c) => ({
              id: c.id,
              username: c.username,
              display_name: c.display_name,
              avatar_url: c.avatar_url,
            })),
            label,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not save this snapshot")

        const version = mapServerVersion(data.version)
        setVersions((prev) => [version, ...prev.filter((v) => v.id !== version.id)])
        announceVersionSaved(version)
        void recordActivity("version_saved", `v${version.versionNumber}${label ? ` — ${label}` : ""}`)
        toast({ title: `Version v${version.versionNumber} saved`, description: version.label, variant: "success", icon: Save })
      } catch (err: any) {
        toast({ title: "Snapshot failed", description: err?.message || "Try again.", variant: "destructive" })
      } finally {
        setSavingVersion(false)
      }
    },
    [announceVersionSaved, doc, getAuthHeader, recordActivity, roster, sessionId, toast]
  )

  const handleRestoreVersion = useCallback(
    (version: CoLoopVersion) => {
      const mediaUrls = version.mediaUrls?.length ? version.mediaUrls : version.mediaUrl ? [version.mediaUrl] : []
      setDoc((prev) => ({
        ...prev,
        title: version.title || "",
        content: version.content || "",
        hashtags: version.hashtags || [],
        mediaUrl: version.mediaUrl || "",
        mediaUrls,
        mediaType: version.mediaType || "text",
      }))
      // Authoritative: the room adopts the restored text, or merges it on top of
      // whatever anyone is typing right now.
      realtime.publishSnapshot("title", version.title || "")
      realtime.publishSnapshot("content", version.content || "")
      announceMeta({
        hashtags: version.hashtags || [],
        mediaUrl: version.mediaUrl || "",
        mediaUrls,
        mediaType: version.mediaType || "text",
      })
      realtime.announceVersionRestored(version, user?.display_name || user?.username || "A collaborator")
      void recordActivity("version_restored", `v${version.versionNumber}`)
      toast({ title: `Reverted to v${version.versionNumber}`, description: version.label })
    },
    [announceMeta, recordActivity, realtime, toast, user]
  )

  /* ── Invites ──────────────────────────────────────────────────── */
  const inviteUrl = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : absoluteAppUrl(
            `/co-loop/join/${sessionId}${user?.username ? `?invitedBy=${encodeURIComponent(user.username)}` : ""}`
          ),
    [sessionId, user?.username]
  )

  const coAuthorCount = roster.filter((c) => c.id !== user?.id).length

  const handleCopyInviteLink = useCallback(async () => {
    if (coAuthorCount >= MAX_CO_AUTHORS) {
      toast({
        title: "Room full",
        description: `A Co-Loop takes ${MAX_CO_AUTHORS} invited co-authors plus the host.`,
        variant: "destructive",
      })
      return
    }
    const result = await shareContent({
      url: inviteUrl,
      title: "Join my Co-Loop session",
      text: `Write with @${user?.username || "me"} on Loop`,
    })
    if (result === "aborted") return
    if (result === "failed") {
      toast({ title: "Couldn't share", description: "Copy the link from the address bar instead.", variant: "destructive" })
      return
    }
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2500)
    toast({
      title: result === "shared" ? "Invite shared" : "Join link copied",
      description: "Anyone with the link can write in this room.",
    })
  }, [coAuthorCount, inviteUrl, toast, user?.username])

  useEffect(() => {
    const query = inviteQuery.trim().replace(/^@/, "")
    if (!query) {
      setInviteResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingInvite(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=users&limit=6`)
        if (res.ok) {
          const data = await res.json()
          setInviteResults(data.users || [])
        }
      } finally {
        setSearchingInvite(false)
      }
    }, 220)
    return () => clearTimeout(timer)
  }, [inviteQuery])

  const handleSendInvite = useCallback(
    async (target: any) => {
      if (coAuthorCount >= MAX_CO_AUTHORS) {
        toast({ title: "Room full", variant: "destructive" })
        return
      }
      setSendingInvite(true)
      try {
        const res = await fetch("/api/co-loop/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({
            session_id: sessionId,
            session_title: doc.title || "New collaborative Loop",
            invitee_id: target.id,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not send that invite")
        toast({ title: "Invitation sent", description: `@${target.username} got a DM and a notification.`, variant: "success", icon: UserPlus })
        void recordActivity("invite_sent", `@${target.username}`)
        setInviteQuery("")
        setInviteResults([])
        setInviteOpen(false)
      } catch (err: any) {
        toast({ title: "Invite failed", description: err?.message || "Try again.", variant: "destructive" })
      } finally {
        setSendingInvite(false)
      }
    },
    [coAuthorCount, doc.title, getAuthHeader, recordActivity, sessionId, toast]
  )

  // Arriving through an invite link auto-accepts the invitation.
  useEffect(() => {
    if (!user || !sessionReady || searchParams.get("invited") !== "true") return
    const accept = async () => {
      try {
        await fetch("/api/co-loop/invitation", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ sessionId, status: "accepted" }),
        })
        toast({ title: "You're in", description: "You joined this Co-Loop as a co-author." })
      } catch {
        /* the roster refreshes on the next session resolve */
      }
    }
    void accept()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionReady, searchParams, sessionId])

  /* ── Split gift ───────────────────────────────────────────────── */
  const handleSendGift = useCallback(
    async (amount: number) => {
      const recipients = roster.filter((c) => c.id !== user?.id)
      if (recipients.length === 0) {
        toast({ title: "No co-authors yet", description: "Invite someone before splitting a gift.", variant: "destructive" })
        return
      }
      setSendingGift(true)
      try {
        const res = await fetch("/api/co-loop/gift", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ session_id: sessionId, gift_amount: amount, recipients: recipients.map((c) => c.id) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not send the gift")
        realtime.announceGift({
          senderName: user?.display_name || user?.username || "A supporter",
          amount,
          splitAmount: data.split_amount || Math.floor(amount / recipients.length),
        })
        toast({ title: "Gift sent", description: `${amount} coins split across ${recipients.length} co-author(s).`, variant: "success", icon: Coins })
        void recordActivity("gifted", `${amount} coins across ${recipients.length} co-author${recipients.length === 1 ? "" : "s"}`)
        setGiftOpen(false)
      } catch (err: any) {
        toast({ title: "Gift failed", description: err?.message || "Try again.", variant: "destructive" })
      } finally {
        setSendingGift(false)
      }
    },
    [getAuthHeader, recordActivity, realtime, roster, sessionId, toast, user]
  )

  /* ── Publish ──────────────────────────────────────────────────── */
  const handlePublish = useCallback(async () => {
    if (!doc.content.trim() && !doc.title.trim()) {
      toast({ title: "Nothing to publish", description: "Write something first.", variant: "destructive" })
      return
    }
    setPublishing(true)
    try {
      flushField("title")
      flushField("content")

      const coAuthorsMetadata = roster
        .filter((c) => c.id !== user?.id)
        .map((c) => ({
          id: c.id,
          username: c.username,
          display_name: c.display_name,
          avatar_url: c.avatar_url,
          role: c.role || "Co-Author",
        }))

      const res = await fetch("/api/loops", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content: doc.content,
          content_title: doc.title || null,
          media_url: doc.mediaUrls[0] || doc.mediaUrl || null,
          media_urls: doc.mediaUrls,
          media_type: doc.mediaType,
          hashtags: doc.hashtags,
          is_co_loop: true,
          co_authors: coAuthorsMetadata,
          content_metadata: {
            is_co_loop: true,
            co_authors: coAuthorsMetadata,
            studio_session_id: sessionId,
            media_urls: doc.mediaUrls,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not publish this Co-Loop")

      realtime.announcePublished(user?.display_name || user?.username || "A collaborator")
      void recordActivity("published", doc.title || "Untitled draft")

      try {
        await fetch("/api/co-loop/session-info", {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({
            session_id: sessionId,
            status: "published",
            published_loop_id: data.loop?.id,
          }),
        })
      } catch {
        /* best effort */
      }

      // Close out the open-invite card in the feed, if this room had one.
      try {
        const infoRes = await fetch(`/api/co-loop/session-info?session_id=${encodeURIComponent(sessionId)}`, {
          headers: getAuthHeader(),
        })
        const info = await infoRes.json()
        const feedPostId = info?.session?.feed_post_id
        if (feedPostId) {
          const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser")
          await getSupabaseBrowserClient()
            .from("loops")
            .update({
              content_metadata: {
                is_open_coloop_invite: true,
                session_id: sessionId,
                max_collaborators: info?.session?.max_collaborators || 4,
                topic: info?.session?.open_invite_topic || "",
                current_participants: roster.length + 1,
                status: "published",
              },
            })
            .eq("id", feedPostId)
        }
      } catch {
        /* best effort */
      }

      setPublishedAuthors(roster.length + 1)
      setCeremonyOpen(true)
    } catch (err: any) {
      toast({ title: "Publish failed", description: err?.message || "Try again.", variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }, [doc, flushField, getAuthHeader, realtime, roster, sessionId, toast, user])

  /* ── Open invite + end session ────────────────────────────────── */
  const handlePublishOpenInvite = useCallback(async () => {
    if (!isOwner || !openInviteTopic.trim()) return
    setPublishingOpenInvite(true)
    try {
      const res = await fetch("/api/co-loop/open-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: sessionId, topic: openInviteTopic.trim(), max_collaborators: openInviteMax }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not publish the open invite")
      toast({ title: "Open invite is live", description: "Anyone can now join this room from the feed.", variant: "success", icon: Globe })
      setOpenInviteOpen(false)
      setOpenInviteTopic("")
    } catch (err: any) {
      toast({ title: "Failed to publish", description: err?.message || "Try again.", variant: "destructive" })
    } finally {
      setPublishingOpenInvite(false)
    }
  }, [getAuthHeader, isOwner, openInviteMax, openInviteTopic, sessionId, toast])

  const handleEndSession = useCallback(() => {
    if (!isOwner) return
    realtime.announceSessionEnded(user?.display_name || user?.username || "The Primary Creator")
    toast({ title: "Session ended", description: "Everyone has been sent back to the feed." })
    setTimeout(() => router.push("/"), 900)
  }, [isOwner, realtime, router, toast, user])

  /* ── Host room controls: lock / delete ────────────────────────── */
  const handleToggleLock = useCallback(async () => {
    if (!isOwner) return
    const next = !locked
    setLocked(next)
    try {
      const res = await fetch("/api/co-loop/room-control", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: sessionId, action: next ? "lock" : "unlock" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not change the lock")
      const name = user?.display_name || user?.username || "The host"
      realtime.announceRoomLock(next, name)
      void recordActivity(
        next ? "locked" : "unlocked",
        next ? "Only the host can edit now" : "Editing is open to everyone"
      )
      toast({
        title: next ? "Room locked" : "Room unlocked",
        description: next ? "Everyone can still read — only you can edit." : "Co-authors can write again.",
        variant: "success",
        icon: next ? Lock : Unlock,
      })
    } catch (err: any) {
      setLocked(!next)
      toast({ title: "Could not change the lock", description: err?.message || "Try again.", variant: "destructive" })
    }
  }, [getAuthHeader, isOwner, locked, realtime, recordActivity, sessionId, toast, user])

  const handleDeleteRoom = useCallback(async () => {
    if (!isOwner) return
    const confirmed = await confirmDialog({
      title: "Delete this room?",
      description:
        "The studio session is retired for everyone: the shared draft, versions and room history stop being reachable. Anything you already published stays on the feed.",
      confirmLabel: "Delete room",
      destructive: true,
    })
    if (!confirmed) return
    try {
      const res = await fetch("/api/co-loop/room-control", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ session_id: sessionId, action: "delete" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not delete this room")
      realtime.announceRoomDeleted(user?.display_name || user?.username || "The host")
      toast({ title: "Room deleted", description: "Your published Co-Loop stays on the feed.", variant: "success" })
      setTimeout(() => router.push("/"), 900)
    } catch (err: any) {
      toast({ title: "Could not delete the room", description: err?.message || "Try again.", variant: "destructive" })
    }
  }, [getAuthHeader, isOwner, realtime, router, sessionId, toast, user])

  /* ── ⌘/Ctrl+S snapshots the draft ─────────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        void handleSaveSnapshot()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleSaveSnapshot])

  /* ── Derived ──────────────────────────────────────────────────── */
  const liveParticipants = useMemo(() => {
    const map = new Map<string, StudioParticipant>()
    for (const participant of realtime.participants) map.set(participant.id, participant)
    if (owner?.id && !map.has(owner.id)) {
      map.set(owner.id, {
        id: owner.id,
        username: owner.username || "creator",
        display_name: owner.display_name || owner.username || "Primary Creator",
        avatar_url: owner.avatar_url ?? null,
        role: "Primary Creator",
        color: colorForParticipant(owner.id),
      })
    }
    if (user && !map.has(user.id)) {
      map.set(user.id, {
        id: user.id,
        username: user.username || "creator",
        display_name: user.display_name || user.username || "You",
        avatar_url: (user as any).avatar_url ?? null,
        video_avatar_url: (user as any).video_avatar_url ?? null,
        is_premium: user.is_premium,
        role: isOwner ? "Primary Creator" : "Co-Author",
        color: colorForParticipant(user.id),
      })
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.role === "Primary Creator") return -1
      if (b.role === "Primary Creator") return 1
      return a.display_name.localeCompare(b.display_name)
    })
  }, [realtime.participants, owner, user, isOwner])

  const editingFields = useMemo(() => {
    const title: StudioParticipant[] = []
    const content: StudioParticipant[] = []
    for (const participant of liveParticipants) {
      if (participant.id === user?.id) continue
      if (participant.editing === "title") title.push(participant)
      else if (participant.editing === "content") content.push(participant)
    }
    return { title, content }
  }, [liveParticipants, user?.id])

  const handleSendChat = useCallback(
    (text: string) => {
      if (!user) return
      const message: StudioChatMessage = {
        id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender_id: user.id,
        sender_name: user.display_name || user.username || "Collaborator",
        sender_avatar: (user as any).avatar_url ?? null,
        sender_video_avatar_url: (user as any).video_avatar_url ?? null,
        sender_is_premium: user.is_premium,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now(),
      }
      realtime.sendChat(message)
    },
    [realtime, user]
  )

  const openActivity = useCallback(() => {
    setActivityOpen(true)
    realtime.clearUnread()
  }, [realtime])

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md p-6 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-primary" />
          <h2 className="text-lg font-semibold">Sign in to use the Studio</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The Co-Loop Studio is a live writing room. Sign in to collaborate in real time.
          </p>
          <Button className="mt-4" onClick={() => router.push("/auth?returnTo=/co-loop/studio")}>
            Sign in
          </Button>
        </Card>
      </div>
    )
  }

  const rail = (
    <CoLoopActivityRail
      participants={liveParticipants}
      selfId={user.id}
      chatMessages={realtime.chatMessages}
      onSendChat={handleSendChat}
      onInvite={() => {
        setActivityOpen(false)
        setInviteOpen(true)
      }}
      onCopyLink={() => void handleCopyInviteLink()}
      linkCopied={linkCopied}
      coAuthorCount={coAuthorCount}
      activity={activityFeed}
      activityLoading={activityLoading}
    />
  )

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 px-3 pb-8 pt-4 sm:px-5">
      <StudioCommandBar
        sessionId={sessionId}
        isOwner={isOwner}
        ownerUsername={owner?.username}
        connection={realtime.connection}
        participants={liveParticipants}
        versionCount={versions.length}
        unreadCount={realtime.unreadCount}
        linkCopied={linkCopied}
        locked={locked}
        onOpenHistory={() => setHistoryOpen(true)}
        onOpenActivity={openActivity}
        onOpenGift={() => setGiftOpen(true)}
        onOpenInvite={() => setInviteOpen(true)}
        onCopyLink={() => void handleCopyInviteLink()}
        onRequestSync={() => realtime.requestSync()}
        onOpenOpenInvite={() => {
          setOpenInviteTopic(doc.title || doc.content.slice(0, 120))
          setOpenInviteOpen(true)
        }}
        onToggleLock={() => void handleToggleLock()}
        onDeleteRoom={() => void handleDeleteRoom()}
        onEndSession={handleEndSession}
        onLeave={() => router.push("/")}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <CoLoopCanvas
            title={doc.title}
            content={doc.content}
            onTitleChange={handleTitleChange}
            onContentChange={handleContentChange}
            onFieldFocus={handleFieldFocus}
            onCursorMove={handleCursorMove}
            cursors={realtime.cursors}
            remoteEdit={remoteEdit}
            editingTitle={editingFields.title}
            editingContent={editingFields.content}
            hashtags={doc.hashtags}
            onAddHashtag={handleAddHashtag}
            onRemoveHashtag={handleRemoveHashtag}
            mediaUrls={doc.mediaUrls}
            mediaType={doc.mediaType}
            uploadingMedia={uploadingMedia}
            isPro={Boolean(user.is_premium)}
            onUploadFiles={handleUploadFiles}
            onRemoveMedia={handleRemoveMedia}
            onAddMediaUrl={handleAddMediaUrl}
            disabled={publishing || (locked && !isOwner)}
          />

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {liveParticipants.length} in the room
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" />
                {coAuthorCount} co-author{coAuthorCount === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                {savedAt
                  ? `Draft saved ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Draft autosaves"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={savingVersion}
                onClick={() => void handleSaveSnapshot()}
                className="gap-1.5"
              >
                {savingVersion ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                Save version
              </Button>
              <Button disabled={publishing} onClick={() => void handlePublish()} className="gap-1.5">
                {publishing ? <Spinner className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
                {publishing ? "Publishing…" : "Publish Co-Loop"}
              </Button>
            </div>
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-4 h-[calc(100vh-8rem)]">{rail}</div>
        </aside>
      </div>

      {/* Mobile room sheet */}
      <Sheet
        open={activityOpen}
        onOpenChange={(open) => {
          setActivityOpen(open)
          if (open) realtime.clearUnread()
        }}
      >
        <SheetContent side="right" className="w-full p-3 sm:max-w-sm">
          <SheetHeader className="sr-only">
            <SheetTitle>Studio room</SheetTitle>
            <SheetDescription>Live participants and chat</SheetDescription>
          </SheetHeader>
          <div className="h-[calc(100vh-2rem)]">{rail}</div>
        </SheetContent>
      </Sheet>

      <CoLoopVersionHistory
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        loading={versionsLoading}
        versions={versions}
        currentDraft={{
          title: doc.title,
          content: doc.content,
          hashtags: doc.hashtags,
          mediaUrl: doc.mediaUrl,
          mediaUrls: doc.mediaUrls,
          mediaType: doc.mediaType,
          coAuthors: roster,
        }}
        onSaveSnapshot={(label) => void handleSaveSnapshot(label)}
        onRestoreVersion={handleRestoreVersion}
      />

      <StudioDialogs
        invite={{
          open: inviteOpen,
          onOpenChange: setInviteOpen,
          url: inviteUrl,
          linkCopied,
          onCopyLink: () => void handleCopyInviteLink(),
          query: inviteQuery,
          onQueryChange: setInviteQuery,
          results: inviteResults,
          searching: searchingInvite,
          sending: sendingInvite,
          onSend: (target) => void handleSendInvite(target),
        }}
        gift={{
          open: giftOpen,
          onOpenChange: setGiftOpen,
          coAuthorCount,
          sending: sendingGift,
          onSend: (amount) => void handleSendGift(amount),
        }}
        openInvite={{
          open: openInviteOpen,
          onOpenChange: setOpenInviteOpen,
          topic: openInviteTopic,
          onTopicChange: setOpenInviteTopic,
          max: openInviteMax,
          onMaxChange: setOpenInviteMax,
          publishing: publishingOpenInvite,
          onPublish: () => void handlePublishOpenInvite(),
        }}
        ceremony={{
          open: ceremonyOpen,
          onOpenChange: setCeremonyOpen,
          title: doc.title || "Co-Loop collaboration",
          authors: publishedAuthors,
          self: user,
          roster: roster.filter((c) => c.id !== user.id),
          onViewFeed: () => {
            setCeremonyOpen(false)
            router.push("/")
          },
          onStartNew: () => {
            setCeremonyOpen(false)
            router.push("/co-loop/studio")
          },
        }}
      />
    </div>
  )
}

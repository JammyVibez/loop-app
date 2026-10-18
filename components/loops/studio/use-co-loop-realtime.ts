"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { CoEditSession, hashText, isTextOpList, type TextOp } from "@/lib/co-loop-text"
import {
  colorForParticipant,
  type StudioActivityEntry,
  type StudioChatMessage,
  type StudioConnectionState,
  type StudioCursor,
  type StudioField,
  type StudioParticipant,
  type StudioMetaPatch,
  type StudioRole,
  type StudioRoomEvent,
} from "./studio-types"

const STUDIO_FIELDS: StudioField[] = ["title", "content"]
/** Coalesce a burst of keystrokes into one tiny op message (~12 msg/s while typing flat out). */
const EDIT_FLUSH_MS = 80
/** How often the room cross-checks that every participant has the same text. */
const RECONCILE_MS = 2500
const MAX_CHAT_MESSAGES = 200
const MAX_OUTBOX = 120
const CHAT_BACKLOG = 40
/** Caret positions coalesce to ~10 moves/s — enough to look live, cheap to send. */
const CURSOR_THROTTLE_MS = 100
/** A caret nobody has moved for this long is gone (they alt-tabbed, etc.). */
const CURSOR_TTL_MS = 8000

export interface CoLoopRealtimeSelf {
  id: string
  username?: string
  display_name?: string
  avatar_url?: string | null
  video_avatar_url?: string | null
  is_premium?: boolean
}

interface UseCoLoopRealtimeOptions {
  sessionId: string
  enabled: boolean
  self: CoLoopRealtimeSelf | null
  isOwner: boolean
  role: StudioRole
  /** The app's auth header — chat history and sends go through the API. */
  getAuthHeader: () => Record<string, string>
  /** A peer's ops were applied; adopt the resulting text. */
  onRemoteText: (field: StudioField, text: string, appliedOps: TextOp[]) => void
  /** A peer published an authoritative snapshot that should replace local text. */
  onAdoptSnapshot: (field: StudioField, text: string) => void
  /** A peer changed discrete document fields (hashtags, media, co-authors). */
  onMeta: (patch: StudioMetaPatch) => void
  onRoomEvent: (event: StudioRoomEvent) => void
}

export interface CoLoopRealtimeApi {
  connection: StudioConnectionState
  participants: StudioParticipant[]
  chatMessages: StudioChatMessage[]
  unreadCount: number
  /** Seed the co-edit engine with text loaded from the server. */
  seedField: (field: StudioField, text: string) => void
  /** Publish a local keystroke burst (coalesced). */
  publishField: (field: StudioField, text: string) => void
  /** Force-flush pending text so the room is never behind. */
  flushField: (field: StudioField) => void
  /** Advertise which field this participant is typing in (live presence). */
  focusField: (field: StudioField | null) => void
  /** Everyone else's live caret positions, for rendering in the editor. */
  cursors: StudioCursor[]
  /** Tell the room where this participant's caret sits (null = blurred). */
  publishCursor: (field: StudioField | null, offset: number) => void
  /** Ask the room for the current document (late join / reconnect). */
  requestSync: () => void
  /** Replace a field with authoritative text (e.g. after restoring a version). */
  publishSnapshot: (field: StudioField, text: string) => void
  /** Publish discrete document fields to the room (last-writer-wins). */
  announceMeta: (patch: StudioMetaPatch) => void
  /** Store a chat message in the room and fan it out to everyone. */
  sendChat: (text: string) => void
  /** Toggle an emoji reaction on a stored chat message. */
  reactToChat: (messageId: string, emoji: string) => void
  clearUnread: () => void
  announceVersionSaved: (version: unknown) => void
  announceVersionRestored: (version: unknown, by: string) => void
  announceGift: (payload: { senderName: string; amount: number; splitAmount: number }) => void
  announceSessionEnded: (by: string) => void
  announcePublished: (by: string) => void
  /** Push a new activity-feed entry to everyone in the room. */
  announceActivity: (entry: StudioActivityEntry) => void
  /** Host locked/unlocked the draft for non-hosts. */
  announceRoomLock: (locked: boolean, by: string) => void
  /** Host retired the room (usually right after publishing). */
  announceRoomDeleted: (by: string) => void
}

export function useCoLoopRealtime({
  sessionId,
  enabled,
  self,
  isOwner,
  role,
  getAuthHeader,
  onRemoteText,
  onAdoptSnapshot,
  onMeta,
  onRoomEvent,
}: UseCoLoopRealtimeOptions): CoLoopRealtimeApi {
  const [connection, setConnection] = useState<StudioConnectionState>("connecting")
  const [participants, setParticipants] = useState<StudioParticipant[]>([])
  const [chatMessages, setChatMessages] = useState<StudioChatMessage[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [cursors, setCursors] = useState<StudioCursor[]>([])
  const cursorThrottleRef = useRef<{
    last: number
    timer: ReturnType<typeof setTimeout> | null
    pending: { field: StudioField; offset: number } | null
  }>({ last: 0, timer: null, pending: null })

  const selfId = self?.id || ""

  // The co-edit session is keyed by participant id: `auth` briefly renders
  // without a user, so it must not be created with a placeholder id (that
  // would break self-message filtering and the same-position tie-break).
  const sessionRef = useRef<{ id: string; session: CoEditSession } | null>(null)
  if (!sessionRef.current || sessionRef.current.id !== selfId) {
    sessionRef.current = { id: selfId, session: new CoEditSession(selfId || "anonymous") }
  }
  const editSession = () => sessionRef.current!.session
  const joinedAtRef = useRef(Date.now())

  const channelRef = useRef<any>(null)
  const connectionRef = useRef<StudioConnectionState>("connecting")
  const callbacksRef = useRef({ onRemoteText, onAdoptSnapshot, onMeta, onRoomEvent })
  const chatRef = useRef<StudioChatMessage[]>([])
  const outboxRef = useRef<Array<{ field: StudioField; ops: TextOp[]; rev: number; seen: Record<string, number> }>>([])
  const flushTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const syncTimersRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({})
  const syncChatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editingRef = useRef<StudioField | null>(null)
  const participantsRef = useRef<StudioParticipant[]>([])
  const lastEditAtRef = useRef(0)
  const hasJoinedRef = useRef(false)

  // The co-edit session is the single source of truth for text; React state in
  // the canvas only mirrors it. Reading text from the session (rather than from
  // mirrored state) keeps sync answers and reconciliation race-free.
  useEffect(() => {
    callbacksRef.current = { onRemoteText, onAdoptSnapshot, onMeta, onRoomEvent }
  }, [onRemoteText, onAdoptSnapshot, onMeta, onRoomEvent])

  useEffect(() => {
    connectionRef.current = connection
  }, [connection])

  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  useEffect(() => {
    chatRef.current = chatMessages
  }, [chatMessages])

  const readText = useCallback((field: StudioField) => editSession().getText(field), [])

  const trackPresence = useCallback(() => {
    const channel = channelRef.current
    if (!channel || !self?.id) return
    const payload: StudioParticipant = {
      id: self.id,
      username: self.username || "creator",
      display_name: self.display_name || self.username || "Creator",
      avatar_url: self.avatar_url ?? null,
      video_avatar_url: self.video_avatar_url ?? null,
      is_premium: Boolean(self.is_premium),
      role: isOwner ? "Primary Creator" : role,
      editing: editingRef.current,
      // Stable for the whole session — re-stamping this on every focus change
      // would reshuffle the deterministic sync-answer order.
      joinedAt: joinedAtRef.current,
      color: colorForParticipant(self.id),
    }
    void channel.track(payload)
  }, [self, isOwner, role])

  const send = useCallback((event: string, payload: Record<string, unknown>) => {
    const channel = channelRef.current
    if (!channel || connectionRef.current !== "live") return false
    try {
      void channel.send({ type: "broadcast", event, payload })
      return true
    } catch {
      return false
    }
  }, [])

  const currentHashes = useCallback(
    (): Record<string, number> => ({
      title: hashText(readText("title")),
      content: hashText(readText("content")),
    }),
    [readText]
  )

  /** Flush one field's pending keystrokes as a single op message. */
  const flushField = useCallback(
    (field: StudioField) => {
      const session = editSession()
      if (!selfId || !session) return
      const timer = flushTimersRef.current[field]
      if (timer) {
        clearTimeout(timer)
        flushTimersRef.current[field] = null
      }
      const message = session.localEdit(field)
      if (!message) return
      lastEditAtRef.current = Date.now()
      if (!send("edit-ops", message as unknown as Record<string, unknown>)) {
        outboxRef.current.push({
          field: message.field as StudioField,
          ops: message.ops,
          rev: message.rev,
          seen: message.seen,
        })
        if (outboxRef.current.length > MAX_OUTBOX) {
          outboxRef.current.splice(0, outboxRef.current.length - MAX_OUTBOX)
        }
      }
    },
    [selfId, send]
  )

  const flushOutbox = useCallback(() => {
    if (!selfId || outboxRef.current.length === 0) return
    const queue = outboxRef.current
    outboxRef.current = []
    for (const item of queue) send("edit-ops", { ...item, from: selfId })
  }, [selfId, send])

  const publishField = useCallback(
    (field: StudioField, text: string) => {
      const session = editSession()
      if (!session) return
      session.setLocalText(field, text)
      lastEditAtRef.current = Date.now()
      if (flushTimersRef.current[field]) return
      flushTimersRef.current[field] = setTimeout(() => {
        flushTimersRef.current[field] = null
        flushField(field)
      }, EDIT_FLUSH_MS)
    },
    [flushField]
  )

  /**
   * Room chat is stored server-side, so a late joiner, a reload, or a second
   * device sees everything that was said before they connected. Merged by id
   * so the live broadcast and this fetch cannot duplicate a bubble.
   */
  const loadChatHistory = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/co-loop/chat?session_id=${encodeURIComponent(sessionId)}`, {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      if (!res.ok) return
      const data = await res.json()
      const incoming = Array.isArray(data?.messages) ? (data.messages as StudioChatMessage[]) : []
      if (!incoming.length) return
      setChatMessages((prev) => {
        const map = new Map(prev.filter((m) => !m.pending).map((m) => [m.id, m]))
        incoming.forEach((m) => {
          if (m?.id) map.set(m.id, { ...map.get(m.id), ...m })
        })
        return Array.from(map.values())
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
          .slice(-MAX_CHAT_MESSAGES)
      })
    } catch {
      /* chat history is best-effort — live broadcast still works */
    }
  }, [getAuthHeader, sessionId])

  const sendChatBacklog = useCallback(
    (delayMs: number) => {
      if (syncChatTimerRef.current) return
      syncChatTimerRef.current = setTimeout(() => {
        syncChatTimerRef.current = null
        const backlog = chatRef.current.slice(-CHAT_BACKLOG)
        if (backlog.length === 0) return
        send("chat-sync", { from: selfId, messages: backlog })
      }, delayMs)
    },
    [send, selfId]
  )

  /**
   * Answer a late joiner with our text. Every peer with content schedules an
   * answer, staggered by join order, so the earliest participant replies first
   * and the rest stand down when its snapshot lands.
   */
  const scheduleSyncAnswer = useCallback(() => {
    if (!selfId) return
    STUDIO_FIELDS.forEach((field) => {
      if (!readText(field)) return
      if (syncTimersRef.current[field]) return
      const ordered = [...participantsRef.current].sort(
        (a, b) => (a.joinedAt || 0) - (b.joinedAt || 0) || a.id.localeCompare(b.id)
      )
      const index = ordered.findIndex((p) => p.id === selfId)
      const rank = index < 0 ? ordered.length : index
      syncTimersRef.current[field] = setTimeout(() => {
        syncTimersRef.current[field] = null
        send("doc-snapshot", { field, text: readText(field), from: selfId, reason: "join" })
      }, 60 + rank * 180)
    })
    sendChatBacklog(120)
  }, [readText, selfId, send, sendChatBacklog])

  const clearSyncAnswers = useCallback(() => {
    STUDIO_FIELDS.forEach((field) => {
      const timer = syncTimersRef.current[field]
      if (timer) {
        clearTimeout(timer)
        syncTimersRef.current[field] = null
      }
    })
    if (syncChatTimerRef.current) {
      clearTimeout(syncChatTimerRef.current)
      syncChatTimerRef.current = null
    }
  }, [])

  const requestSync = useCallback(() => {
    send("request-doc-sync", { from: selfId, at: Date.now() })
  }, [send, selfId])

  const announceMeta = useCallback(
    (patch: StudioMetaPatch) => send("doc-meta", { ...patch, from: selfId }),
    [send, selfId]
  )

  const publishSnapshot = useCallback(
    (field: StudioField, text: string) => {
      editSession().reset(field, text)
      lastEditAtRef.current = Date.now()
      send("doc-snapshot", { field, text, from: selfId, reason: "restore" })
    },
    [send, selfId]
  )

  const broadcastSnapshot = useCallback(
    (field: StudioField) => {
      send("doc-snapshot", { field, text: readText(field), from: selfId, reason: "reconcile" })
    },
    [send, selfId, readText]
  )

  /* ------------------------------------------------------------------ *
   * Realtime channel
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!enabled || !selfId) {
      if (!enabled) setConnection("offline")
      return
    }

    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const channel = supabase.channel(`co-loop-studio:${sessionId}`, {
      config: { presence: { key: selfId } },
    })
    channelRef.current = channel
    setConnection("connecting")

    channel
      .on("presence", { event: "sync" }, () => {
        const state = (channel.presenceState() || {}) as Record<string, any[]>
        const live: StudioParticipant[] = []
        Object.keys(state).forEach((key) => {
          if (state[key]?.[0]) live.push(state[key][0] as StudioParticipant)
        })
        setParticipants(live)
        // Someone who vanished from presence must not leave a ghost caret.
        const liveIds = new Set(live.map((p) => p.id))
        setCursors((prev) => {
          const kept = prev.filter((c) => liveIds.has(c.id))
          return kept.length === prev.length ? prev : kept
        })
      })
      // Supabase batches presences: a reconnect or a second joiner arrives in
      // the SAME payload. Reading only [0] dropped everyone after the first,
      // which is why a host could watch someone appear only after a later
      // event (e.g. publishing) re-synced the room. Walk the whole array.
      .on("presence", { event: "join" }, ({ newPresences }: any) => {
        const joined = (Array.isArray(newPresences) ? newPresences : []) as StudioParticipant[]
        for (const participant of joined) {
          if (participant?.id && participant.id !== selfId) {
            callbacksRef.current.onRoomEvent({ type: "joined", participant })
          }
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: any) => {
        const left = (Array.isArray(leftPresences) ? leftPresences : []) as StudioParticipant[]
        const leftIds = new Set(left.map((p) => p?.id).filter(Boolean))
        if (!leftIds.size) return
        setCursors((prev) => prev.filter((c) => !leftIds.has(c.id)))
        for (const participant of left) {
          if (participant?.id && participant.id !== selfId) {
            callbacksRef.current.onRoomEvent({ type: "left", participant })
          }
        }
      })
      // ── live co-editing ────────────────────────────────────────────
      .on("broadcast", { event: "edit-ops" }, ({ payload }: any) => {
        const session = editSession()
        if (!session || !payload?.field || !STUDIO_FIELDS.includes(payload.field)) return
        const result = session.receive({
          field: payload.field,
          ops: isTextOpList(payload.ops) ? payload.ops : [],
          from: String(payload.from || ""),
          rev: Number(payload.rev || 0),
          seen: payload.seen,
        })
        if (result) callbacksRef.current.onRemoteText(result.field as StudioField, result.text, result.appliedOps)
      })
      .on("broadcast", { event: "doc-snapshot" }, ({ payload }: any) => {
        const session = editSession()
        const field = payload?.field as StudioField
        if (!session || !field || !STUDIO_FIELDS.includes(field)) return
        if (payload?.from === selfId) return
        if (typeof payload.text !== "string") return

        // Another peer already answered — stand down.
        const timer = syncTimersRef.current[field]
        if (timer) {
          clearTimeout(timer)
          syncTimersRef.current[field] = null
        }

        const adopted = session.applyAuthoritative(field, payload.text)
        if (adopted) {
          callbacksRef.current.onAdoptSnapshot(field, payload.text)
        } else {
          // We are mid-type: keep our text and republish it on top of theirs.
          flushField(field)
        }
      })
      .on("broadcast", { event: "request-doc-sync" }, ({ payload }: any) => {
        if (payload?.from === selfId) return
        scheduleSyncAnswer()
      })
      // ── drift detection & reconciliation ───────────────────────────
      .on("broadcast", { event: "doc-hash" }, ({ payload }: any) => {
        if (payload?.from === selfId) return
        const theirFields = payload?.fields || {}
        const myLastEdit = lastEditAtRef.current
        const theirLastEdit = Number(payload?.lastEditAt || 0)
        // The most recent editor owns the truth for the fields that differ.
        const iAmNewer = myLastEdit > theirLastEdit || (myLastEdit === theirLastEdit && selfId < String(payload.from))
        if (!iAmNewer) return
        STUDIO_FIELDS.forEach((field) => {
          const theirs = Number(theirFields[field])
          if (Number.isFinite(theirs) && theirs !== hashText(readText(field))) broadcastSnapshot(field)
        })
      })
      // ── editing presence ───────────────────────────────────────────
      .on("broadcast", { event: "typing" }, ({ payload }: any) => {
        if (!payload?.from || payload.from === selfId) return
        setParticipants((prev) =>
          prev.map((p) => (p.id === payload.from ? { ...p, editing: payload.field ?? null } : p))
        )
        // Left the field entirely — their caret leaves with them.
        if (!payload.field) setCursors((prev) => prev.filter((c) => c.id !== payload.from))
      })
      // ── live caret positions ─────────────────────────────────────
      .on("broadcast", { event: "cursor" }, ({ payload }: any) => {
        if (!payload?.from || payload.from === selfId) return
        if (!payload.field) {
          setCursors((prev) => prev.filter((c) => c.id !== payload.from))
          return
        }
        if (!STUDIO_FIELDS.includes(payload.field)) return
        const next: StudioCursor = {
          id: String(payload.from),
          name: String(payload.name || "Collaborator").slice(0, 40),
          color: String(payload.color || "#0ea5e9"),
          field: payload.field as StudioField,
          offset: Math.max(0, Number(payload.offset) || 0),
          at: Date.now(),
        }
        setCursors((prev) => [...prev.filter((c) => c.id !== next.id), next])
      })
      // ── discrete fields (hashtags / media / co-authors) ────────────
      .on("broadcast", { event: "doc-meta" }, ({ payload }: any) => {
        if (!payload || payload.from === selfId) return
        const { from: _from, ...patch } = payload
        callbacksRef.current.onMeta(patch as StudioMetaPatch)
      })
      // ── in-studio chat ─────────────────────────────────────────────
      .on("broadcast", { event: "chat-msg" }, ({ payload }: any) => {
        const message = payload as StudioChatMessage
        if (!message?.id) return
        setChatMessages((prev) => {
          const existing = prev.find((m) => m.id === message.id)
          if (existing) {
            return prev.map((m) => (m.id === message.id ? { ...m, ...message, pending: false } : m))
          }
          // A peer re-sent a message this client already rendered optimistically
          // under a temporary id — replace it instead of showing it twice.
          return [...prev, message].slice(-MAX_CHAT_MESSAGES)
        })
        if (message.sender_id !== selfId) setUnreadCount((prev) => prev + 1)
      })
      .on("broadcast", { event: "chat-reaction" }, ({ payload }: any) => {
        if (!payload?.message_id || !payload?.reactions) return
        if (payload.user_id === selfId) return
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === payload.message_id
              ? { ...m, reactions: payload.reactions as Record<string, string[]> }
              : m,
          ),
        )
      })
      .on("broadcast", { event: "chat-sync" }, ({ payload }: any) => {
        const incoming = Array.isArray(payload?.messages) ? (payload.messages as StudioChatMessage[]) : []
        if (incoming.length === 0) return
        setChatMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]))
          incoming.forEach((m) => {
            if (m?.id) map.set(m.id, m)
          })
          return Array.from(map.values())
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
            .slice(-MAX_CHAT_MESSAGES)
        })
      })
      // ── room lifecycle + version history events ───────────────────
      .on("broadcast", { event: "version-saved" }, ({ payload }: any) => {
        if (payload?.savedBy?.id === selfId) return
        callbacksRef.current.onRoomEvent({ type: "version-saved", version: payload })
      })
      .on("broadcast", { event: "version-restored" }, ({ payload }: any) => {
        callbacksRef.current.onRoomEvent({
          type: "version-restored",
          version: payload?.version,
          by: payload?.restoredBy || "A collaborator",
        })
      })
      .on("broadcast", { event: "co-loop-gift" }, ({ payload }: any) => {
        if (!payload) return
        callbacksRef.current.onRoomEvent({
          type: "gift",
          senderName: payload.senderName || "A supporter",
          amount: Number(payload.amount || 0),
          splitAmount: Number(payload.splitAmount || 0),
        })
      })
      .on("broadcast", { event: "session_ended" }, ({ payload }: any) => {
        callbacksRef.current.onRoomEvent({
          type: "session-ended",
          by: payload?.endedBy || "The Primary Creator",
        })
      })
      .on("broadcast", { event: "coloop_published" }, ({ payload }: any) => {
        callbacksRef.current.onRoomEvent({
          type: "published",
          by: payload?.publishedBy || "A collaborator",
        })
      })
      // ── durable roster changes (open-invite joins + host kicks) ─────
      .on("broadcast", { event: "co-author-accepted" }, ({ payload }: any) => {
        const entry = payload?.user || payload?.participant || payload?.co_author
        if (!entry?.id || entry.id === selfId) return
        callbacksRef.current.onRoomEvent({
          type: "co-author-joined",
          participant: {
            id: String(entry.id),
            username: entry.username || "collaborator",
            display_name: entry.display_name || entry.username || "Co-Author",
            avatar_url: entry.avatar_url ?? null,
            video_avatar_url: entry.video_avatar_url ?? null,
            is_premium: Boolean(entry.is_premium),
            role: entry.role || "Co-Author",
            color: colorForParticipant(String(entry.id)),
          },
        })
      })
      .on("broadcast", { event: "co-author-kicked" }, ({ payload }: any) => {
        const userId = payload?.user_id || payload?.userId || payload?.participant?.id
        if (!userId) return
        callbacksRef.current.onRoomEvent({
          type: "co-author-kicked",
          userId: String(userId),
          by: payload?.by || "The host",
          participant: payload?.participant,
        })
      })
      // ── host room controls + activity feed ────────────────────────
      .on("broadcast", { event: "room-lock" }, ({ payload }: any) => {
        callbacksRef.current.onRoomEvent({
          type: "room-lock",
          locked: Boolean(payload?.locked),
          by: payload?.by || "The host",
        })
      })
      .on("broadcast", { event: "room-deleted" }, ({ payload }: any) => {
        callbacksRef.current.onRoomEvent({
          type: "room-deleted",
          by: payload?.by || "The host",
        })
      })
      .on("broadcast", { event: "activity-new" }, ({ payload }: any) => {
        if (!payload || payload.from === selfId) return
        const entry = payload.entry as StudioActivityEntry | undefined
        if (entry?.id) callbacksRef.current.onRoomEvent({ type: "activity", entry })
      })
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          const reconnected = hasJoinedRef.current
          hasJoinedRef.current = true
          setConnection("live")
          connectionRef.current = "live"
          trackPresence()
          flushOutbox()
          // A fresh join or a reconnect needs the room's current document and
          // the chat that was written before we connected.
          requestSync()
          void loadChatHistory()
          if (reconnected) {
            send("doc-hash", {
              from: selfId,
              at: Date.now(),
              lastEditAt: lastEditAtRef.current,
              fields: currentHashes(),
            })
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection("reconnecting")
          connectionRef.current = "reconnecting"
        } else if (status === "CLOSED") {
          setConnection("offline")
          connectionRef.current = "offline"
        }
      })

    return () => {
      hasJoinedRef.current = false
      clearSyncAnswers()
      try {
        channel.unsubscribe()
      } catch {
        /* channel already torn down */
      }
      channelRef.current = null
    }
    // Callbacks are read through refs, so this effect only re-runs when the
    // session itself changes. Re-subscribing on every render used to fire
    // spurious join/leave toasts for the whole room.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, enabled, selfId])

  /* ------------------------------------------------------------------ *
   * Offline detection
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!enabled) return
    const onOffline = () => setConnection("offline")
    const onOnline = () => setConnection((prev) => (prev === "offline" ? "connecting" : prev))
    window.addEventListener("offline", onOffline)
    window.addEventListener("online", onOnline)
    return () => {
      window.removeEventListener("offline", onOffline)
      window.removeEventListener("online", onOnline)
    }
  }, [enabled])

  /* ------------------------------------------------------------------ *
   * Chat history + delivery net
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!enabled || !selfId || !sessionId) return
    void loadChatHistory()
    // A dropped socket or a sleeping tab must not hide a collaborator's
    // message: the stored chat is re-read on a slow beat as a fallback.
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return
      void loadChatHistory()
    }, 15000)
    return () => clearInterval(timer)
  }, [enabled, selfId, sessionId, loadChatHistory])

  /* ------------------------------------------------------------------ *
   * Drift reconciliation heartbeat
   * ------------------------------------------------------------------ */
  useEffect(() => {
    if (!enabled || !selfId) return
    // Jitter so the whole room does not hash in the same instant.
    const jitter = (hashText(selfId) % 900) + 200
    const timer = setInterval(() => {
      if (connectionRef.current !== "live") return
      STUDIO_FIELDS.forEach((field) => {
        if (editSession().hasPending(field)) flushField(field)
      })
      send("doc-hash", {
        from: selfId,
        at: Date.now(),
        lastEditAt: lastEditAtRef.current,
        fields: currentHashes(),
      })
    }, RECONCILE_MS + jitter)
    return () => clearInterval(timer)
  }, [enabled, selfId, send, flushField, currentHashes])

  // A caret nobody has moved for a few seconds ages out — covers the peers
  // that never send a blur (closed laptop, dropped tab).
  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      const now = Date.now()
      setCursors((prev) => {
        const kept = prev.filter((c) => now - c.at <= CURSOR_TTL_MS)
        return kept.length === prev.length ? prev : kept
      })
    }, 2500)
    return () => clearInterval(timer)
  }, [enabled])

  // Clear pending timers on unmount.
  useEffect(
    () => () => {
      Object.values(flushTimersRef.current).forEach((timer) => timer && clearTimeout(timer))
      Object.values(syncTimersRef.current).forEach((timer) => timer && clearTimeout(timer))
      if (syncChatTimerRef.current) clearTimeout(syncChatTimerRef.current)
      if (cursorThrottleRef.current.timer) clearTimeout(cursorThrottleRef.current.timer)
    },
    []
  )

  /* ------------------------------------------------------------------ *
   * Public API
   * ------------------------------------------------------------------ */
  const seedField = useCallback((field: StudioField, text: string) => {
    editSession().reset(field, text)
  }, [])

  const focusField = useCallback(
    (field: StudioField | null) => {
      if (editingRef.current === field) return
      editingRef.current = field
      trackPresence()
      send("typing", { from: selfId, field })
    },
    [send, selfId, trackPresence]
  )

  const publishCursor = useCallback(
    (field: StudioField | null, offset: number) => {
      if (!selfId) return
      const throttle = cursorThrottleRef.current
      const emit = (targetField: StudioField | null, targetOffset: number) => {
        throttle.last = Date.now()
        send("cursor", {
          from: selfId,
          field: targetField,
          offset: targetOffset,
          name: self?.display_name || self?.username || "Collaborator",
          color: colorForParticipant(selfId),
        })
      }

      // A blur is cheap and must land immediately: no caret should linger
      // on a field nobody is in.
      if (field === null) {
        if (throttle.timer) {
          clearTimeout(throttle.timer)
          throttle.timer = null
        }
        throttle.pending = null
        emit(null, 0)
        return
      }

      const elapsed = Date.now() - throttle.last
      if (elapsed >= CURSOR_THROTTLE_MS) {
        emit(field, offset)
        return
      }
      // Coalesce the rest of the burst into one trailing message so the final
      // caret position always lands without flooding the channel.
      throttle.pending = { field, offset }
      if (throttle.timer) return
      throttle.timer = setTimeout(() => {
        throttle.timer = null
        const pending = throttle.pending
        throttle.pending = null
        if (pending) emit(pending.field, pending.offset)
      }, CURSOR_THROTTLE_MS - elapsed)
    },
    [send, selfId, self]
  )

  const sendChat = useCallback(
    (text: string) => {
      const content = text.trim().slice(0, 1000)
      if (!content || !selfId || !sessionId) return
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const optimistic: StudioChatMessage = {
        id: tempId,
        sender_id: selfId,
        sender_name: self?.display_name || self?.username || "You",
        sender_avatar: self?.avatar_url ?? null,
        sender_video_avatar_url: self?.video_avatar_url ?? null,
        sender_is_premium: Boolean(self?.is_premium),
        text: content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        createdAt: Date.now(),
        reactions: {},
        pending: true,
      }
      setChatMessages((prev) => [...prev, optimistic].slice(-MAX_CHAT_MESSAGES))

      void (async () => {
        try {
          const res = await fetch("/api/co-loop/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify({ session_id: sessionId, content }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data?.error || "Could not send that message")
          const stored = data.message as StudioChatMessage
          if (!stored?.id) throw new Error("Could not send that message")
          setChatMessages((prev) => {
            const withoutTemp = prev.filter((m) => m.id !== tempId && m.id !== stored.id)
            return [...withoutTemp, stored]
              .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
              .slice(-MAX_CHAT_MESSAGES)
          })
        } catch (err: any) {
          setChatMessages((prev) => prev.filter((m) => m.id !== tempId))
          callbacksRef.current.onRoomEvent({
            type: "error",
            message: err?.message || "Could not send that message",
          })
        }
      })()
    },
    [self, selfId, sessionId, getAuthHeader]
  )

  const reactToChat = useCallback(
    (messageId: string, emoji: string) => {
      if (!messageId || !sessionId) return
      // Optimistic toggle, then adopt the server's map.
      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m
          const current = m.reactions || {}
          const reactors = current[emoji] || []
          const next = { ...current }
          if (reactors.includes(selfId)) {
            const remaining = reactors.filter((id) => id !== selfId)
            if (remaining.length) next[emoji] = remaining
            else delete next[emoji]
          } else {
            next[emoji] = [...reactors, selfId]
          }
          return { ...m, reactions: next }
        }),
      )

      void (async () => {
        try {
          const res = await fetch("/api/co-loop/chat", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...getAuthHeader() },
            body: JSON.stringify({ message_id: messageId, emoji }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data?.error || "Could not save that reaction")
          if (data?.reactions) {
            setChatMessages((prev) =>
              prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)),
            )
          }
        } catch (err: any) {
          callbacksRef.current.onRoomEvent({
            type: "error",
            message: err?.message || "Could not save that reaction",
          })
          void loadChatHistory()
        }
      })()
    },
    [getAuthHeader, loadChatHistory, selfId, sessionId]
  )

  const clearUnread = useCallback(() => setUnreadCount(0), [])

  const announceVersionSaved = useCallback(
    (version: unknown) => send("version-saved", version as Record<string, unknown>),
    [send]
  )
  const announceVersionRestored = useCallback(
    (version: unknown, by: string) => send("version-restored", { version, restoredBy: by }),
    [send]
  )
  const announceGift = useCallback(
    (payload: { senderName: string; amount: number; splitAmount: number }) => send("co-loop-gift", payload),
    [send]
  )
  const announceSessionEnded = useCallback((by: string) => send("session_ended", { endedBy: by }), [send])
  const announcePublished = useCallback((by: string) => send("coloop_published", { publishedBy: by }), [send])
  const announceActivity = useCallback(
    (entry: StudioActivityEntry) => send("activity-new", { from: selfId, entry }),
    [send, selfId]
  )
  const announceRoomLock = useCallback(
    (locked: boolean, by: string) => send("room-lock", { locked, by }),
    [send]
  )
  const announceRoomDeleted = useCallback((by: string) => send("room-deleted", { by }), [send])

  return useMemo(
    () => ({
      connection,
      participants,
      chatMessages,
      unreadCount,
      cursors,
      seedField,
      publishField,
      flushField,
      focusField,
      publishCursor,
      requestSync,
      publishSnapshot,
      announceMeta,
      sendChat,
      reactToChat,
      clearUnread,
      announceVersionSaved,
      announceVersionRestored,
      announceGift,
      announceSessionEnded,
      announcePublished,
      announceActivity,
      announceRoomLock,
      announceRoomDeleted,
    }),
    [
      connection,
      participants,
      chatMessages,
      unreadCount,
      cursors,
      seedField,
      publishField,
      flushField,
      focusField,
      publishCursor,
      requestSync,
      publishSnapshot,
      announceMeta,
      sendChat,
      reactToChat,
      clearUnread,
      announceVersionSaved,
      announceVersionRestored,
      announceGift,
      announceSessionEnded,
      announcePublished,
      announceActivity,
      announceRoomLock,
      announceRoomDeleted,
    ]
  )
}

"use client"

import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AvatarWithFrame } from "@/components/ui/avatar-with-frame"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Heart, Lock, MessagesSquare, MoreHorizontal, Paperclip, Pencil, Reply, Trash2, X } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ReportContentButton } from "@/components/moderation/report-content-button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
import { MediaEmojiPicker } from "@/components/content/media-emoji-picker"
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp"
import { createClient } from "@/lib/supabase"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { UserBadges } from "@/components/user-badge"
import { useVerificationBadges } from "@/hooks/use-verification-badges"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { Spinner } from "@/components/ui/skeletons"
import type { ActiveCosmetics } from "@/lib/cosmetics"

/** Media a single comment can carry. Mirrors the API's validation. */
type CommentAttachment = {
  url: string
  type: "image" | "video" | "audio" | "file"
  name?: string
  width?: number
  height?: number
  duration?: number
}

const MAX_COMMENT_ATTACHMENTS = 4

function attachmentKind(file: File): CommentAttachment["type"] {
  if (file.type.startsWith("image/")) return "image"
  if (file.type.startsWith("video/")) return "video"
  if (file.type.startsWith("audio/")) return "audio"
  const name = (file.name || "").toLowerCase()
  if (/\.(jpe?g|png|gif|webp|avif|heic|heif|bmp|svg)$/.test(name)) return "image"
  if (/\.(mp4|webm|mov|m4v|ogv|mkv|3gp)$/.test(name)) return "video"
  if (/\.(mp3|wav|m4a|aac|flac|opus|oga)$/.test(name)) return "audio"
  return "file"
}

/** Attachments a comment was saved with — new array first, legacy column as fallback. */
function attachmentsOf(comment: Comment): CommentAttachment[] {
  const list = Array.isArray(comment.attachments) ? comment.attachments : []
  if (list.length) return list.filter((a) => a && typeof a.url === "string")
  if (comment.media_url) {
    const declared = String(comment.media_type || "")
    const type: CommentAttachment["type"] =
      declared === "video" || declared === "audio" || declared === "file" ? declared : "image"
    return [{ url: comment.media_url, type }]
  }
  return []
}

interface CommentAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  video_avatar_url?: string | null
  is_verified?: boolean
  is_premium?: boolean
  badge_id?: string | null
  active_cosmetics?: ActiveCosmetics | null
  cosmetics?: ActiveCosmetics | null
}

interface Comment {
  id: string
  author_id?: string
  author: CommentAuthor
  content: string
  created_at: string
  like_count?: number
  likes?: number
  is_edited?: boolean
  replies?: Comment[]
  isLiked?: boolean
  parent_comment_id?: string | null
  media_url?: string | null
  media_type?: string | null
  attachments?: CommentAttachment[] | null
}

/** Read-only media on a posted comment. */
function CommentAttachments({
  items,
  onOpen,
}: {
  items: CommentAttachment[]
  onOpen: (url: string) => void
}) {
  if (items.length === 0) return null
  const single = items.length === 1
  return (
    <div className="mt-2 flex flex-wrap items-start gap-2">
      {items.map((a, i) => {
        if (a.type === "image") {
          return (
            <button
              key={`${a.url}-${i}`}
              type="button"
              onClick={() => onOpen(a.url)}
              className="group relative overflow-hidden rounded-2xl ring-1 ring-border/50 transition-transform active:scale-[0.99]"
              aria-label="Open image"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name || "Comment attachment"}
                loading="lazy"
                className={
                  single
                    ? "max-h-80 w-auto max-w-full object-cover transition-transform group-hover:scale-[1.01]"
                    : "h-32 w-32 object-cover sm:h-40 sm:w-40"
                }
              />
            </button>
          )
        }
        if (a.type === "video") {
          return (
            <video
              key={`${a.url}-${i}`}
              src={a.url}
              controls
              playsInline
              preload="metadata"
              className="max-h-80 w-full max-w-md rounded-2xl bg-black ring-1 ring-border/50"
            />
          )
        }
        if (a.type === "audio") {
          return (
            <audio
              key={`${a.url}-${i}`}
              src={a.url}
              controls
              preload="metadata"
              className="w-full max-w-sm"
            />
          )
        }
        return (
          <a
            key={`${a.url}-${i}`}
            href={a.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <FileText className="h-4 w-4 shrink-0 text-cyan-500" />
            <span className="truncate">{a.name || "Attachment"}</span>
          </a>
        )
      })}
    </div>
  )
}

/** Pending attachments in a composer, each removable before posting. */
function AttachmentChips({
  items,
  onRemove,
}: {
  items: CommentAttachment[]
  onRemove: (index: number) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a, i) => (
        <div
          key={`${a.url}-${i}`}
          className="relative overflow-hidden rounded-xl border border-border/60 bg-muted/40"
        >
          {a.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.url} alt={a.name || "Attachment"} className="h-16 w-16 object-cover" />
          ) : (
            <div className="flex h-16 w-24 items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0 text-cyan-500" />
              <span className="truncate">{a.type === "video" ? "Video" : a.name || "File"}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label="Remove attachment"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

/** Paperclip button shared by the comment and reply composers. */
function AttachButton({
  onClick,
  busy,
  disabled,
}: {
  onClick: () => void
  busy: boolean
  disabled?: boolean
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onClick}
      disabled={disabled || busy}
      title="Attach a photo, video or file"
      aria-label="Attach media"
      className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
    >
      {busy ? <Spinner className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
    </Button>
  )
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

export function CommentsSection({ loopId, commentsDisabled }: { loopId: string; comments?: Comment[]; commentsDisabled?: boolean }) {
  const [commentsData, setCommentsData] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const verificationBadges = useVerificationBadges()
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null)
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const token = user?.access_token || user?.token
  const [sort, setSort] = useState<"new" | "top">("new")

  const totalComments = useMemo(() => {
    const count = (list: Comment[]): number =>
      list.reduce((n, c) => n + 1 + count(c.replies || []), 0)
    return count(commentsData)
  }, [commentsData])

  /** Id of the comment whose full thread is open in the focused panel. */
  const [threadId, setThreadId] = useState<string | null>(null)
  const threadRoot = useMemo(
    () => commentsData.find((c) => c.id === threadId) || null,
    [commentsData, threadId],
  )
  /** Open the whole conversation under a comment in a focused panel. */
  const openThread = (id: string) => {
    setThreadId(id)
    setReplyingTo(id)
  }

  const visibleComments = useMemo(() => {
    const list = [...commentsData]
    if (sort === "top") {
      list.sort((a, b) => (b.like_count ?? b.likes ?? 0) - (a.like_count ?? a.likes ?? 0))
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return list
  }, [commentsData, sort])

  // ── Comment attachments (image / video / audio / any file) ──
  const [newAttachments, setNewAttachments] = useState<CommentAttachment[]>([])
  const [replyAttachments, setReplyAttachments] = useState<Record<string, CommentAttachment[]>>({})
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const fileTargetRef = useRef<string>("new")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openFilePicker = (target: string) => {
    fileTargetRef.current = target
    fileInputRef.current?.click()
  }

  const handleFiles = async (files: FileList | null) => {
    const target = fileTargetRef.current
    if (!files || files.length === 0 || !token) return
    const current = target === "new" ? newAttachments : replyAttachments[target] || []
    const room = MAX_COMMENT_ATTACHMENTS - current.length
    if (room <= 0) {
      toast({
        title: `Up to ${MAX_COMMENT_ATTACHMENTS} attachments`,
        description: "Remove one to add another.",
        variant: "destructive",
      })
      return
    }
    const picked = Array.from(files).slice(0, room)
    setUploadingFor(target)
    const uploaded: CommentAttachment[] = []
    try {
      for (const file of picked) {
        const kind = attachmentKind(file)
        const result = await uploadMediaFile(file, {
          type: kind,
          authHeaders: { Authorization: `Bearer ${token}` },
          folder: "comments",
        })
        uploaded.push({
          url: result.url,
          type: kind,
          name: file.name,
          width: result.width,
          height: result.height,
          duration: result.duration,
        })
      }
    } catch (err: any) {
      toast({
        title: "Couldn't attach that file",
        description: err?.message || "Try a different file.",
        variant: "destructive",
      })
    } finally {
      if (uploaded.length) {
        if (target === "new") {
          setNewAttachments((prev) => [...prev, ...uploaded].slice(0, MAX_COMMENT_ATTACHMENTS))
        } else {
          setReplyAttachments((prev) => ({
            ...prev,
            [target]: [...(prev[target] || []), ...uploaded].slice(0, MAX_COMMENT_ATTACHMENTS),
          }))
        }
      }
      setUploadingFor(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const loadComments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/loops/${loopId}/comments`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (response.ok) {
        const data = await response.json()
        setCommentsData(data.comments || [])
      }
    } catch {
      toast({ title: "Couldn't load comments", description: 'Check your connection and try again.', variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [loopId, token, toast])

  useEffect(() => {
    if (loopId) void loadComments()
  }, [loopId, loadComments])

  // Real-time listener for live comments
  useEffect(() => {
    if (!loopId) return

    const channel = supabase
      .channel(`comments:${loopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          void loadComments()
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          void loadComments()
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "comments", filter: `loop_id=eq.${loopId}` },
        () => {
          void loadComments()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loopId, loadComments])

  const handleSubmitComment = async () => {
    if ((!newComment.trim() && newAttachments.length === 0) || !token || submitting) return
    const submittedContent = newComment
    const submittedAttachments = newAttachments
    setSubmitting(true)
    try {
      const response = await fetch(`/api/loops/${loopId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: submittedContent, attachments: submittedAttachments }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        toast({ title: "Couldn't post comment", description: data.error || 'Try again in a moment.', variant: "destructive" })
        return
      }
      // Dedupe by id — the realtime reload will re-fetch the authoritative list.
      setCommentsData((prev) =>
        data.comment?.id && prev.some((c) => c.id === data.comment.id)
          ? prev
          : [data.comment, ...prev],
      )
      setNewComment("")
      setNewAttachments([])
      // An @loopai mention comes back answered; reload so the reply lands in
      // its thread instead of waiting for the realtime echo.
      if (data.ai_reply) void loadComments()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReply = async (parentId: string) => {
    const pending = replyAttachments[parentId] || []
    if ((!replyContent.trim() && pending.length === 0) || !token || submittingReplyId) return
    setSubmittingReplyId(parentId)
    try {
      const response = await fetch(`/api/loops/${loopId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          content: replyContent,
          parent_comment_id: parentId,
          attachments: pending,
        }),
      })
      if (!response.ok) {
        toast({ title: "Couldn't post reply", description: 'Try again in a moment.', variant: "destructive" })
        return
      }
      setReplyContent("")
      setReplyAttachments((prev) => ({ ...prev, [parentId]: [] }))
      setReplyingTo(null)
      await loadComments()
    } finally {
      setSubmittingReplyId(null)
    }
  }

  const handleLike = async (commentId: string) => {
    if (!token) return
    const response = await fetch(`/api/loops/${loopId}/comments/${commentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ action: "like" }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) return
    setCommentsData((prev) =>
      prev.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              isLiked: data.is_active,
              like_count: Math.max((comment.like_count || comment.likes || 0) + (data.is_active ? 1 : -1), 0),
            }
          : comment,
      ),
    )
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim() || !token) return
    const response = await fetch(`/api/loops/${loopId}/comments/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: editContent }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast({ title: "Couldn't edit comment", description: data.error || 'Try again.', variant: "destructive" })
      return
    }
    setCommentsData((prev) => prev.map((c) => (c.id === editingId ? { ...c, ...data.comment } : c)))
    setEditingId(null)
    setEditContent("")
  }

  const handleDelete = async () => {
    if (!deleteId || !token) return
    const removingId = deleteId
    const removeFromTree = (items: Comment[]): Comment[] =>
      items
        .filter((c) => c.id !== removingId)
        .map((c) => ({
          ...c,
          replies: c.replies ? removeFromTree(c.replies) : c.replies,
        }))

    // Optimistic remove (top-level + nested replies)
    setCommentsData((prev) => removeFromTree(prev))
    setDeleteId(null)

    const response = await fetch(`/api/loops/${loopId}/comments/${removingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      toast({ title: "Couldn't delete comment", description: 'Try again.', variant: "destructive" })
      void loadComments()
      return
    }
  }

  const renderComment = (comment: Comment, opts?: { compact?: boolean }) => {
    const authorId = comment.author_id || comment.author?.id
    const isOwner = user?.id === authorId
    const likes = comment.like_count ?? comment.likes ?? 0
    const compact = Boolean(opts?.compact)
    const replies = comment.replies || []
    const previewReplies = compact ? [] : replies.slice(0, 2)

    return (
      <div key={comment.id}>
        <div className="group/comment flex gap-2.5 rounded-2xl px-1.5 py-2 transition-colors hover:bg-muted/40 sm:gap-3 sm:px-2">
          <Link href={`/profile/${comment.author?.username || ""}`} className="mt-0.5 shrink-0">
            <AvatarWithFrame
              avatarUrl={comment.author?.avatar_url}
              videoAvatarUrl={comment.author?.video_avatar_url || null}
              frameId={(comment.author as any)?.equipped_frame_id ?? null}
              seed={comment.author?.username}
              size={compact ? 26 : 34}
              alt={comment.author?.display_name || ""}
            />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
                <Link
                  href={`/profile/${comment.author?.username || ""}`}
                  className="font-semibold text-foreground hover:underline"
                >
                  {comment.author?.display_name}
                </Link>
                {comment.author?.is_verified && (
                  <VerifiedSeal size={15} title="Verified Creator" />
 )}
                {(comment.author as any)?.badge_id && verificationBadges[(comment.author as any).badge_id] && (
                  <UserBadges
                    badge={verificationBadges[(comment.author as any).badge_id]}
                    size="sm"
                  />
                )}
                <Link
                  href={`/profile/${comment.author?.username || ""}`}
                  className="text-muted-foreground text-xs hover:underline"
                >
                  @{comment.author?.username}
                </Link>
                <FreshnessTimestamp date={comment.created_at} showIcon />
                {Boolean(comment.is_edited) && <span className="text-xs text-muted-foreground">(edited)</span>}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground group-hover/comment:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="border-border bg-popover text-foreground">
                  {isOwner && (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditContent(comment.content)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteId(comment.id)} className="text-red-300">
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                  <ReportContentButton contentType="comment" contentId={comment.id} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {editingId === comment.id ? (
              <div className="mt-1 space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[70px] rounded-xl border-border/70 bg-muted/40 text-sm text-foreground"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={handleSaveEdit}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <>
                {comment.content?.trim() ? (
                  <RichContent
                    text={comment.content}
                    className="mt-0.5 break-words text-[14px] leading-relaxed text-foreground/95"
                  />
                ) : null}
                <CommentAttachments items={attachmentsOf(comment)} onOpen={setLightbox} />
              </>
            )}

            <div className="mt-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => handleLike(comment.id)}
                aria-pressed={Boolean(comment.isLiked)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors hover:bg-muted ${comment.isLiked ? "text-rose-500" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Heart className={`h-3.5 w-3.5 ${comment.isLiked ? "fill-rose-500 text-rose-500" : ""}`} />
                {likes > 0 ? likes : "Like"}
              </button>
              <button
                type="button"
                onClick={() => setReplyingTo(comment.id)}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Reply className="h-3.5 w-3.5" /> Reply
              </button>
            </div>

            {replyingTo === comment.id && (
              <div className="mt-2 space-y-2 rounded-2xl border border-border/70 bg-card p-2.5 shadow-sm">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Reply className="h-3 w-3" /> Replying to
                  <span className="font-semibold text-foreground">@{comment.author?.username || "this comment"}</span>
                </p>
                <div className="relative">
                  <MentionTextarea
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder={`Reply to @${comment.author?.username || "comment"}… use @ to tag`}
                    className="min-h-[64px] rounded-xl border-border/60 bg-muted/30 pr-20 text-sm text-foreground"
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
                    <AttachButton
                      onClick={() => openFilePicker(comment.id)}
                      busy={uploadingFor === comment.id}
                    />
                    <MediaEmojiPicker onSelectEmoji={(emoji) => setReplyContent((prev) => prev + emoji)} />
                  </div>
                </div>
                <AttachmentChips
                  items={replyAttachments[comment.id] || []}
                  onRemove={(index) =>
                    setReplyAttachments((prev) => ({
                      ...prev,
                      [comment.id]: (prev[comment.id] || []).filter((_, i) => i !== index),
                    }))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs font-semibold"
                    onClick={() => handleSubmitReply(comment.id)}
                    disabled={
                      submittingReplyId === comment.id ||
                      uploadingFor === comment.id ||
                      (!replyContent.trim() && (replyAttachments[comment.id] || []).length === 0)
                    }
                  >
                    {submittingReplyId === comment.id ? "Replying…" : "Reply"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" onClick={() => setReplyingTo(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Replies: a short preview under the comment, the full thread one
            click away — no stack of rails narrowing the text at every level. */}
        {!compact && replies.length > 0 && (
          <div className="ml-3 space-y-0.5 border-l border-border/60 pl-3 sm:ml-4 sm:pl-3.5">
            {previewReplies.map((reply) => renderComment(reply, { compact: true }))}
            <button
              type="button"
              onClick={() => openThread(comment.id)}
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <MessagesSquare className="h-3.5 w-3.5" />
              {replies.length === previewReplies.length
                ? `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`
                : `View all ${replies.length} replies`}
            </button>
          </div>
        )}
      </div>
    )
  }

  /** Full conversation for the focused thread panel (nested replies kept). */
  const renderThreadReplies = (comment: Comment, prefix = "t"): ReactNode[] => {
    const replies = comment.replies || []
    return replies.flatMap((reply, index) => [
      <div key={`${prefix}${reply.id}`}>{renderComment(reply, { compact: true })}</div>,
      ...renderThreadReplies(reply, `${prefix}${reply.id}-${index}`),
    ])
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border/70 bg-card/60 p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">Comments</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {totalComments}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Live
          </span>
        </div>
        {commentsData.length > 1 && (
          <div className="flex shrink-0 items-center rounded-full border border-border/70 bg-muted/40 p-0.5 text-[11px] font-medium">
            {(["new", "top"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSort(option)}
                className={`rounded-full px-2.5 py-1 transition-colors ${
                  sort === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {option === "new" ? "Newest" : "Top"}
              </button>
            ))}
          </div>
        )}
      </div>

      {commentsDisabled ? (
        <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          <span>Comments are locked by the author.</span>
        </div>
      ) : user ? (
        <div className="rounded-2xl border border-border/70 bg-background/60 p-2.5 shadow-sm">
          <div className="flex gap-2.5">
            <div className="hidden shrink-0 pt-0.5 sm:block">
              <Avatar className="h-8 w-8">
                <AvatarImage src={(user as any)?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {((user as any)?.display_name || (user as any)?.name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <MentionTextarea
                value={newComment}
                onChange={setNewComment}
                placeholder="Add to the conversation… type @ to tag someone"
                className="min-h-[72px] rounded-xl border-border/60 bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground/70"
              />
              <AttachmentChips
                items={newAttachments}
                onRemove={(index) => setNewAttachments((prev) => prev.filter((_, i) => i !== index))}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  <AttachButton onClick={() => openFilePicker("new")} busy={uploadingFor === "new"} />
                  <MediaEmojiPicker
                    onSelectEmoji={(emoji) => setNewComment((prev) => prev + emoji)}
                    onSelectGif={(url) => setNewComment((prev) => prev + ` ![GIF](${url}) `)}
                    isPro={Boolean((user as any)?.is_premium)}
                  />
                </div>
                <Button
                  onClick={handleSubmitComment}
                  disabled={
                    submitting || uploadingFor === "new" || (!newComment.trim() && newAttachments.length === 0)
                  }
                  className="h-8 rounded-full px-4 text-xs font-semibold"
                >
                  {submitting ? "Posting…" : "Comment"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          <p className="mb-2">Browsing as guest — sign in to reply.</p>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/login">Log in to comment</Link>
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : commentsData.length === 0 ? (
        <EmptyState title="No comments yet" description="Be the first to start the conversation." />
      ) : (
        <div className="space-y-1 divide-y divide-border/50">{visibleComments.map((comment) => renderComment(comment))}</div>
      )}

      {/* Focused thread panel: full conversation under one comment. */}
      <Dialog
        open={Boolean(threadRoot)}
        onOpenChange={(open) => {
          if (!open) {
            setThreadId(null)
            setReplyingTo(null)
          }
        }}
      >
        <DialogContent className="flex max-h-[86dvh] w-full gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-border/70 px-4 py-3 text-left sm:px-5">
            <DialogTitle className="text-base font-semibold">Replies</DialogTitle>
            <DialogDescription className="sr-only">The full conversation under this comment</DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-2 sm:px-3">
            {threadRoot && (
              <>
                {renderComment(threadRoot, { compact: true })}
                {renderThreadReplies(threadRoot)}
              </>
            )}
          </div>

          <div className="border-t border-border/70 px-3 py-3 sm:px-4">
            {threadRoot && replyingTo === threadRoot.id ? (
              <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-2.5">
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Reply className="h-3 w-3" /> Replying to
                  <span className="font-semibold text-foreground">@{threadRoot.author?.username || "this comment"}</span>
                </p>
                <div className="relative">
                  <MentionTextarea
                    value={replyContent}
                    onChange={setReplyContent}
                    placeholder={`Reply to @${threadRoot.author?.username || "comment"}… use @ to tag`}
                    className="min-h-[64px] rounded-xl border-border/60 bg-muted/30 pr-20 text-sm text-foreground"
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-0.5">
                    <AttachButton onClick={() => openFilePicker(threadRoot.id)} busy={uploadingFor === threadRoot.id} />
                    <MediaEmojiPicker onSelectEmoji={(emoji) => setReplyContent((prev) => prev + emoji)} />
                  </div>
                </div>
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" className="h-7 rounded-full px-3 text-xs" onClick={() => setReplyingTo(null)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs font-semibold"
                    onClick={() => handleSubmitReply(threadRoot.id)}
                    disabled={submittingReplyId === threadRoot.id || !replyContent.trim()}
                  >
                    {submittingReplyId === threadRoot.id ? "Replying…" : "Reply"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs text-muted-foreground">
                  {threadRoot?.replies?.length || 0} in this conversation
                </p>
                <Button
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs font-semibold"
                  onClick={() => threadRoot && setReplyingTo(threadRoot.id)}
                >
                  <Reply className="mr-1 h-3.5 w-3.5" /> Reply
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete comment?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />

      {/* One hidden picker shared by the comment box and every reply box. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*,.pdf,.zip,.txt,.md,.csv,.json"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <Dialog open={Boolean(lightbox)} onOpenChange={(open) => !open && setLightbox(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] border-border bg-card p-3 sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Comment image</DialogTitle>
            <DialogDescription>Full-size comment attachment</DialogDescription>
          </DialogHeader>
          {lightbox && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lightbox}
              alt="Comment attachment"
              className="max-h-[80dvh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

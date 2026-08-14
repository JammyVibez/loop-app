"use client"

import { useCallback, useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  Bot,
  Coins,
  Download,
  FileText,
  Loader2,
  MessageCircle,
  Palette,
  Rocket,
  Send,
  ShoppingBag,
  Trash2,
  Wand2,
} from "lucide-react"
import { CodeLoopCard } from "@/components/developers/code-loop-card"

interface CommentAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  is_verified?: boolean
}

interface ProjectComment {
  id: string
  content: string
  parent_comment_id?: string | null
  created_at: string
  user_id: string
  author?: CommentAuthor
  replies?: ProjectComment[]
}

function timeAgo(iso?: string) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`
  if (ms < 86_400_000 * 7) return `${Math.floor(ms / 86_400_000)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function ProjectDetail({ project }: { project: any }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, LoginGateDialog } = useLoginGate()

  const projectId = project.id
  const isOwner = Boolean(user && project.author_id === user.id)

  // ---- Comments ----
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState("")
  const [replyTo, setReplyTo] = useState<ProjectComment | null>(null)
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/comments`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load comments")
      setComments(data.comments || [])
    } catch (err: any) {
      console.error("Load project comments failed:", err)
    } finally {
      setCommentsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchComments()
  }, [fetchComments])

  // Realtime comments
  useEffect(() => {
    const channel = supabase.channel(`dev-project-comments:${projectId}`)
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_comments",
          filter: `project_id=eq.${projectId}`,
        },
        () => void fetchComments(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [projectId, fetchComments])

  const postComment = async () => {
    if (!requireAuth("comment")) return
    const content = commentText.trim()
    if (!content) return
    setPosting(true)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content,
          parent_comment_id: replyTo?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to post comment")
      setCommentText("")
      setReplyTo(null)
      await fetchComments()
    } catch (err: any) {
      toast({ title: "Couldn't post comment", description: err.message, variant: "destructive" })
    } finally {
      setPosting(false)
    }
  }

  const deleteComment = async (comment: ProjectComment) => {
    if (!window.confirm("Delete this comment? Replies will be removed too.")) return
    setDeletingId(comment.id)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/comments/${comment.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete comment")
      await fetchComments()
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const canDeleteComment = (comment: ProjectComment) =>
    Boolean(user) && (comment.user_id === user?.id || isOwner)

  // ---- Marketplace publish ----
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedListing, setPublishedListing] = useState<any | null>(project.published_listing || null)
  const [publishDraft, setPublishDraft] = useState({
    listing_type: "bot" as "bot" | "design" | "styling",
    title: project.title || "",
    description: project.description || "",
    price_coins: 0,
  })

  const publishToMarketplace = async () => {
    if (!requireAuth("post")) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          listing_type: publishDraft.listing_type,
          title: publishDraft.title.trim(),
          description: publishDraft.description.trim(),
          price_coins: Math.max(0, Number(publishDraft.price_coins) || 0),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish")
      if (data.listing) {
        setPublishedListing(data.listing)
        toast({
          title: data.already_published ? "Already published" : "Published to the Marketplace! 🚀",
          description: `“${data.listing.title}” is now listed.`,
        })
      }
      setPublishOpen(false)
    } catch (err: any) {
      toast({ title: "Publish failed", description: err.message, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }

  const TYPE_META = {
    bot: { label: "Bot", icon: Bot, blurb: "Automation circle owners can install into their community" },
    design: { label: "Design", icon: Palette, blurb: "Full community look & layout pack" },
    styling: { label: "Styling", icon: Wand2, blurb: "Tokens, fonts, and UI accents" },
  } as const

  return (
    <>
      {LoginGateDialog}
      <div className="space-y-6">
        <CodeLoopCard project={project} onDeleted={() => (window.location.href = "/developers")} />

        {/* Attached files */}
        {Array.isArray(project.files) && project.files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-cyan-500" /> Attached files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.files.map((file: any) => (
                <a
                  key={file.url}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 transition hover:border-cyan-500/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{file.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {file.size ? <span>{(file.size / 1024).toFixed(0)} KB</span> : null}
                    <Download className="h-4 w-4" />
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Publish to Marketplace */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-5 w-5 text-amber-500" /> Ship it to the Marketplace
            </CardTitle>
            <CardDescription>
              Turn this project into a sellable listing — circle owners can buy & install it, and you earn Loop Coins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {publishedListing ? (
              <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    <Badge className="mr-2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                      <Coins className="mr-1 h-3 w-3" /> {Number(publishedListing.price_coins) || 0}
                    </Badge>
                    {publishedListing.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Published as a {publishedListing.listing_type} listing
                    {publishedListing.is_published === false ? " (draft)" : " — live in the Marketplace"}.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm" className="rounded-full">
                  <a href="/marketplace" target="_blank" rel="noreferrer">
                    View in Marketplace
                  </a>
                </Button>
              </div>
            ) : isOwner ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Pick what kind of listing this becomes. Bots are the most popular — circle owners install them into
                  their community with one click.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(TYPE_META) as Array<keyof typeof TYPE_META>).map((type) => {
                    const meta = TYPE_META[type]
                    const Icon = meta.icon
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPublishDraft((d) => ({ ...d, listing_type: type }))}
                        className={cn(
                          "rounded-2xl border p-3 text-left transition",
                          publishDraft.listing_type === type
                            ? "border-amber-500/50 bg-amber-500/10"
                            : "border-border bg-card hover:bg-muted/50",
                        )}
                      >
                        <Icon className="mb-2 h-5 w-5 text-amber-500" />
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{meta.blurb}</p>
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="listing-price">Price (Loop Coins)</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
                      <Input
                        id="listing-price"
                        type="number"
                        min={0}
                        value={publishDraft.price_coins}
                        onChange={(e) =>
                          setPublishDraft((d) => ({ ...d, price_coins: Number(e.target.value) || 0 }))
                        }
                        className="pl-9"
                        placeholder="0 = free"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => void publishToMarketplace()}
                    disabled={publishing}
                    className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                  >
                    {publishing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="mr-2 h-4 w-4" />
                    )}
                    Publish listing
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only the project author can publish this. Star or fork it to show some love.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-indigo-500" />
              Discussion
              <span className="text-sm font-normal text-muted-foreground">
                {commentsLoading ? "" : `· ${comments.length} thread${comments.length === 1 ? "" : "s"}`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {commentsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
              </div>
            ) : comments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No discussion yet — ask a question or leave feedback.
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const author: CommentAuthor = comment.author || { id: "", username: "", display_name: "" }
                  return (
                    <div key={comment.id}>
                      <div className="flex gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={author.avatar_url ?? undefined} />
                          <AvatarFallback>{(author.username || "U").charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold">
                              {author.display_name || author.username || "user"}
                            </span>
                            <span className="text-xs text-muted-foreground">@{author.username || "user"}</span>
                            <span className="text-xs text-muted-foreground/70">· {timeAgo(comment.created_at)}</span>
                          </div>
                          <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                          <div className="mt-1 flex items-center gap-3">
                            <button
                              type="button"
                              className="text-xs font-semibold text-indigo-500 transition hover:text-indigo-400"
                              onClick={() => setReplyTo(comment)}
                            >
                              Reply
                            </button>
                            {canDeleteComment(comment) && (
                              <button
                                type="button"
                                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive"
                                onClick={() => void deleteComment(comment)}
                                disabled={deletingId === comment.id}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {(comment.replies || []).length > 0 && (
                        <div className="mt-3 space-y-3 border-l-2 border-border/60 pl-4 ml-[18px]">
                          {(comment.replies || []).map((reply) => {
                            const rAuthor: CommentAuthor = reply.author || { id: "", username: "", display_name: "" }
                            return (
                              <div key={reply.id} className="flex gap-3">
                                <Avatar className="h-7 w-7 shrink-0">
                                  <AvatarImage src={rAuthor.avatar_url ?? undefined} />
                                  <AvatarFallback>{(rAuthor.username || "U").charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-sm font-semibold">
                                      {rAuthor.display_name || rAuthor.username || "user"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">@{rAuthor.username || "user"}</span>
                                    <span className="text-xs text-muted-foreground/70">· {timeAgo(reply.created_at)}</span>
                                  </div>
                                  <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                                  {canDeleteComment(reply) && (
                                    <button
                                      type="button"
                                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive"
                                      onClick={() => void deleteComment(reply)}
                                      disabled={deletingId === reply.id}
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-border/60 pt-4">
              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs">
                  <span className="text-indigo-500">
                    Replying to @{replyTo.author?.username || "user"}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  placeholder={replyTo ? `Reply to @${replyTo.author?.username || "user"}…` : "Share feedback or ask a question…"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void postComment()
                    }
                  }}
                  className="min-h-[44px] flex-1 rounded-2xl border-border/60"
                />
                <Button
                  size="icon"
                  className="h-[44px] w-[44px] shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 text-white"
                  onClick={() => void postComment()}
                  disabled={!commentText.trim() || posting}
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

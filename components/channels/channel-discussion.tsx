"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { MessageCircle, Reply, Share2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { Button } from "@/components/ui/button"
import { ChannelNotice } from "@/components/channels/channel-ui"

type ChannelComment = {
  id: string
  title_id: string
  author_id: string
  parent_comment_id: string | null
  content: string
  created_at: string
  author?: { id: string; username: string; display_name: string; avatar_url: string | null } | null
  replies: ChannelComment[]
}

export function ChannelDiscussion({ titleId, title, kind }: { titleId: string; title: string; kind: "movie" | "series" }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [comments, setComments] = useState<ChannelComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState("")
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [posting, setPosting] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareNote, setShareNote] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/channels/library/${encodeURIComponent(titleId)}/comments`, { cache: "no-store" })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "The discussion could not be loaded.")
      setComments(Array.isArray(payload?.comments) ? payload.comments : [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The discussion could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [titleId])

  useEffect(() => { void load() }, [load])

  const post = async (text: string, parentCommentId?: string) => {
    if (!user) {
      toast({ title: "Sign in to comment" })
      return
    }
    if (!text.trim() || posting) return
    setPosting(true)
    try {
      const response = await fetch(`/api/channels/library/${encodeURIComponent(titleId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content: text.trim(), parentCommentId }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Could not post your comment.")
      setContent("")
      setReplyContent("")
      setReplyTo(null)
      await load()
    } catch (cause) {
      toast({ title: "Comment failed", description: cause instanceof Error ? cause.message : "Please try again.", variant: "destructive" })
    } finally {
      setPosting(false)
    }
  }

  const shareToFeed = async () => {
    if (!user) {
      toast({ title: "Sign in to share" })
      return
    }
    setSharing(true)
    const pageUrl = `${window.location.origin}/channels/${kind === "movie" ? "movie" : "series"}/${encodeURIComponent(titleId)}`
    try {
      const response = await fetch("/api/loops", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content_text: `${shareNote.trim() ? `${shareNote.trim()}\n\n` : `I’m watching ${title} on Loop.\n\n`}${title} · ${pageUrl}`,
          content_type: "text",
          category: "entertainment",
          visibility: "public",
          content_metadata: { channel_title_id: titleId, channel_title: title, channel_url: pageUrl },
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Could not share to your feed.")
      setShareNote("")
      setSharing(false)
      toast({ title: "Shared to your feed", description: "Your post is now in the Loop feed." })
    } catch (cause) {
      toast({ title: "Share failed", description: cause instanceof Error ? cause.message : "Please try again.", variant: "destructive" })
      setSharing(false)
    }
  }

  const renderComment = (comment: ChannelComment, depth = 0) => (
    <article key={comment.id} className="space-y-2 border-l border-white/10 pl-3" style={{ marginLeft: depth ? 10 : 0 }}>
      <div className="flex items-baseline gap-2 text-xs">
        <Link className="font-semibold text-white hover:underline" href={`/profile/${encodeURIComponent(comment.author?.username || "")}`}>
          {comment.author?.display_name || "Loop member"}
        </Link>
        <span className="text-white/40">@{comment.author?.username || "member"}</span>
        <time className="text-white/35" dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString()}</time>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/80">{comment.content}</p>
      {user ? (
        <button type="button" onClick={() => { setReplyTo(comment.id); setReplyContent("") }} className="inline-flex items-center gap-1 text-xs font-semibold text-white/50 hover:text-white">
          <Reply className="h-3.5 w-3.5" /> Reply
        </button>
      ) : null}
      {replyTo === comment.id ? (
        <div className="space-y-2">
          <MentionTextarea value={replyContent} onChange={setReplyContent} placeholder={`Reply to @${comment.author?.username || "member"}…`} className="min-h-20 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void post(replyContent, comment.id)} disabled={posting || !replyContent.trim()}>{posting ? "Replying…" : "Reply"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>Cancel</Button>
          </div>
        </div>
      ) : null}
      {comment.replies?.length ? <div className="space-y-4 pt-2">{comment.replies.map((reply) => renderComment(reply, depth + 1))}</div> : null}
    </article>
  )

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5" aria-labelledby="channel-discussion-title">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-white/55" />
        <h2 id="channel-discussion-title" className="text-lg font-bold">Discussion</h2>
        <span className="text-xs text-white/40">{comments.length}</span>
      </div>

      <div className="space-y-2">
        <MentionTextarea value={content} onChange={setContent} placeholder="Add a comment… use @ to tag someone" className="min-h-20 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" />
        <div className="flex justify-end">
          {user ? (
            <Button size="sm" onClick={() => void post(content)} disabled={posting || !content.trim()}>{posting ? "Posting…" : "Comment"}</Button>
          ) : <Button asChild size="sm"><Link href="/login">Sign in to comment</Link></Button>}
        </div>
      </div>

      {loading ? <p className="text-sm text-white/45">Loading comments…</p> : null}
      {error ? <ChannelNotice title="Discussion unavailable" description={error}><button type="button" onClick={() => void load()} className="mt-2 text-xs font-semibold text-white underline">Try again</button></ChannelNotice> : null}
      {!loading && !error && comments.length ? <div className="space-y-5">{comments.map((comment) => renderComment(comment))}</div> : null}
      {!loading && !error && !comments.length ? <p className="text-sm text-white/45">Start the conversation about this {kind}.</p> : null}

      <div className="border-t border-white/10 pt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Share2 className="h-4 w-4 text-white/55" />Share to your feed</div>
        {user ? (
          <>
            <MentionTextarea value={shareNote} onChange={setShareNote} placeholder={`Say something about ${title} (optional)…`} className="min-h-16 border-white/10 bg-white/[0.04] text-white placeholder:text-white/35" />
            <div className="mt-2 flex justify-end"><Button size="sm" variant="outline" onClick={() => void shareToFeed()} disabled={sharing}>{sharing ? "Sharing…" : "Share to feed"}</Button></div>
          </>
        ) : <Link href="/login" className="text-xs font-semibold text-white/60 underline">Sign in to share this title.</Link>}
      </div>
    </section>
  )
}

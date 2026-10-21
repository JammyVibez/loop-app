"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/skeletons"
import { EditCommunityDialog, ManageMembersDialog } from "@/components/communities/forum/community-admin"
import { cn } from "@/lib/utils"
import {
  ArrowBigUp,
  Clock,
  Eye,
  Flame,
  Hash,
  Loader2,
  Lock,
  MessageSquare,
  MessagesSquare,
  Pin,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Users,
} from "lucide-react"

type Author = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_verified?: boolean
}

type Thread = {
  id: string
  title: string
  excerpt: string
  author: Author | null
  forum: { id: string; name: string; icon?: string | null } | null
  tags: string[]
  replies: number
  votes: number
  views: number
  pinned: boolean
  locked: boolean
  created_at: string
  last_activity_at: string
}

type Forum = { id: string; name: string; icon?: string | null; description?: string | null; count: number }

type ForumData = {
  community: any
  viewer: { is_member: boolean; can_post: boolean; is_staff: boolean; can_manage: boolean; role: string | null }
  threads: Thread[]
  forums: Forum[]
  staff: Array<{ role: string; user: Author }>
  members: Author[]
  coloops: Array<{ id: string; session_id: string; title: string; description: string | null; status: string; creator: Author | null }>
  duels: Array<{ id: string; prompt: string; status: string; votes: number; entrants: number; creator: Author | null }>
  counts: { threads: number; replies: number; members: number }
}

const SORTS = [
  { id: "latest", label: "Latest", icon: Clock },
  { id: "newest", label: "New", icon: Sparkles },
  { id: "top", label: "Top", icon: Flame },
  { id: "views", label: "Most viewed", icon: Eye },
] as const

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  if (!Number.isFinite(diff) || diff < 0) return "now"
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function initials(name?: string | null) {
  return (name || "?").trim().slice(0, 2).toUpperCase()
}

/**
 * The community forum.
 *
 * A thread is a post with a title; a forum is a space; replies live under the
 * thread. Owners and admins edit the community and manage members from the
 * header, so the page stays one stream with no extra tabs.
 */
export function ForumHome({ communityId }: { communityId: string }) {
  const router = useRouter()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [data, setData] = useState<ForumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("latest")
  const [forum, setForum] = useState("all")
  const [query, setQuery] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [joining, setJoining] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  // debounce the search box so typing doesn't hammer the API
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(query.trim()), 350)
    return () => clearTimeout(t)
  }, [query])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      try {
        const params = new URLSearchParams({ sort, forum, limit: "30" })
        if (searchTerm) params.set("q", searchTerm)
        const res = await fetch(`/api/communities/${communityId}/forum?${params.toString()}`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Failed to load forum")
        setData(json)
        setError(null)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    },
    [communityId, sort, forum, searchTerm, getAuthHeader],
  )

  useEffect(() => {
    void load()
  }, [load])

  const community = data?.community
  const viewer = data?.viewer
  const forums = useMemo(() => data?.forums || [], [data?.forums])

  const join = async () => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}`)
      return
    }
    setJoining(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/join`, {
        method: "POST",
        headers: { ...getAuthHeader() },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not join")
      toast({
        title: json.status === "pending" ? "Request sent" : "Welcome in",
        description: json.status === "pending" ? "A moderator will review your request." : "You can start a thread now.",
      })
      await load({ silent: true })
    } catch (e: any) {
      toast({ title: "Could not join", description: e.message, variant: "destructive" })
    } finally {
      setJoining(false)
    }
  }

  const openComposer = () => {
    if (!user) {
      router.push(`/auth?returnTo=/communities/${communityId}`)
      return
    }
    if (!viewer?.can_post) {
      toast({ title: "Members only", description: "Join this community to start a thread." })
      return
    }
    setComposerOpen(true)
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-7 w-7 text-primary" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-sm font-medium text-foreground">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!data || !community) return null

  const banner = community.banner_url || community.cover_url || null

  return (
    <div className="mx-auto w-full max-w-6xl px-3 pb-16 sm:px-5">
      {/* ── Community header ── */}
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className="relative h-36 sm:h-48">
          {banner ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={banner} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-emerald-500/25 via-primary/20 to-cyan-500/20" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        </div>

        <div className="-mt-12 flex flex-col gap-4 px-4 pb-5 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-end gap-3">
              <Avatar className="h-20 w-20 rounded-2xl border-4 border-card shadow-md">
                <AvatarImage src={community.avatar_url || undefined} alt={community.name} />
                <AvatarFallback className="rounded-2xl text-lg font-bold">{initials(community.name)}</AvatarFallback>
              </Avatar>
              <div className="pb-1">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">{community.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {community.handle ? `c/${community.handle}` : `c/${community.id}`} · {data.counts.members.toLocaleString()} members
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!viewer?.is_member ? (
                <Button onClick={join} disabled={joining} className="rounded-full">
                  {joining ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Users className="mr-1.5 h-4 w-4" />}
                  Join
                </Button>
              ) : (
                <Button onClick={openComposer} className="rounded-full">
                  <Plus className="mr-1.5 h-4 w-4" />
                  New thread
                </Button>
              )}
              {viewer?.can_manage && (
                <div className="flex items-center gap-1 rounded-full border border-border p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-xs"
                    onClick={() => setEditOpen(true)}
                  >
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-xs"
                    onClick={() => setMembersOpen(true)}
                  >
                    <Users className="mr-1.5 h-3.5 w-3.5" /> Members
                  </Button>
                </div>
              )}
            </div>
          </div>

          {community.description && (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{community.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-medium">
              <MessagesSquare className="h-3.5 w-3.5 text-emerald-500" />
              {data.counts.threads.toLocaleString()} threads
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-medium">
              <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
              {data.counts.replies.toLocaleString()} replies
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 font-medium">
              <Users className="h-3.5 w-3.5 text-violet-500" />
              {data.counts.members.toLocaleString()} members
            </span>
            {community.is_private && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-medium text-amber-600 dark:text-amber-400">
                <Lock className="h-3.5 w-3.5" /> Private
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Forum tabs ── */}
      <div className="mt-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-card p-1.5">
        {forums.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setForum(f.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors",
              forum === f.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {f.id === "all" ? <MessagesSquare className="h-3.5 w-3.5" /> : f.id === "unanswered" ? <MessageSquare className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
            {f.name}
            <span className={cn("rounded-full px-1.5 text-[10px]", forum === f.id ? "bg-primary-foreground/20" : "bg-muted")}>{f.count}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* ── Thread list ── */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search threads…"
                className="h-9 rounded-xl border-0 bg-muted/50 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-0.5 rounded-xl bg-muted/50 p-0.5">
              {SORTS.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSort(s.id)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors",
                      sort === s.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-2xl border border-border bg-card py-16">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : data.threads.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <MessagesSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                {searchTerm ? "No threads match that search" : "No threads here yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {searchTerm ? "Try a different phrase or clear the search." : "Start the first discussion — it is how a community begins."}
              </p>
              {!searchTerm && (
                <Button onClick={openComposer} className="mt-4 rounded-full" size="sm">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Start a thread
                </Button>
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {data.threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/communities/${communityId}/posts/${t.id}`}
                    className={cn(
                      "group flex gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30 sm:p-4",
                      t.pinned && "border-emerald-500/30 bg-emerald-500/[0.04]",
                    )}
                  >
                    <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 self-start rounded-xl bg-muted/60 px-1 py-1.5">
                      <ArrowBigUp className="h-4 w-4 text-emerald-500" />
                      <span className="text-[11px] font-bold tabular-nums">{t.votes}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {t.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Pin className="h-2.5 w-2.5" /> Pinned
                          </span>
                        )}
                        {t.locked && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </span>
                        )}
                        {t.forum && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                            <Hash className="h-2.5 w-2.5" />
                            {t.forum.name}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-foreground group-hover:text-primary sm:text-base">
                        {t.title}
                      </h2>
                      {t.excerpt && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{t.excerpt}</p>}

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {t.author && (
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={t.author.avatar_url || undefined} alt="" />
                              <AvatarFallback className="text-[8px]">{initials(t.author.display_name || t.author.username)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground/80">{t.author.display_name || t.author.username}</span>
                          </span>
                        )}
                        <span>{timeAgo(t.last_activity_at)}</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {t.replies}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3 w-3" /> {t.views}
                        </span>
                        {t.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Sidebar ── */}
        <aside className="space-y-3">
          {Array.isArray(community.rules) && community.rules.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Shield className="h-3.5 w-3.5" /> House rules
              </h3>
              <ol className="mt-2 space-y-1.5 text-xs text-foreground/80">
                {community.rules.slice(0, 6).map((rule: any, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-bold text-muted-foreground">{i + 1}.</span>
                    <span>{typeof rule === "string" ? rule : rule?.text || rule?.title || ""}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {data.staff.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Moderators</h3>
              <ul className="mt-2 space-y-1.5">
                {data.staff.map((s) => (
                  <li key={`${s.user.id}-${s.role}`} className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={s.user.avatar_url || undefined} alt="" />
                      <AvatarFallback className="text-[9px]">{initials(s.user.display_name || s.user.username)}</AvatarFallback>
                    </Avatar>
                    <Link href={`/profile/${s.user.username || s.user.id}`} className="min-w-0 flex-1 truncate text-xs font-medium hover:underline">
                      {s.user.display_name || s.user.username}
                    </Link>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">{s.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.members.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Members</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.members.map((m) => (
                  <Link key={m.id} href={`/profile/${m.username || m.id}`} title={m.display_name || m.username || ""}>
                    <Avatar className="h-7 w-7 ring-1 ring-border transition-transform hover:scale-105">
                      <AvatarImage src={m.avatar_url || undefined} alt="" />
                      <AvatarFallback className="text-[9px]">{initials(m.display_name || m.username)}</AvatarFallback>
                    </Avatar>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <NewThreadSheet
        open={composerOpen}
        onOpenChange={setComposerOpen}
        communityId={communityId}
        forums={forums.filter((f) => f.id !== "all" && f.id !== "unanswered")}
        defaultForum={forum !== "all" && forum !== "unanswered" ? forum : ""}
        onCreated={(href) => {
          setComposerOpen(false)
          router.push(href)
        }}
      />

      {viewer?.can_manage && (
        <>
          <EditCommunityDialog
            community={community}
            open={editOpen}
            onOpenChange={setEditOpen}
            onSaved={() => void load({ silent: true })}
          />
          <ManageMembersDialog
            communityId={communityId}
            open={membersOpen}
            onOpenChange={setMembersOpen}
            onChanged={() => void load({ silent: true })}
          />
        </>
      )}
    </div>
  )
}

/* ─────────────────────────── New thread ─────────────────────────── */

function NewThreadSheet({
  open,
  onOpenChange,
  communityId,
  forums,
  defaultForum,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  forums: Forum[]
  defaultForum: string
  onCreated: (href: string) => void
}) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [spaceId, setSpaceId] = useState(defaultForum)
  const [tags, setTags] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) setSpaceId(defaultForum)
  }, [open, defaultForum])

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/forum`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title,
          content,
          space_id: spaceId || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to create thread")
      setTitle("")
      setContent("")
      setTags("")
      onCreated(json.thread.href)
    } catch (e: any) {
      toast({ title: "Could not post", description: e.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-base font-bold">Start a thread</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What should the community talk about?"
              maxLength={160}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Body</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Give people something to reply to — context, a question, an idea."
              rows={8}
              className="mt-1 resize-none"
            />
          </div>
          {forums.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Forum</label>
              <select
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">General</option>
                {forums.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Tags (comma separated)</label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="feedback, season 2" className="mt-1" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || title.trim().length < 3}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Post thread
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

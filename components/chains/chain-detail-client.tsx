"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ProxyImg } from "@/components/ui/proxy-img"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { ArrowLeft, ArrowUpRight, GitBranch, Lock, MessageCircle, Send } from "lucide-react"

type Chain = {
  id: string
  creator_id: string
  creator_username: string
  creator_display_name: string
  creator_avatar_url: string | null
  circle_id: string | null
  title: string
  description: string
  prompt: string
  kind: string
  category: string
  visibility: string
  contribution_policy: string
  status: string
  cover_image_url: string | null
  contribution_count: number
  participant_count: number
  created_at: string
  updated_at: string
}

type Contribution = {
  id: string
  chain_id: string
  author_id: string
  author_username: string
  author_display_name: string
  author_avatar_url: string | null
  parent_contribution_id: string | null
  contribution_type: string
  title: string | null
  content: string
  payload: Record<string, unknown>
  position: number
  created_at: string
}

type ContributionRevision = {
  id: string
  revision_number: number
  title: string | null
  content: string
  editor_username: string
  created_at: string
}

type ChainResponse = {
  chain: Chain
  contributions: Contribution[]
  can_contribute: boolean
  contributions_limit: number
  contributions_offset: number
  contributions_has_more: boolean
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? "Recently"
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function getSecurePayloadUrl(payload: Record<string, unknown>): string | null {
  const value = payload.url
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" ? url.toString() : null
  } catch {
    return null
  }
}

export function ChainDetailClient({ chainId }: { chainId: string }) {
  const { user, loading: authLoading, getAuthHeader } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ChainResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [contributionType, setContributionType] = useState("text")
  const [structuredEntries, setStructuredEntries] = useState("")
  const [parentContributionId, setParentContributionId] = useState<string | null>(null)
  const [attachment, setAttachment] = useState<File | null>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [forking, setForking] = useState(false)
  const [forkError, setForkError] = useState("")
  const [editingContributionId, setEditingContributionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")
  const [editingContent, setEditingContent] = useState("")
  const [savingContribution, setSavingContribution] = useState(false)
  const [revisionHistory, setRevisionHistory] = useState<Record<string, ContributionRevision[]>>({})
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null)
  const [revisionLoading, setRevisionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/v1/chains/" + encodeURIComponent(chainId), {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      const next = await response.json()
      if (!response.ok) throw new Error(next.message || next.error || "This Chain is unavailable")
      setData(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Chain")
    } finally {
      setLoading(false)
    }
  }, [chainId, getAuthHeader, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  const loadMoreContributions = async () => {
    if (!data?.contributions_has_more || loadingMore) return
    setLoadingMore(true)
    setError("")
    try {
      const params = new URLSearchParams({ limit: "40", offset: String(data.contributions.length) })
      const response = await fetch("/api/v1/chains/" + encodeURIComponent(chainId) + "?" + params.toString(), {
        headers: getAuthHeader(),
        cache: "no-store",
      })
      const next = await response.json()
      if (!response.ok) throw new Error(next.message || next.error || "Could not load more contributions")
      setData((current) => {
        if (!current) return next
        const known = new Set(current.contributions.map((item) => item.id))
        return {
          ...next,
          contributions: [...current.contributions, ...next.contributions.filter((item: Contribution) => !known.has(item.id))],
        }
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more contributions")
    } finally {
      setLoadingMore(false)
    }
  }

  const remixChain = async () => {
    if (!user) {
      router.push("/auth?returnTo=/chains/" + encodeURIComponent(chainId))
      return
    }
    setForking(true)
    setForkError("")
    try {
      const response = await fetch("/api/v1/chains/" + encodeURIComponent(chainId) + "/fork", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({}),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || result.error || "Could not remix this Chain")
      router.push("/chains/" + encodeURIComponent(result.id))
    } catch (cause) {
      setForkError(cause instanceof Error ? cause.message : "Could not remix this Chain")
    } finally {
      setForking(false)
    }
  }

  const beginEdit = (contribution: Contribution) => {
    setEditingContributionId(contribution.id)
    setEditingTitle(contribution.title || "")
    setEditingContent(contribution.content || "")
    setError("")
  }

  const saveContributionEdit = async (contribution: Contribution) => {
    setSavingContribution(true)
    setError("")
    try {
      const response = await fetch(
        "/api/v1/chains/" + encodeURIComponent(chainId) + "/contributions/" + encodeURIComponent(contribution.id),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({
            title: editingTitle.trim(),
            content: editingContent,
            payload: contribution.payload,
          }),
        },
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || result.error || "Could not update contribution")
      setEditingContributionId(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update contribution")
    } finally {
      setSavingContribution(false)
    }
  }

  const toggleRevisionHistory = async (contributionId: string) => {
    if (expandedHistory === contributionId) {
      setExpandedHistory(null)
      return
    }
    setExpandedHistory(contributionId)
    if (revisionHistory[contributionId]) return
    setRevisionLoading(contributionId)
    try {
      const response = await fetch(
        "/api/v1/chains/" + encodeURIComponent(chainId) + "/contributions/" +
          encodeURIComponent(contributionId) + "/revisions",
        { headers: getAuthHeader(), cache: "no-store" },
      )
      const revisions = await response.json()
      if (!response.ok) throw new Error(revisions.message || revisions.error || "Could not load revision history")
      setRevisionHistory((current) => ({ ...current, [contributionId]: Array.isArray(revisions) ? revisions : [] }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load revision history")
      setExpandedHistory(null)
    } finally {
      setRevisionLoading(null)
    }
  }

  const contribute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user) {
      router.push("/auth?returnTo=/chains/" + encodeURIComponent(chainId))
      return
    }
    setSubmitting(true)
    setError("")
    try {
      const payload: Record<string, unknown> = {}
      if (["image", "video", "audio", "document"].includes(contributionType)) {
        if (!attachment) throw new Error("Choose a file to attach to this contribution.")
        const uploadType: "image" | "video" | "audio" | "file" =
          contributionType === "document" ? "file" : contributionType as "image" | "video" | "audio"
        const uploaded = await uploadMediaFile(attachment, {
          type: uploadType,
          folder: "chain-contributions",
          authHeaders: getAuthHeader(),
        })
        payload.url = uploaded.url
        payload.file_name = attachment.name
        payload.mime_type = attachment.type
        payload.size_bytes = attachment.size
        if (uploaded.public_id) payload.public_id = uploaded.public_id
      } else if (contributionType === "list" || contributionType === "ranking") {
        const entries = structuredEntries.split("\n").map((entry) => entry.trim()).filter(Boolean)
        if (entries.length < 2) throw new Error("Add at least two separate entries, one per line.")
        if (entries.length > 40 || entries.some((entry) => entry.length > 240)) {
          throw new Error("Use up to 40 entries, with no more than 240 characters per entry.")
        }
        payload.items = entries
      } else if (contributionType === "poll") {
        const options = structuredEntries.split("\n").map((entry) => entry.trim()).filter(Boolean)
        if (!content.trim()) throw new Error("Add a question for this poll contribution.")
        if (options.length < 2 || options.length > 10 || options.some((option) => option.length > 160)) {
          throw new Error("A poll contribution needs 2 to 10 options, each up to 160 characters.")
        }
        payload.options = options
      } else if (contributionType === "link") {
        let parsed: URL
        try {
          parsed = new URL(content.trim())
        } catch {
          throw new Error("Enter a valid HTTPS link.")
        }
        if (parsed.protocol !== "https:") throw new Error("Links must use HTTPS.")
        payload.url = parsed.toString()
      }

      const response = await fetch("/api/v1/chains/" + encodeURIComponent(chainId) + "/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          contribution_type: contributionType,
          title: title.trim() || null,
          content: content.trim(),
          parent_contribution_id: parentContributionId,
          payload,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || result.error || "Could not add contribution")
      setTitle("")
      setContent("")
      setAttachment(null)
      setStructuredEntries("")
      if (attachmentInputRef.current) attachmentInputRef.current.value = ""
      setParentContributionId(null)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add contribution")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !data) {
    return <div className="mx-auto flex min-h-[55vh] max-w-4xl items-center justify-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Chain unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error || "This Chain may be private or no longer available."}</p>
        <Button className="mt-5" variant="outline" onClick={() => router.push("/chains")}><ArrowLeft className="h-4 w-4" /> Back to Chains</Button>
      </div>
    )
  }

  const { chain, contributions, can_contribute: canContribute } = data
  const requiresAttachment = ["image", "video", "audio", "document"].includes(contributionType)
  const attachmentAccept =
    contributionType === "image" ? "image/*" :
    contributionType === "video" ? "video/*" :
    contributionType === "audio" ? "audio/*" :
    ".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,text/plain"
  const contributionDepths = new Map<string, number>()
  for (const item of [...contributions].sort((left, right) => left.position - right.position)) {
    const parentDepth = item.parent_contribution_id ? contributionDepths.get(item.parent_contribution_id) : undefined
    contributionDepths.set(item.id, item.parent_contribution_id ? Math.min(4, (parentDepth ?? -1) + 1) : 0)
  }
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <Link href="/chains" className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All Chains</Link>

      <article className="mt-5 overflow-hidden rounded-[28px] border border-border bg-card">
        <div className="relative min-h-40 overflow-hidden border-b border-border bg-muted sm:min-h-56" style={{ backgroundImage: chain.cover_image_url ? "url(" + chain.cover_image_url + ")" : "radial-gradient(75% 130% at 90% 0%, hsl(var(--primary) / 0.32), transparent 75%)", backgroundSize: "cover", backgroundPosition: "center" }}>
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
          <div className="relative flex min-h-40 flex-col justify-end p-6 sm:min-h-56 sm:p-9">
            <div className="mb-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur">{chain.kind.replace(/_/g, " ")}</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1 text-[10px] font-semibold backdrop-blur"><Lock className="h-3 w-3" /> {chain.visibility}</span>
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{chain.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{chain.description}</p>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-7">
          <div>
            {chain.prompt && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">The opening prompt</p>
                <p className="mt-2 text-sm leading-relaxed">{chain.prompt}</p>
              </div>
            )}
            <div className="mt-4 flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={chain.creator_avatar_url || ""} alt={chain.creator_display_name} />
                <AvatarFallback>{chain.creator_display_name.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-semibold">{chain.creator_display_name}</p>
                <p className="text-xs text-muted-foreground">@{chain.creator_username} · started {dateLabel(chain.created_at)}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            <div className="rounded-xl border border-border p-3"><p className="text-xl font-bold tabular-nums">{chain.contribution_count}</p><p className="text-xs text-muted-foreground">Contributions</p></div>
            <div className="rounded-xl border border-border p-3"><p className="text-xl font-bold tabular-nums">{chain.participant_count}</p><p className="text-xs text-muted-foreground">Contributors</p></div>
            <Button type="button" variant="outline" size="sm" className="col-span-2 sm:col-span-1" onClick={() => void remixChain()} disabled={forking}>
              <GitBranch className="h-3.5 w-3.5" /> {forking ? "Creating remix…" : "Remix Chain"}
            </Button>
            {chain.circle_id && <Link href={"/communities/" + chain.circle_id} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted sm:col-span-1">Open Circle <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
            {forkError && <p role="alert" className="col-span-2 text-xs text-destructive">{forkError}</p>}
          </div>
        </div>
      </article>

      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">The result grows here</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">Contribution history</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><GitBranch className="h-3.5 w-3.5" /> {contributions.length} shown</span>
        </div>

        {canContribute ? (
          <form id="chain-contribution" onSubmit={contribute} className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-4 w-4 text-primary" /> Add to this Chain</div>
            {parentContributionId && (
              <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
                <span>{(() => { const parent = contributions.find((item) => item.id === parentContributionId); return parent ? `Replying to @${parent.author_username}` : "Replying to an earlier contribution" })()}</span>
                <button type="button" className="font-semibold text-primary" onClick={() => setParentContributionId(null)}>Clear</button>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <select aria-label="Contribution type" value={contributionType} onChange={(event) => {
                setContributionType(event.target.value)
                setStructuredEntries("")
                setAttachment(null)
                if (attachmentInputRef.current) attachmentInputRef.current.value = ""
              }} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="text">Text</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
                <option value="document">Document</option>
                <option value="link">Link</option>
                <option value="list">List item</option>
                <option value="ranking">Ranking entry</option>
                <option value="poll">Poll contribution</option>
              </select>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Optional contribution title" />
            </div>
            {requiresAttachment && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                <label htmlFor="chain-attachment" className="text-sm font-medium">
                  {contributionType === "document" ? "Attach a document" : `Attach an ${contributionType}`}
                </label>
                <input
                  ref={attachmentInputRef}
                  id="chain-attachment"
                  type="file"
                  accept={attachmentAccept}
                  disabled={submitting}
                  onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-foreground"
                />
                <p className="text-[11px] text-muted-foreground">
                  {attachment ? `${attachment.name} · ${(attachment.size / 1024 / 1024).toFixed(1)} MB` : "The file is uploaded to LOOP media storage before the contribution is published."}
                </p>
              </div>
            )}
            <Textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={8000} rows={4} placeholder={contributionType === "link" ? "Paste an HTTPS link and add context…" : contributionType === "poll" ? "Ask a clear question for this poll…" : "Add your part. Give it context so the next person can build on it…"} />
            {["list", "ranking", "poll"].includes(contributionType) && (
              <div className="space-y-2">
                <label htmlFor="chain-structured-entries" className="text-sm font-medium">
                  {contributionType === "poll" ? "Poll options" : contributionType === "ranking" ? "Ranked entries" : "List entries"}
                </label>
                <Textarea
                  id="chain-structured-entries"
                  value={structuredEntries}
                  onChange={(event) => setStructuredEntries(event.target.value)}
                  maxLength={10000}
                  rows={4}
                  placeholder={contributionType === "poll" ? "One option per line (2–10 options)" : "One entry per line (2–40 entries)"}
                />
                <p className="text-[11px] text-muted-foreground">Each line becomes its own structured entry.</p>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting || (!content.trim() && !title.trim() && !attachment && !structuredEntries.trim()) || (requiresAttachment && !attachment)}>
                <Send className="h-4 w-4" /> {submitting ? "Adding…" : "Contribute"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            {authLoading ? "Checking your access…" : user ? "This Chain is not accepting contributions from your account." : "Sign in to contribute to this Chain."}
            {!user && !authLoading && <Button className="ml-3" size="sm" onClick={() => router.push("/auth?returnTo=/chains/" + encodeURIComponent(chainId))}>Sign in</Button>}
          </div>
        )}

        {error && !canContribute && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {contributions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><GitBranch className="h-5 w-5" /></div>
            <h3 className="mt-3 font-semibold">Be the first to add something.</h3>
            <p className="mt-1 text-sm text-muted-foreground">The opening contribution is waiting to happen.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contributions.map((contribution, index) => (
              <article key={contribution.id} style={{ marginLeft: `${(contributionDepths.get(contribution.id) || 0) * 18}px` }} className="relative rounded-2xl border border-border bg-card p-4 sm:p-5">
                {index > 0 && <span className="absolute -top-3 left-7 h-3 w-px bg-border" />}
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={contribution.author_avatar_url || ""} alt={contribution.author_display_name} />
                    <AvatarFallback>{contribution.author_display_name.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{contribution.author_display_name}</p>
                      <span className="text-xs text-muted-foreground">@{contribution.author_username}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">{dateLabel(contribution.created_at)}</span>
                    </div>
                    {contribution.title && <h3 className="mt-2 font-semibold">{contribution.title}</h3>}
                    {contribution.content && contribution.contribution_type !== "link" && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{contribution.content}</p>}
                    {(contribution.contribution_type === "list" || contribution.contribution_type === "ranking") && Array.isArray(contribution.payload.items) && (
                      <ol className="mt-3 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                        {(contribution.payload.items as unknown[]).filter((entry): entry is string => typeof entry === "string").map((entry, entryIndex) => (
                          <li key={`${contribution.id}:${entryIndex}`} className="flex items-start gap-2 text-sm">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{contribution.contribution_type === "ranking" ? entryIndex + 1 : "•"}</span>
                            <span>{entry}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {contribution.contribution_type === "poll" && Array.isArray(contribution.payload.options) && (
                      <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Poll contribution · options</p>
                        {(contribution.payload.options as unknown[]).filter((option): option is string => typeof option === "string").map((option, optionIndex) => (
                          <div key={`${contribution.id}:option:${optionIndex}`} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">{option}</div>
                        ))}
                      </div>
                    )}
                    {contribution.contribution_type === "image" && getSecurePayloadUrl(contribution.payload) && (
                      <ProxyImg src={getSecurePayloadUrl(contribution.payload) || ""} alt={contribution.title || "Chain contribution"} className="mt-3 max-h-[420px] w-auto max-w-full rounded-xl object-contain" />
                    )}
                    {contribution.contribution_type === "video" && getSecurePayloadUrl(contribution.payload) && (
                      <video src={getSecurePayloadUrl(contribution.payload) || undefined} controls preload="metadata" className="mt-3 max-h-[420px] w-full rounded-xl bg-black" />
                    )}
                    {contribution.contribution_type === "audio" && getSecurePayloadUrl(contribution.payload) && (
                      <audio src={getSecurePayloadUrl(contribution.payload) || undefined} controls preload="metadata" className="mt-3 w-full" />
                    )}
                    {(contribution.contribution_type === "document" || contribution.contribution_type === "link") && getSecurePayloadUrl(contribution.payload) && (
                      <a href={getSecurePayloadUrl(contribution.payload) || "#"} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-primary hover:bg-muted">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        {contribution.contribution_type === "document"
                          ? String(contribution.payload.file_name || "Open document")
                          : "Open link"}
                      </a>
                    )}
                    {contribution.parent_contribution_id && <p className="mt-2 text-[11px] text-muted-foreground">Part of a contribution thread</p>}
                    {user?.id === contribution.author_id && (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button type="button" onClick={() => beginEdit(contribution)} className="text-xs font-semibold text-primary hover:underline">Edit contribution</button>
                        <button type="button" onClick={() => void toggleRevisionHistory(contribution.id)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                          {expandedHistory === contribution.id ? "Hide history" : "Revision history"}
                        </button>
                      </div>
                    )}
                    {editingContributionId === contribution.id && (
                      <div className="mt-3 space-y-2 rounded-xl border border-primary/20 bg-muted/20 p-3">
                        <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} maxLength={120} placeholder="Contribution title" />
                        <Textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} maxLength={8000} rows={3} placeholder="Update your contribution text" />
                        <p className="text-[11px] text-muted-foreground">Existing attachments and structured data are preserved. Each save records the previous version.</p>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingContributionId(null)} disabled={savingContribution}>Cancel</Button>
                          <Button type="button" size="sm" onClick={() => void saveContributionEdit(contribution)} disabled={savingContribution}>
                            {savingContribution ? "Saving…" : "Save revision"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {expandedHistory === contribution.id && (
                      <div className="mt-3 rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Previous versions</p>
                        {revisionLoading === contribution.id ? (
                          <p className="mt-2 text-xs text-muted-foreground">Loading history…</p>
                        ) : (revisionHistory[contribution.id] || []).length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">No previous versions have been saved yet.</p>
                        ) : (
                          <ol className="mt-2 space-y-3">
                            {(revisionHistory[contribution.id] || []).map((revision) => (
                              <li key={revision.id} className="border-t border-border pt-2 text-xs">
                                <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                                  <span>Revision {revision.revision_number} · @{revision.editor_username}</span>
                                  <time dateTime={revision.created_at}>{dateLabel(revision.created_at)}</time>
                                </div>
                                {revision.title && <p className="mt-1 font-semibold">{revision.title}</p>}
                                {revision.content && <p className="mt-1 whitespace-pre-wrap">{revision.content}</p>}
                              </li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                    {canContribute && (
                      <button type="button" onClick={() => { setParentContributionId(contribution.id); document.getElementById("chain-contribution")?.scrollIntoView({ behavior: "smooth", block: "center" }) }} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        Reply to this <ArrowUpRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {data.contributions_has_more && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={() => void loadMoreContributions()} disabled={loadingMore}>
              {loadingMore ? "Loading contributions…" : "Load more contributions"}
            </Button>
          </div>
        )}
      </section>

      <div className="mt-8 flex items-center justify-between border-t border-border pt-5 text-xs text-muted-foreground">
        <span>Created for collaboration, not follower counts.</span>
        <Link href="/explore" className="font-semibold text-primary hover:underline">Discover more</Link>
      </div>
    </main>
  )
}

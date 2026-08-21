"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  Copy,
  Heart,
  Loader2,
  Plus,
  Search,
  Terminal,
  Trash2,
  Check,
} from "lucide-react"

interface SnippetAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  is_verified?: boolean
}

interface Snippet {
  id: string
  title: string
  description?: string | null
  language: string
  code: string
  tags?: string[]
  views?: number
  like_count: number
  is_liked: boolean
  is_public?: boolean
  author?: SnippetAuthor
  created_at: string
}

const LANGUAGES = [
  "All",
  "JavaScript",
  "TypeScript",
  "Python",
  "Go",
  "Rust",
  "Java",
  "C++",
  "C#",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "SQL",
  "Bash",
  "HTML",
  "CSS",
  "Other",
]

function timeAgo(iso?: string) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`
  if (ms < 86_400_000 * 7) return `${Math.floor(ms / 86_400_000)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function DeveloperSnippets() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, LoginGateDialog } = useLoginGate()

  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [loading, setLoading] = useState(true)
  const [language, setLanguage] = useState("All")
  const [search, setSearch] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [draft, setDraft] = useState({
    title: "",
    description: "",
    language: "TypeScript",
    code: "",
    tags: "",
  })

  const fetchSnippets = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (language !== "All") params.set("language", language)
      const res = await fetch(`/api/developers/snippets?${params}`, {
        headers: user ? getAuthHeader() : undefined,
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load snippets")
      setSnippets(data.snippets || [])
    } catch (err: any) {
      toast({ title: "Snippets unavailable", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [language, user, getAuthHeader, toast])

  useEffect(() => {
    void fetchSnippets()
  }, [fetchSnippets])

  // Realtime: new snippets / deletions show up instantly.
  useEffect(() => {
    const channel = supabase.channel("dev-snippets:live")

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "code_snippets" },
        (payload) => {
          if (!payload.new) return
          void fetchSnippets()
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "code_snippets" },
        () => void fetchSnippets(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = snippets.filter((snippet) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      snippet.title.toLowerCase().includes(q) ||
      (snippet.description || "").toLowerCase().includes(q) ||
      snippet.language.toLowerCase().includes(q) ||
      (snippet.tags || []).some((t) => t.toLowerCase().includes(q))
    )
  })

  const createSnippet = async () => {
    if (!requireAuth("post")) return
    if (!draft.title.trim() || !draft.code.trim()) {
      toast({ title: "Title and code are required", variant: "destructive" })
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/developers/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: draft.title.trim(),
          description: draft.description.trim(),
          language: draft.language,
          code: draft.code,
          tags: draft.tags
            .split(/[\s,#]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create snippet")
      toast({ title: "Snippet shared" })
      setCreateOpen(false)
      setDraft({ title: "", description: "", language: "TypeScript", code: "", tags: "" })
      await fetchSnippets()
    } catch (err: any) {
      toast({ title: "Couldn't share snippet", description: err.message, variant: "destructive" })
    } finally {
      setCreating(false)
    }
  }

  const copySnippet = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.code)
    setCopiedId(snippet.id)
    toast({ title: "Copied to clipboard" })
    window.setTimeout(() => setCopiedId(null), 1600)
  }

  const toggleLike = async (snippet: Snippet) => {
    if (!requireAuth("like")) return
    setBusyId(snippet.id)
    try {
      const res = await fetch(`/api/developers/snippets/${snippet.id}/like`, {
        method: "POST",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update like")
      setSnippets((prev) =>
        prev.map((s) =>
          s.id === snippet.id
            ? { ...s, is_liked: data.liked, like_count: Number(data.like_count) }
            : s,
        ),
      )
    } catch (err: any) {
      toast({ title: "Couldn't like snippet", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  const deleteSnippet = async (snippet: Snippet) => {
    if (!window.confirm(`Delete "${snippet.title}"? This can't be undone.`)) return
    setBusyId(snippet.id)
    try {
      const res = await fetch(`/api/developers/snippets/${snippet.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete snippet")
      setSnippets((prev) => prev.filter((s) => s.id !== snippet.id))
      toast({ title: "Snippet deleted" })
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      {LoginGateDialog}

      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search snippets, tags…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <Button
                onClick={() => setCreateOpen(true)}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500"
              >
                <Plus className="h-4 w-4 mr-2" />
                Share snippet
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading snippets…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
          <Terminal className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">
            {search || language !== "All" ? "No snippets match your filters" : "No code snippets yet"}
          </p>
          <p className="text-sm text-muted-foreground">
            {search || language !== "All"
              ? "Try a different search or language."
              : "Share that one-liner or tricky util the community will love."}
          </p>
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)} className="rounded-full">
            <Plus className="h-4 w-4 mr-2" />
            Share the first snippet
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((snippet) => (
            <Card key={snippet.id} className="overflow-hidden border-border/60 transition hover:border-cyan-500/30">
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <VideoAvatar
                      src={snippet.author?.avatar_url}
                      videoSrc={(snippet.author as any)?.video_avatar_url}
                      isPremium={(snippet.author as any)?.is_premium}
                      fallback={(snippet.author?.display_name || "U").charAt(0)}
                      size="sm"
                      className="h-8 w-8 rounded-full"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{snippet.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{snippet.author?.username || "user"} · {timeAgo(snippet.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full text-[10px]">{snippet.language}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => copySnippet(snippet)}
                      title="Copy code"
                    >
                      {copiedId === snippet.id ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    {user && snippet.author?.id === user.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteSnippet(snippet)}
                        disabled={busyId === snippet.id}
                        title="Delete snippet"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {snippet.description && (
                  <p className="px-4 pt-3 text-sm text-muted-foreground line-clamp-2">{snippet.description}</p>
                )}

                <pre className="max-h-48 overflow-auto bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed text-foreground/90">
                  <code>{snippet.code.slice(0, 4000)}{snippet.code.length > 4000 ? "\n…" : ""}</code>
                </pre>

                <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {(snippet.tags || []).slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full text-[10px]">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={cn("h-8 gap-1.5 rounded-full text-xs", snippet.is_liked && "text-rose-500")}
                    onClick={() => void toggleLike(snippet)}
                    disabled={busyId === snippet.id}
                  >
                    <Heart className={cn("h-3.5 w-3.5", snippet.is_liked && "fill-current")} />
                    {snippet.like_count || 0}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-cyan-500" />
              Share a code snippet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="snippet-title">Title *</Label>
                <Input
                  id="snippet-title"
                  placeholder="e.g. Debounce a fetch with AbortController"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="snippet-language">Language *</Label>
                <Select value={draft.language} onValueChange={(v) => setDraft((d) => ({ ...d, language: v }))}>
                  <SelectTrigger id="snippet-language">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.filter((l) => l !== "All").map((lang) => (
                      <SelectItem key={lang} value={lang}>
                        {lang}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="snippet-desc">Description</Label>
              <Input
                id="snippet-desc"
                placeholder="What does it do?"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snippet-code">Code *</Label>
              <Textarea
                id="snippet-code"
                placeholder="Paste your snippet…"
                value={draft.code}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                rows={10}
                className="min-h-[180px] font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snippet-tags">Tags</Label>
              <Input
                id="snippet-tags"
                placeholder="react hooks fetch (space separated)"
                value={draft.tags}
                onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void createSnippet()}
                disabled={creating || !draft.title.trim() || !draft.code.trim()}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 text-white"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Share snippet
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

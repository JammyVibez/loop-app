"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Hash, Loader2, Search, TrendingUp, Users } from "lucide-react"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"

type SuggestUser = {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
}

export default function SearchLandingPage() {
  const router = useRouter()
  const { getAuthHeader } = useAuth()
  const [q, setQ] = useState("")
  const [users, setUsers] = useState<SuggestUser[]>([])
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState<string[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) {
        setUsers([])
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/users?q=${encodeURIComponent(q.trim())}&limit=6`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        })
        const data = await res.json().catch(() => ({}))
        setUsers(data.users || data.data || [])
      } catch {
        setUsers([])
      } finally {
        setLoading(false)
      }
    }, 220)
    return () => clearTimeout(t)
  }, [q, getAuthHeader])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/explore/trending?limit=8", { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        const tags =
          data.hashtags?.map((h: any) => String(h.tag || h).replace(/^#/, "")) ||
          data.trending_hashtags?.map((h: any) => String(h.tag || h).replace(/^#/, "")) ||
          []
        setTrending(tags.filter(Boolean).slice(0, 8))
      } catch {
        setTrending(["loop", "music", "code", "art"])
      }
    })()
  }, [])

  const go = (term?: string) => {
    const value = (term ?? q).trim()
    if (!value) return
    router.push(`/search/${encodeURIComponent(value)}`)
  }

  return (
    <div className="min-h-screen bg-background pb-[4.25rem] lg:pb-0">
      <Header />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
          <p className="text-sm text-muted-foreground">Find people, loops, tags, and communities</p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            go()
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search @users, keywords, #tags…"
              className="rounded-full pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" className="rounded-full">
            Search
          </Button>
        </form>

        {q.trim().length >= 2 && (
          <div className="rounded-2xl border border-border/60 bg-card/40">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> People
              </span>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </div>
            {users.length === 0 && !loading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">No people match yet — press Search for full results.</p>
            ) : (
              <ul className="divide-y divide-border/50">
                {users.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/profile/${u.username}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={u.avatar_url} />
                        <AvatarFallback>{(u.display_name || u.username || "?").charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.display_name || u.username}</p>
                        <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => go()}
              className="w-full border-t border-border/50 px-4 py-3 text-left text-sm font-medium text-sky-600 hover:bg-muted/30"
            >
              Search all for “{q.trim()}”
            </button>
          </div>
        )}

        {trending.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" /> Trending tags
            </h2>
            <div className="flex flex-wrap gap-2">
              {trending.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => go(`#${tag}`)}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-sm hover:bg-muted/60"
                >
                  <Hash className="h-3.5 w-3.5 text-sky-500" />
                  {tag}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
      <div className="lg:hidden">
        <MobileBottomNav />
      </div>
    </div>
  )
}

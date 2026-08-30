"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Hash, Loader2, Search, TrendingUp, Users, X, Clock, ArrowRight, Flame, Sparkles, Zap } from "lucide-react"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

type SuggestUser = {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  is_verified?: boolean
  is_premium?: boolean
}

const STORAGE_KEY = "loop_recent_searches"
const MAX_RECENT = 8

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

function saveRecentSearch(term: string) {
  if (typeof window === "undefined") return
  const recent = getRecentSearches().filter((r) => r !== term)
  recent.unshift(term)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

function removeRecentSearch(term: string) {
  if (typeof window === "undefined") return
  const recent = getRecentSearches().filter((r) => r !== term)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
}

const CATEGORIES = [
  { label: "Users", icon: Users, query: "@" },
  { label: "Tags", icon: Hash, query: "#" },
  { label: "Loops", icon: Flame, query: "" },
  { label: "Trending", icon: TrendingUp, query: "#trending" },
]

export default function SearchLandingPage() {
  const router = useRouter()
  const { getAuthHeader } = useAuth()
  const [q, setQ] = useState("")
  const [users, setUsers] = useState<SuggestUser[]>([])
  const [loading, setLoading] = useState(false)
  const [trending, setTrending] = useState<string[]>([])
  const [trendingUsers, setTrendingUsers] = useState<SuggestUser[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])

  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

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
        const [trendingRes, usersRes] = await Promise.all([
          fetch("/api/explore/trending?limit=8", { cache: "no-store" }),
          fetch("/api/users?sort=newest&limit=6", { cache: "no-store" }),
        ])
        const trendingData = await trendingRes.json().catch(() => ({}))
        const tags =
          trendingData.hashtags?.map((h: any) => String(h.tag || h).replace(/^#/, "")) ||
          trendingData.trending_hashtags?.map((h: any) => String(h.tag || h).replace(/^#/, "")) ||
          []
        setTrending(tags.filter(Boolean).slice(0, 8))

        const usersData = await usersRes.json().catch(() => ({}))
        setTrendingUsers((usersData.users || usersData.data || []).slice(0, 6))
      } catch {
        setTrending(["loop", "music", "code", "art"])
      }
    })()
  }, [])

  const go = useCallback(
    (term?: string) => {
      const value = (term ?? q).trim()
      if (!value) return
      saveRecentSearch(value)
      setRecentSearches(getRecentSearches())
      router.push(`/search/${encodeURIComponent(value)}`)
    },
    [q, router],
  )

  const clearRecent = () => {
    localStorage.removeItem(STORAGE_KEY)
    setRecentSearches([])
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

        {/* Live People Suggestions */}
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
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-medium">{u.display_name || u.username}</p>
                          {u.is_verified && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] border-blue-500/30 text-blue-500">✓</Badge>
                          )}
                        </div>
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
              Search all for &ldquo;{q.trim()}&rdquo;
            </button>
          </div>
        )}

        {/* Category Quick Links */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Browse</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => go(cat.query)}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <cat.icon className="h-4 w-4 text-primary" />
                </div>
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        {/* Recent Searches */}
        {recentSearches.length > 0 && q.trim().length < 2 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Recent
              </h2>
              <button type="button" onClick={clearRecent} className="text-xs text-muted-foreground hover:text-foreground">
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((term) => (
                <div key={term} className="group flex items-center gap-1 rounded-full border border-border/60 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => go(term)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-muted/60 rounded-l-full"
                  >
                    {term.startsWith("#") ? <Hash className="h-3.5 w-3.5 text-sky-500" /> : term.startsWith("@") ? <Users className="h-3.5 w-3.5 text-violet-500" /> : <Search className="h-3.5 w-3.5 text-muted-foreground" />}
                    {term}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeRecentSearch(term)
                      setRecentSearches(getRecentSearches())
                    }}
                    className="mr-1 rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending Tags */}
        {trending.length > 0 && q.trim().length < 2 && (
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
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-sm hover:bg-muted/60 transition-colors"
                >
                  <Hash className="h-3.5 w-3.5 text-sky-500" />
                  {tag}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Trending Users */}
        {trendingUsers.length > 0 && q.trim().length < 2 && (
          <section>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Suggested users
            </h2>
            <div className="space-y-1 rounded-2xl border border-border/60 bg-card/40 divide-y divide-border/50">
              {trendingUsers.map((u) => (
                <Link
                  key={u.id}
                  href={`/profile/${u.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback>{(u.display_name || u.username || "?").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium">{u.display_name || u.username}</p>
                      {u.is_verified && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] border-blue-500/30 text-blue-500">✓</Badge>
                      )}
                      {u.is_premium && (
                        <Badge variant="outline" className="h-4 px-1 text-[9px] border-amber-500/30 text-amber-500">PRO</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">@{u.username}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
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

"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight, Bookmark, GitBranch, Hash, Search, Users } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/skeletons"

type SearchRecord = Record<string, any>
type SocialSearchPayload = {
  loops?: SearchRecord[]
  users?: SearchRecord[]
  circles?: SearchRecord[]
  hashtags?: SearchRecord[]
}
type ChainSearchPayload = { chains?: SearchRecord[] }
type CollectionSearchPayload = SearchRecord[]
type SearchResults = {
  loops: SearchRecord[]
  users: SearchRecord[]
  circles: SearchRecord[]
  hashtags: SearchRecord[]
  chains: SearchRecord[]
  collections: SearchRecord[]
}

const EMPTY_RESULTS: SearchResults = {
  loops: [],
  users: [],
  circles: [],
  hashtags: [],
  chains: [],
  collections: [],
}

function ResultSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  )
}

function ResultCard({
  href,
  title,
  description,
  meta,
}: {
  href: string
  title: string
  description?: string
  meta?: string
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full rounded-2xl border-border/70 transition-colors group-hover:border-primary/40">
        <CardContent className="flex h-full min-h-28 flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-semibold group-hover:text-primary">{title}</h3>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </div>
          {description && <p className="line-clamp-2 text-sm text-muted-foreground">{description}</p>}
          {meta && <p className="mt-auto text-xs text-muted-foreground">{meta}</p>}
        </CardContent>
      </Card>
    </Link>
  )
}

export function ExploreSearchResults({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  const { getAuthHeader } = useAuth()
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    setLoading(true)
    setError("")

    const load = async () => {
      const value = query.trim()
      if (!value) {
        setResults(EMPTY_RESULTS)
        setLoading(false)
        return
      }

      const headers = getAuthHeader()
      const requests = await Promise.allSettled([
        fetch(
          "/api/search?q=" + encodeURIComponent(value) + "&type=all&limit=12",
          { headers, cache: "no-store", signal: controller.signal },
        ).then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || "Social search failed")
          return data as SocialSearchPayload
        }),
        fetch(
          "/api/v1/chains?" + new URLSearchParams({ search: value, limit: "12", sort: "recent" }),
          { headers, cache: "no-store", signal: controller.signal },
        ).then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.message || data.error || "Chain search failed")
          return data as ChainSearchPayload
        }),
        fetch(
          "/api/v1/collections?" + new URLSearchParams({ search: value, limit: "12" }),
          { headers, cache: "no-store", signal: controller.signal },
        ).then(async (response) => {
          const data = await response.json()
          if (!response.ok) throw new Error(data.message || data.error || "Collection search failed")
          return data as CollectionSearchPayload
        }),
      ])

      if (!active) return
      const [social, chains, collections] = requests

      if (requests.every((item) => item.status === "rejected")) {
        const firstError = requests.find((item) => item.status === "rejected")
        setError(firstError?.status === "rejected" && firstError.reason instanceof Error
          ? firstError.reason.message
          : "Search is temporarily unavailable.")
        setResults(EMPTY_RESULTS)
      } else {
        setResults({
          loops: social.status === "fulfilled" ? social.value.loops || [] : [],
          users: social.status === "fulfilled" ? social.value.users || [] : [],
          circles: social.status === "fulfilled" ? social.value.circles || [] : [],
          hashtags: social.status === "fulfilled" ? social.value.hashtags || [] : [],
          chains: chains.status === "fulfilled" ? chains.value.chains || [] : [],
          collections: collections.status === "fulfilled" && Array.isArray(collections.value)
            ? collections.value
            : [],
        })
        if (requests.some((item) => item.status === "rejected")) {
          setError("Some result types could not be loaded. Available results are still shown.")
        }
      }
      setLoading(false)
    }

    void load().catch((cause) => {
      if (!active || controller.signal.aborted) return
      setError(cause instanceof Error ? cause.message : "Search is temporarily unavailable.")
      setLoading(false)
    })

    return () => {
      active = false
      controller.abort()
    }
  }, [getAuthHeader, query])

  const total = Object.values(results).reduce((sum, items) => sum + items.length, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Search results</p>
          <h1 className="mt-1 text-xl font-semibold">{query}</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onClear}>Back to Discover</Button>
      </div>

      {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner className="h-5 w-5" /> Searching LOOP…
        </div>
      ) : total === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="h-6 w-6 text-muted-foreground" />
            <h2 className="font-semibold">No results found</h2>
            <p className="text-sm text-muted-foreground">Try a different name, topic or phrase.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Showing {total} matching results across public content and communities.</p>

          {results.chains.length > 0 && (
            <ResultSection title="Chains" icon={<GitBranch className="h-4 w-4" />}>
              {results.chains.map((item) => (
                <ResultCard key={item.id} href={"/chains/" + item.id} title={item.title}
                  description={item.description || item.prompt}
                  meta={(item.contribution_count ?? 0) + " contributions · " + (item.participant_count ?? 0) + " contributors"} />
              ))}
            </ResultSection>
          )}

          {results.collections.length > 0 && (
            <ResultSection title="Collections" icon={<Bookmark className="h-4 w-4" />}>
              {results.collections.map((item) => (
                <ResultCard key={item.id} href={"/collections/" + item.id} title={item.title}
                  description={item.description} meta={(item.item_count ?? 0) + " saved items"} />
              ))}
            </ResultSection>
          )}

          {results.circles.length > 0 && (
            <ResultSection title="Circles" icon={<Users className="h-4 w-4" />}>
              {results.circles.map((item) => (
                <ResultCard key={item.id} href={"/circles/" + (item.slug || item.id)} title={item.name}
                  description={item.description} meta={(item.member_count ?? 0) + " members"} />
              ))}
            </ResultSection>
          )}

          {results.users.length > 0 && (
            <ResultSection title="People" icon={<Users className="h-4 w-4" />}>
              {results.users.map((item) => (
                <ResultCard key={item.id} href={"/profile/" + item.username}
                  title={item.display_name || item.username} description={item.bio}
                  meta={"@" + item.username + (item.is_verified ? " · Verified" : "")} />
              ))}
            </ResultSection>
          )}

          {results.loops.length > 0 && (
            <ResultSection title="Loops" icon={<Search className="h-4 w-4" />}>
              {results.loops.map((item) => (
                <ResultCard key={item.id} href={"/loop/" + item.id}
                  title={item.content_title || item.content_text?.slice(0, 72) || "Loop"}
                  description={item.content_text || item.description}
                  meta={item.author?.username ? "by @" + item.author.username : "Loop"} />
              ))}
            </ResultSection>
          )}

          {results.hashtags.length > 0 && (
            <ResultSection title="Hashtags" icon={<Hash className="h-4 w-4" />}>
              {results.hashtags.map((item) => {
                const tag = String(item.tag || "").replace(/^#/, "")
                return <ResultCard key={tag} href={"/hashtag/" + encodeURIComponent(tag)}
                  title={"#" + tag} meta={(item.usage_count ?? item.count ?? 0) + " uses"} />
              })}
            </ResultSection>
          )}
        </>
      )}
    </div>
  )
}

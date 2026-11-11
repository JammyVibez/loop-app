"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "@/components/icons/lucide-compat"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { SearchResults } from "@/components/search/search-results"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "loop_recent_searches"
const MAX_RECENT = 8

function saveRecentSearch(term: string) {
  try {
    const recent = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[]
    localStorage.setItem(STORAGE_KEY, JSON.stringify([term, ...recent.filter((item) => item !== term)].slice(0, MAX_RECENT)))
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([term]))
  }
}

interface SearchPageProps {
  params: Promise<{ query: string }>
}

export default function SearchQueryPage({ params }: SearchPageProps) {
  const { query } = use(params)
  const decodedQuery = decodeURIComponent(query)
  const [searchQuery, setSearchQuery] = useState(decodedQuery)
  const router = useRouter()

  useEffect(() => {
    setSearchQuery(decodedQuery)
    saveRecentSearch(decodedQuery)
  }, [decodedQuery])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    saveRecentSearch(q)
    router.push(`/search/${encodeURIComponent(q)}`)
  }

  return (
    <div className="min-h-screen bg-background pb-[4.25rem] lg:pb-0">
      <Header />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search</h1>
          <p className="text-sm text-muted-foreground">People, Loops, Chains, Collections, hashtags, and Circles</p>
        </div>

        <form onSubmit={submit} className="sticky top-16 z-20 flex gap-2 rounded-2xl border border-border/70 bg-background/90 p-2 backdrop-blur-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search @users, keywords, #tags…"
              className="h-11 rounded-xl border-transparent bg-muted/50 pl-9 focus-visible:border-amber-500/40 focus-visible:ring-amber-500/20"
            />
          </div>
          <Button type="submit" className="h-11 rounded-xl bg-amber-500 px-5 text-black hover:bg-amber-400">
            Search
          </Button>
        </form>

        <SearchResults query={decodedQuery} />
      </main>
      <div className="lg:hidden">
        <MobileBottomNav />
      </div>
    </div>
  )
}

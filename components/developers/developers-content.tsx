"use client"

import React, { useMemo, useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Code, Plus, Search, BookOpen, LayoutTemplate, GitFork, Star, Boxes, RefreshCw, Zap, Terminal, UserRound, Target, Trophy } from "lucide-react"
import { CreateProjectDialog } from "@/components/developers/create-project-dialog"
import { CodeLoopCard } from "@/components/developers/code-loop-card"
import { DeveloperSnippets } from "@/components/developers/developer-snippets"
import { DeveloperProfilePanel } from "@/components/developers/developer-profile-panel"
import { DeveloperQuests } from "@/components/developers/developer-quests"
import { DeveloperLeaderboard } from "@/components/developers/developer-leaderboard"
import { AdCard, type AdData } from "@/components/ads/ad-card"
import { useAuth } from "@/hooks/use-auth"
import { Spinner } from "@/components/ui/skeletons"

function normalizeProject(row: any) {
  return {
    id: row.id,
    author_id: row.author_id || row.author?.id,
    title: row.title,
    description: row.description,
    author: row.author || { username: "unknown", display_name: "Unknown", avatar_url: null },
    language: row.language,
    framework: row.framework || "None",
    tags: row.tags || [],
    stats: {
      stars: Number(row.stars || 0),
      forks: Number(row.forks || 0),
      views: Number(row.views || 0),
      branches: Number(row.branches || 0),
    },
    code_snippet: row.code_snippet || "",
    files: Array.isArray(row.files) ? row.files : [],
    file_tree: Array.isArray(row.file_tree) ? row.file_tree : [],
    repo_zip_url: row.repo_zip_url || null,
    forked_from_id: row.forked_from_id || null,
    is_public: row.is_public !== false,
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
  }
}

const languages = ["All", "JavaScript", "Python", "TypeScript", "Go", "Rust", "Java", "C++"]
const frameworks = ["All", "React", "Vue", "Angular", "Node.js", "Django", "Flask", "Express"]

export function DevelopersContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<ReturnType<typeof normalizeProject>[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState("All")
  const [selectedFramework, setSelectedFramework] = useState("All")
  const [sortBy, setSortBy] = useState("recent")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("projects")



  // Ads on the Developer Hub — eligibility is decided server-side so Pro
  // users and Sponsors are always excluded. The client only places the card.
  const [devAds, setDevAds] = useState<AdData[]>([])
  const [adsEligible, setAdsEligible] = useState(false)
  const devAdsSessionId = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `devsess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    [],
  )

  React.useEffect(() => {
    let cancelled = false
    const token = user?.access_token || user?.token
    ;(async () => {
      try {
        const eligibilityRes = await fetch("/api/ads/feed?surface=developers", {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store",
        })
        const eligibility = await eligibilityRes.json().catch(() => ({ eligible: false }))
        if (cancelled || !eligibility.eligible) return
        const adsRes = await fetch("/api/ads/feed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 1, surface: "developers" }),
          cache: "no-store",
        })
        const adsData = await adsRes.json().catch(() => ({ ads: [] }))
        if (cancelled || !adsData.ads?.length) return
        setDevAds(adsData.ads)
        setAdsEligible(true)
      } catch {
        // Ads are progressive enhancement — never break the hub.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Fetch real projects from the database — never fall back to fake/mock data.
  const fetchProjects = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams()
      if (selectedLanguage !== "All") params.append('language', selectedLanguage)
      if (selectedFramework !== "All") params.append('framework', selectedFramework)
      params.append('sortBy', sortBy)

      const response = await fetch(`/api/developers/projects?${params}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to load projects")
      setProjects((data.projects || []).map(normalizeProject))
    } catch (err: any) {
      console.error('Error fetching projects:', err)
      setError(err.message || "Couldn't load developer projects")
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch projects when filters change
  React.useEffect(() => {
    fetchProjects()
  }, [selectedLanguage, selectedFramework, sortBy])

  const filteredProjects = projects.filter((project) => {
    const matchesLanguage = selectedLanguage === "All" || project.language === selectedLanguage
    const matchesFramework = selectedFramework === "All" || project.framework === selectedFramework
    const q = searchQuery.trim().toLowerCase()
    const matchesSearch =
      !q ||
      project.title.toLowerCase().includes(q) ||
      (project.description || "").toLowerCase().includes(q) ||
      project.tags.some((t: string) => t.toLowerCase().includes(q))
    return matchesLanguage && matchesFramework && matchesSearch
  })

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.created_at.getTime() - a.created_at.getTime()
      case "popular":
        return b.stats.stars - a.stats.stars
      case "most_forked":
        return b.stats.forks - a.stats.forks
      default:
        return 0
    }
  })

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const stats = useMemo(() => {
    const languages = new Set(projects.map((p) => p.language).filter(Boolean))
    return {
      projects: projects.length,
      languages: languages.size,
      stars: projects.reduce((acc, p) => acc + Number(p.stats.stars || 0), 0),
      forks: projects.reduce((acc, p) => acc + Number(p.stats.forks || 0), 0),
    }
  }, [projects])

  return (
    <>
      <div className="space-y-6">
        {/* Hero / actions */}
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-cyan-500/20 bg-card border border-border p-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20">
              <Code className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Build on loopapp.me</h2>
              <p className="text-sm text-muted-foreground">
                Share code projects, snippets, and skills — then ship your work to the Marketplace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => {
                if (tab === "projects") setShowCreateDialog(true)
                else setTab("projects")
              }}
              className="rounded-full font-semibold bg-gradient-to-r from-cyan-500 to-indigo-600 text-white hover:from-cyan-400 hover:to-indigo-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              {tab === "projects" ? "Share Project" : "Go to Projects"}
            </Button>
            <Button
              asChild
              variant="outline"
              className="rounded-full border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 font-semibold"
            >
              <Link href="/developers/docs">
                <BookOpen className="w-4 h-4 mr-2 shrink-0" />
                Developer Docs
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Boxes, label: "Projects", value: stats.projects },
            { icon: Code, label: "Languages", value: stats.languages },
            { icon: Star, label: "Total stars", value: stats.stars },
            { icon: GitFork, label: "Forks", value: stats.forks },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  <stat.icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xl font-bold leading-none">{loading ? "—" : formatNumber(stat.value)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:grid-cols-5">
            <TabsTrigger value="projects" className="rounded-xl data-[state=active]:bg-background">
              <Boxes className="mr-2 h-4 w-4" /> Projects
            </TabsTrigger>
            <TabsTrigger value="snippets" className="rounded-xl data-[state=active]:bg-background">
              <Terminal className="mr-2 h-4 w-4" /> Snippets
            </TabsTrigger>
            <TabsTrigger value="quests" className="rounded-xl data-[state=active]:bg-background">
              <Target className="mr-2 h-4 w-4" /> Quests
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-xl data-[state=active]:bg-background">
              <Trophy className="mr-2 h-4 w-4" /> Leaderboard
            </TabsTrigger>
            <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-background">
              <UserRound className="mr-2 h-4 w-4" /> Dev Profile
            </TabsTrigger>
          </TabsList>

          {/* Projects tab */}
          <TabsContent value="projects" className="space-y-6 mt-0">
            {/* Filters + search */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search projects, tags…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <select
                      value={selectedLanguage}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                    >
                      {languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang}
                        </option>
                      ))}
                    </select>

                    <select
                      value={selectedFramework}
                      onChange={(e) => setSelectedFramework(e.target.value)}
                      className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                    >
                      {frameworks.map((framework) => (
                        <option key={framework} value={framework}>
                          {framework}
                        </option>
                      ))}
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground"
                    >
                      <option value="recent">Most Recent</option>
                      <option value="popular">Most Stars</option>
                      <option value="most_forked">Most Forked</option>
                    </select>
                    <Button variant="outline" size="sm" className="rounded-full" onClick={fetchProjects} title="Refresh projects">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Projects Grid */}
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading developer projects…
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-muted-foreground">
                <p>{error}</p>
                <Button size="sm" variant="outline" onClick={fetchProjects}>
                  Retry
                </Button>
              </div>
            ) : sortedProjects.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-12 text-center">
                <Code className="h-8 w-8 text-muted-foreground" />
                <p className="font-medium">
                  {searchQuery || selectedLanguage !== "All" || selectedFramework !== "All"
                    ? "No projects match your filters"
                    : "No developer projects yet"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {searchQuery || selectedLanguage !== "All" || selectedFramework !== "All"
                    ? "Try a different search or clear the filters."
                    : "Be the first to share your code with the community."}
                </p>
                {searchQuery || selectedLanguage !== "All" || selectedFramework !== "All" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("")
                      setSelectedLanguage("All")
                      setSelectedFramework("All")
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => setShowCreateDialog(true)} className="mt-2 rounded-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Share Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {sortedProjects.map((project, idx) => (
                  <React.Fragment key={project.id}>
                    {/* One ad slot mid-grid for eligible visitors (server-decided) */}
                    {adsEligible && devAds.length > 0 && idx === 2 && (
                      <div className="lg:col-span-2">
                        <AdCard ad={devAds[0]} sessionId={devAdsSessionId} />
                      </div>
                    )}
                    <CodeLoopCard
                      project={project}
                      onUpdated={() => fetchProjects()}
                      onDeleted={(id) => setProjects((prev) => prev.filter((p) => p.id !== id))}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Featured Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-cyan-500" />
                  <span>Featured Developer Resources</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="group rounded-2xl border border-border bg-gradient-to-br from-cyan-500/5 to-transparent p-5 transition hover:-translate-y-0.5 hover:border-cyan-500/40 hover:shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-500">
                        <BookOpen className="h-4 w-4" />
                      </span>
                      <h3 className="font-semibold">Loop API Documentation</h3>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Bearer-token API reference for building on Loop — loops, circles, reels, and webhooks.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["REST", "Webhooks", "Auth"].map((tag) => (
                        <Badge key={tag} variant="outline" className="rounded-full text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
                      <Link href="/developers/docs">Read the docs</Link>
                    </Button>
                  </div>

                  <div className="group rounded-2xl border border-border bg-gradient-to-br from-indigo-500/5 to-transparent p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-lg">
                    <div className="mb-3 flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
                        <LayoutTemplate className="h-4 w-4" />
                      </span>
                      <h3 className="font-semibold">Community Layout Packs</h3>
                    </div>
                    <p className="mb-4 text-sm text-muted-foreground">
                      Build marketplace packs that restyle Circles — earn coins when communities adopt them.
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Marketplace", "Themes", "Coins"].map((tag) => (
                        <Badge key={tag} variant="outline" className="rounded-full text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button asChild variant="outline" size="sm" className="mt-4 rounded-full">
                      <Link href="/developers/community-layouts">View the spec</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Snippets tab */}
          <TabsContent value="snippets" className="space-y-4 mt-0">
            <DeveloperSnippets />
          </TabsContent>

          {/* Quests tab */}
          <TabsContent value="quests" className="space-y-4 mt-0">
            <DeveloperQuests />
          </TabsContent>

          {/* Leaderboard tab */}
          <TabsContent value="leaderboard" className="space-y-4 mt-0">
            <DeveloperLeaderboard />
          </TabsContent>

          {/* Dev Profile tab */}
          <TabsContent value="profile" className="mt-0">
            <DeveloperProfilePanel />
          </TabsContent>
        </Tabs>
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProjectCreated={() => fetchProjects()}
      />
    </>
  )
}

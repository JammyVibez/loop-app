"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Code, Plus, Loader2 } from "lucide-react"
import { CreateProjectDialog } from "@/components/developers/create-project-dialog"
import { CodeLoopCard } from "@/components/developers/code-loop-card"

function normalizeProject(row: any) {
  return {
    id: row.id,
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
    created_at: row.created_at ? new Date(row.created_at) : new Date(),
  }
}

const languages = ["All", "JavaScript", "Python", "TypeScript", "Go", "Rust", "Java", "C++"]
const frameworks = ["All", "React", "Vue", "Angular", "Node.js", "Django", "Flask", "Express"]

export function DevelopersContent() {
  const [projects, setProjects] = useState<ReturnType<typeof normalizeProject>[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState("All")
  const [selectedFramework, setSelectedFramework] = useState("All")
  const [sortBy, setSortBy] = useState("recent")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    return matchesLanguage && matchesFramework
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

  return (
    <>
      <div className="space-y-6">
        {/* Create Project & Developer Docs Navigation Buttons */}
        <div className="flex flex-wrap justify-center items-center gap-3">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 rounded-full font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Share Project
          </Button>

          <Button
            asChild
            variant="outline"
            className="rounded-full border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 font-semibold whitespace-normal text-center"
          >
            <a href="/developers/docs">
              <Code className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400 shrink-0" />
              Developer Docs
            </a>
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
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
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading developer projects…
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
            <p className="font-medium">No developer projects yet</p>
            <p className="text-sm text-muted-foreground">
              Be the first to share your code with the community.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="mt-2 rounded-full">
              <Plus className="w-4 h-4 mr-2" />
              Share Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sortedProjects.map((project) => (
              <CodeLoopCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Featured Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="w-5 h-5 text-purple-600" />
              <span>Featured Developer Resources</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Loop API Documentation</h3>
                <p className="text-sm text-muted-foreground mb-3">Real Bearer-token API reference for building on Loop</p>
                <Button asChild variant="outline" size="sm">
                  <a href="/developers/docs">View Docs</a>
                </Button>
              </div>

              <div className="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Community Layout Packs</h3>
                <p className="text-sm text-muted-foreground mb-3">Build marketplace packs that restyle Circles</p>
                <Button asChild variant="outline" size="sm">
                  <a href="/developers/community-layouts">View Spec</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <CreateProjectDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onProjectCreated={() => fetchProjects()}
      />
    </>
  )
}

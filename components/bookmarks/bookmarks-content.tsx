"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Bookmark, Search, Grid, List, Trash2, Share } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

// Bookmark interface
interface Bookmark {
  id: string
  type: "loop" | "tree"
  saved_at: Date
  category: string
  loop: any // Using any for now, but should be properly typed
  branch_count?: number
}

const categories = ["All", "Philosophy", "Music", "Art", "Technology", "Stories", "Tutorials"]

export function BookmarksContent() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [sortBy, setSortBy] = useState("recent")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()
  
  // Load bookmarks from API
  useEffect(() => {
    const loadBookmarks = async () => {
      try {
        setLoading(true)
        if (!user) {
          setLoading(false)
          return
        }
        
        const response = await fetch('/api/bookmarks', {
          headers: getAuthHeader(),
        })
        
        if (response.ok) {
          const data = await response.json()
          setBookmarks((data.bookmarks || []).map((bookmark: any) => ({ ...bookmark, saved_at: new Date(bookmark.saved_at) })))
        }
      } catch (error) {
        console.error('Failed to load bookmarks:', error)
        toast({
          title: "Error",
          description: "Failed to load bookmarks",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    
    loadBookmarks()
  }, [user])

  const filteredBookmarks = bookmarks.filter((bookmark) => {
    const matchesSearch =
      bookmark.loop.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.loop.content_title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.loop.author.display_name.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategory === "All" || bookmark.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const sortedBookmarks = [...filteredBookmarks].sort((a, b) => {
    switch (sortBy) {
      case "recent":
        return b.saved_at.getTime() - a.saved_at.getTime()
      case "oldest":
        return a.saved_at.getTime() - b.saved_at.getTime()
      case "popular":
        return (b.loop.stats?.likes_count || 0) - (a.loop.stats?.likes_count || 0)
      default:
        return 0
    }
  })

  const handleRemoveBookmark = async (bookmarkId: string) => {
    const bookmark = bookmarks.find((item) => item.id === bookmarkId)
    if (!bookmark || !user) return

    const response = await fetch(`/api/loops/${bookmark.loop.id}/interactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ interaction_type: "save" }),
    })

    if (!response.ok) {
      toast({ title: "Error", description: "Failed to remove bookmark", variant: "destructive" })
      return
    }

    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
    toast({ description: "Bookmark removed successfully" })
  }

  const handleShare = (bookmark: any) => {
    navigator.clipboard.writeText(`${window.location.origin}/loop/${bookmark.loop.id}`)
    toast({
      description: "Link copied to clipboard!",
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search bookmarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-white/10 rounded-md text-sm bg-[#0a1020] text-slate-100"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-white/10 rounded-md text-sm bg-[#0a1020] text-slate-100"
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="popular">Most Popular</option>
              </select>

              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="rounded-r-none"
                >
                  <List className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="rounded-l-none"
                >
                  <Grid className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookmarks Count */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600 dark:text-gray-400">
          {sortedBookmarks.length} bookmark{sortedBookmarks.length !== 1 ? "s" : ""} found
        </p>
        <div className="flex items-center space-x-2">
          {categories.slice(1).map((category) => {
            const count = bookmarks.filter((b) => b.category === category).length
            if (count === 0) return null
            return (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedCategory(category)}
              >
                {category} ({count})
              </Badge>
            )
          })}
        </div>
      </div>

      {/* Bookmarks List */}
      {sortedBookmarks.length > 0 ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-6"}>
          {sortedBookmarks.map((bookmark) => (
            <div key={bookmark.id} className="relative group">
              {/* Bookmark Actions */}
              <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center space-x-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShare(bookmark)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Share className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveBookmark(bookmark.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Bookmark Info */}
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Bookmark className="w-4 h-4 text-purple-600 fill-current" />
                  <Badge variant="outline">{bookmark.category}</Badge>
                  {bookmark.type === "tree" && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    >
                      Tree ({bookmark.branch_count} branches)
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-gray-500">Saved {formatDate(bookmark.saved_at)}</span>
              </div>

              {/* Loop Content */}
              <LoopCard loop={bookmark.loop} onDeleted={(loopId) => setBookmarks(prev => prev.filter(item => item.loop.id !== loopId))} onEdited={(loop) => setBookmarks(prev => prev.map(item => item.loop.id === loop.id ? { ...item, loop } : item))} />
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No bookmarks found</h3>
            <p className="text-gray-500 mb-4">
              {searchQuery || selectedCategory !== "All"
                ? "Try adjusting your search or filters"
                : "Start bookmarking loops and trees you want to save for later"}
            </p>
            {(searchQuery || selectedCategory !== "All") && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setSelectedCategory("All")
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

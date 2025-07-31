"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Bookmark, Search, Grid, List, Trash2, Share } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { useToast } from "@/hooks/use-toast"

// Mock bookmarked content
const mockBookmarks = [
  {
    id: "bookmark-1",
    type: "loop",
    saved_at: new Date("2024-01-15T14:30:00Z"),
    category: "Philosophy",
    loop: {
      id: "1",
      author: {
        id: "1",
        username: "creativemind",
        display_name: "Creative Mind",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_verified: true,
        verification_level: "root" as const,
        is_premium: true,
      },
      content: {
        type: "text" as const,
        text: "What if we could travel through time but only to witness, never to change anything? 🤔",
      },
      created_at: new Date("2024-01-15T10:30:00Z"),
      stats: { likes: 234, branches: 12, comments: 45, saves: 67 },
    },
  },
  {
    id: "bookmark-2",
    type: "tree",
    saved_at: new Date("2024-01-15T13:20:00Z"),
    category: "Music",
    loop: {
      id: "2",
      author: {
        id: "2",
        username: "musicmaker",
        display_name: "Music Maker",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_verified: true,
        verification_level: "influencer" as const,
        is_premium: true,
      },
      content: {
        type: "audio" as const,
        audio_url: "/placeholder-audio.mp3",
        title: "Collaborative Beat Session",
        duration: 120,
      },
      created_at: new Date("2024-01-15T09:20:00Z"),
      stats: { likes: 456, branches: 8, comments: 78, saves: 123 },
    },
    branch_count: 15,
  },
  {
    id: "bookmark-3",
    type: "loop",
    saved_at: new Date("2024-01-15T12:10:00Z"),
    category: "Art",
    loop: {
      id: "3",
      author: {
        id: "3",
        username: "visualartist",
        display_name: "Visual Artist",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_verified: false,
        is_premium: true,
      },
      content: {
        type: "image" as const,
        image_url: "/placeholder.svg?height=400&width=600",
        caption: "Digital dreams in neon colors",
      },
      created_at: new Date("2024-01-15T08:45:00Z"),
      stats: { likes: 189, branches: 5, comments: 23, saves: 45 },
    },
  },
  {
    id: "bookmark-4",
    type: "loop",
    saved_at: new Date("2024-01-14T16:45:00Z"),
    category: "Technology",
    loop: {
      id: "4",
      author: {
        id: "4",
        username: "coder",
        display_name: "Code Master",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_verified: true,
        verification_level: "influencer" as const,
        is_premium: false,
      },
      content: {
        type: "text" as const,
        text: "// Recursive function to traverse loop trees\nfunction traverseTree(node) {\n  if (!node) return;\n  console.log(node.content);\n  node.branches.forEach(traverseTree);\n}",
      },
      created_at: new Date("2024-01-14T15:30:00Z"),
      stats: { likes: 345, branches: 23, comments: 67, saves: 89 },
    },
  },
]

const categories = ["All", "Philosophy", "Music", "Art", "Technology", "Stories", "Tutorials"]

export function BookmarksContent() {
  const [bookmarks, setBookmarks] = useState(mockBookmarks)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [viewMode, setViewMode] = useState<"grid" | "list">("list")
  const [sortBy, setSortBy] = useState("recent")
  const { toast } = useToast()

  const filteredBookmarks = bookmarks.filter((bookmark) => {
    const matchesSearch =
      bookmark.loop.content.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bookmark.loop.content.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
        return b.loop.stats.likes - a.loop.stats.likes
      default:
        return 0
    }
  })

  const handleRemoveBookmark = (bookmarkId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
    toast({
      description: "Bookmark removed successfully",
    })
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
                className="px-3 py-2 border rounded-md text-sm bg-background"
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
                className="px-3 py-2 border rounded-md text-sm bg-background"
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
              <LoopCard loop={bookmark.loop} />
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

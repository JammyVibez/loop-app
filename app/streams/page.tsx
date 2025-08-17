"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Radio, 
  Users, 
  Eye, 
  Heart, 
  MessageCircle, 
  Gift, 
  Search,
  Filter,
  Play,
  Crown,
  Zap
} from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface Stream {
  id: string
  title: string
  description: string
  thumbnail_url: string
  viewer_count: number
  status: string
  category: string
  tags: string[]
  created_at: string
  streamer: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    is_verified: boolean
    is_premium: boolean
  }
}

export default function StreamsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [streams, setStreams] = useState<Stream[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [activeTab, setActiveTab] = useState("live")

  const categories = [
    { id: "all", label: "All Categories" },
    { id: "gaming", label: "Gaming" },
    { id: "music", label: "Music" },
    { id: "art", label: "Art & Design" },
    { id: "tech", label: "Technology" },
    { id: "education", label: "Education" },
    { id: "lifestyle", label: "Lifestyle" },
    { id: "entertainment", label: "Entertainment" }
  ]

  useEffect(() => {
    fetchStreams()
  }, [activeTab, selectedCategory])

  const fetchStreams = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        status: activeTab,
        ...(selectedCategory !== "all" && { category: selectedCategory }),
        limit: "20"
      })

      const response = await fetch(`/api/streams?${params}`)
      if (response.ok) {
        const data = await response.json()
        setStreams(data.data.streams || [])
      }
    } catch (error) {
      console.error("Failed to fetch streams:", error)
      toast({
        title: "Error",
        description: "Failed to load streams",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search functionality
    console.log("Searching for:", searchQuery)
  }

  const formatViewerCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`
    }
    return count.toString()
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Live Streams
            </h1>
            <p className="text-gray-400 mt-2">Discover amazing live content from creators around the world</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search streams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64 bg-gray-800/50 border-gray-600"
              />
            </form>

            {/* Go Live Button */}
            {user && (
              <Link href="/create/stream">
                <Button className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600">
                  <Radio className="w-4 h-4 mr-2" />
                  Go Live
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="bg-gray-800/50 border-gray-600">
            <TabsTrigger value="live" className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span>Live Now</span>
            </TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="popular">Popular</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              {category.label}
            </Button>
          ))}
        </div>

        {/* Streams Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="bg-gray-900/50 border-gray-700 animate-pulse">
                <div className="aspect-video bg-gray-800 rounded-t-lg"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-800 rounded mb-2"></div>
                  <div className="h-3 bg-gray-800 rounded w-3/4 mb-3"></div>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gray-800 rounded-full"></div>
                    <div className="h-3 bg-gray-800 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : streams.length === 0 ? (
          <div className="text-center py-12">
            <Radio className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-300 mb-2">No streams found</h3>
            <p className="text-gray-400 mb-6">
              {activeTab === "live" 
                ? "No one is streaming right now. Be the first to go live!" 
                : "No streams match your current filters."}
            </p>
            {user && (
              <Link href="/create/stream">
                <Button className="bg-gradient-to-r from-red-500 to-pink-500">
                  <Radio className="w-4 h-4 mr-2" />
                  Start Streaming
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {streams.map((stream) => (
              <Link key={stream.id} href={`/stream/${stream.id}`}>
                <Card className="bg-gray-900/50 border-gray-700 hover:bg-gray-800/50 transition-colors cursor-pointer group">
                  <div className="relative aspect-video overflow-hidden rounded-t-lg">
                    <img
                      src={stream.thumbnail_url || "/placeholder.svg?height=200&width=300"}
                      alt={stream.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    
                    {/* Live Badge */}
                    {stream.status === "live" && (
                      <div className="absolute top-3 left-3 flex items-center space-x-1 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                        <span>LIVE</span>
                      </div>
                    )}

                    {/* Viewer Count */}
                    <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-full text-xs flex items-center space-x-1">
                      <Eye className="w-3 h-3" />
                      <span>{formatViewerCount(stream.viewer_count)}</span>
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <h3 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-purple-400 transition-colors">
                      {stream.title}
                    </h3>
                    
                    <div className="flex items-center space-x-2 mb-3">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={stream.streamer.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback className="text-xs">
                          {stream.streamer.display_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center space-x-1 min-w-0">
                        <span className="text-sm text-gray-300 truncate">
                          {stream.streamer.display_name}
                        </span>
                        {stream.streamer.is_verified && (
                          <Badge className="bg-blue-500 text-white text-xs px-1 py-0">
                            ✓
                          </Badge>
                        )}
                        {stream.streamer.is_premium && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                    </div>

                    {/* Category & Tags */}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="capitalize">{stream.category}</span>
                      <span>{getTimeAgo(stream.created_at)}</span>
                    </div>

                    {/* Tags */}
                    {stream.tags && stream.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {stream.tags.slice(0, 3).map((tag, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="bg-purple-900/50 text-purple-300 text-xs px-1 py-0"
                          >
                            #{tag}
                          </Badge>
                        ))}
                        {stream.tags.length > 3 && (
                          <Badge
                            variant="secondary"
                            className="bg-gray-700 text-gray-300 text-xs px-1 py-0"
                          >
                            +{stream.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Load More */}
        {streams.length > 0 && streams.length % 20 === 0 && (
          <div className="text-center mt-8">
            <Button
              variant="outline"
              onClick={fetchStreams}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Load More Streams
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Heart,
  MessageCircle,
  Share2,
  GitBranch,
  Play,
  Pause,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Flag,
  Bookmark,
  Download,
  Upload,
  ImageIcon,
  Video,
  Music,
  FileText,
  Crown,
  Zap,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

const mockReels = [
  {
    id: "1",
    type: "video",
    title: "The Time Traveler's Dilemma",
    content: "/placeholder.svg?height=400&width=600",
    thumbnail: "/placeholder.svg?height=200&width=300",
    description: "What would you do if you could change the past but risk losing your present?",
    author: {
      id: "1",
      username: "storyteller",
      display_name: "Story Teller",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_premium: true,
    },
    stats: {
      likes: 1247,
      comments: 89,
      shares: 156,
      branches: 23,
    },
    branches: [
      {
        id: "1-1",
        type: "text",
        title: "The Butterfly Effect",
        content:
          "I would be too afraid to change anything. Even the smallest change could have massive consequences...",
        author: {
          id: "2",
          username: "philosopher",
          display_name: "Deep Thinker",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_premium: false,
        },
        stats: { likes: 234, comments: 12, shares: 45, branches: 5 },
        created_at: new Date("2024-01-15T10:30:00Z"),
      },
      {
        id: "1-2",
        type: "image",
        title: "Visual Timeline",
        content: "/placeholder.svg?height=300&width=400",
        description: "Here's how I imagine the timeline would split",
        author: {
          id: "3",
          username: "artist",
          display_name: "Visual Artist",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_premium: true,
        },
        stats: { likes: 567, comments: 34, shares: 78, branches: 8 },
        created_at: new Date("2024-01-15T11:15:00Z"),
      },
    ],
    created_at: new Date("2024-01-15T09:00:00Z"),
    tags: ["timetravel", "philosophy", "scifi"],
  },
  {
    id: "2",
    type: "audio",
    title: "Midnight Jazz Improvisation",
    content: "/placeholder.svg?height=200&width=400",
    description: "A late-night jazz session that turned into something magical",
    author: {
      id: "4",
      username: "jazzmaster",
      display_name: "Jazz Master",
      avatar_url: "/placeholder.svg?height=40&width=40",
      is_premium: true,
    },
    stats: {
      likes: 892,
      comments: 45,
      shares: 123,
      branches: 15,
    },
    branches: [
      {
        id: "2-1",
        type: "audio",
        title: "Adding Bass Line",
        content: "/placeholder.svg?height=200&width=400",
        description: "Laid down a bass track to complement the original",
        author: {
          id: "5",
          username: "bassplayer",
          display_name: "Bass Virtuoso",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_premium: false,
        },
        stats: { likes: 345, comments: 23, shares: 67, branches: 3 },
        created_at: new Date("2024-01-15T12:00:00Z"),
      },
    ],
    created_at: new Date("2024-01-15T08:30:00Z"),
    tags: ["jazz", "music", "improvisation"],
  },
]

export function TreeReels() {
  const [reels, setReels] = useState(mockReels)
  const [selectedReel, setSelectedReel] = useState<any>(null)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [branchType, setBranchType] = useState("text")
  const [branchTitle, setBranchTitle] = useState("")
  const [branchContent, setBranchContent] = useState("")
  const [branchDescription, setBranchDescription] = useState("")
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({})
  const [isMuted, setIsMuted] = useState<{ [key: string]: boolean }>({})
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({})
  const { user } = useAuth()
  const { toast } = useToast()

  const handleLike = async (reelId: string, isBranch = false, branchId?: string) => {
    try {
      const response = await fetch(`/api/reels/${reelId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_id: branchId }),
      })

      if (response.ok) {
        setReels((prev) =>
          prev.map((reel) => {
            if (reel.id === reelId) {
              if (isBranch && branchId) {
                return {
                  ...reel,
                  branches: reel.branches.map((branch) =>
                    branch.id === branchId
                      ? { ...branch, stats: { ...branch.stats, likes: branch.stats.likes + 1 } }
                      : branch,
                  ),
                }
              } else {
                return { ...reel, stats: { ...reel.stats, likes: reel.stats.likes + 1 } }
              }
            }
            return reel
          }),
        )
        toast({ description: "Liked!" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to like reel", variant: "destructive" })
    }
  }

  const handleShare = async (reelId: string) => {
    try {
      await navigator.share({
        title: "Check out this Loop Reel",
        url: `${window.location.origin}/reel/${reelId}`,
      })
    } catch (error) {
      navigator.clipboard.writeText(`${window.location.origin}/reel/${reelId}`)
      toast({ description: "Link copied to clipboard!" })
    }
  }

  const handleCreateBranch = async () => {
    if (!selectedReel || !branchTitle.trim() || !branchContent.trim()) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" })
      return
    }

    try {
      const response = await fetch(`/api/reels/${selectedReel.id}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: branchType,
          title: branchTitle,
          content: branchContent,
          description: branchDescription,
        }),
      })

      if (response.ok) {
        const newBranch = await response.json()
        setReels((prev) =>
          prev.map((reel) =>
            reel.id === selectedReel.id
              ? {
                  ...reel,
                  branches: [...reel.branches, newBranch],
                  stats: { ...reel.stats, branches: reel.stats.branches + 1 },
                }
              : reel,
          ),
        )
        setShowBranchDialog(false)
        setBranchTitle("")
        setBranchContent("")
        setBranchDescription("")
        toast({ description: "Branch created successfully!" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create branch", variant: "destructive" })
    }
  }

  const togglePlay = (reelId: string) => {
    setIsPlaying((prev) => ({ ...prev, [reelId]: !prev[reelId] }))
  }

  const toggleMute = (reelId: string) => {
    setIsMuted((prev) => ({ ...prev, [reelId]: !prev[reelId] }))
  }

  const formatTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const renderMediaContent = (reel: any, isCompact = false) => {
    const size = isCompact ? "h-32" : "h-64"

    switch (reel.type) {
      case "video":
        return (
          <div className={`relative ${size} bg-gray-800 rounded-lg overflow-hidden group`}>
            <img src={reel.thumbnail || reel.content} alt={reel.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors">
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full w-12 h-12"
                  onClick={() => togglePlay(reel.id)}
                >
                  {isPlaying[reel.id] ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                </Button>
              </div>
              <div className="absolute bottom-4 right-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8"
                  onClick={() => toggleMute(reel.id)}
                >
                  {isMuted[reel.id] ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )

      case "audio":
        return (
          <div
            className={`${size} bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg flex items-center justify-center relative overflow-hidden`}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 animate-pulse"></div>
            <div className="relative z-10 text-center">
              <Music className="w-12 h-12 text-purple-400 mx-auto mb-4" />
              <Button
                variant="ghost"
                size="icon"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full w-12 h-12"
                onClick={() => togglePlay(reel.id)}
              >
                {isPlaying[reel.id] ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        )

      case "image":
        return (
          <div className={`${size} bg-gray-800 rounded-lg overflow-hidden`}>
            <img
              src={reel.content || "/placeholder.svg"}
              alt={reel.title}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
        )

      case "text":
        return (
          <div
            className={`${size} bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 flex items-center justify-center`}
          >
            <div className="text-center">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-300 text-sm leading-relaxed line-clamp-6">{reel.content}</p>
            </div>
          </div>
        )

      default:
        return (
          <div className={`${size} bg-gray-800 rounded-lg flex items-center justify-center`}>
            <p className="text-gray-400">Unsupported media type</p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-8">
      {reels.map((reel) => (
        <Card key={reel.id} className="bg-gray-900/50 border-gray-700 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={reel.author.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback>{reel.author.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold text-white">{reel.author.display_name}</p>
                    {reel.author.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                  </div>
                  <p className="text-sm text-gray-400">
                    @{reel.author.username} • {formatTime(reel.created_at)}
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-700">
                  <DropdownMenuItem className="text-gray-300 hover:bg-gray-700">
                    <Bookmark className="w-4 h-4 mr-2" />
                    Save
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-gray-300 hover:bg-gray-700">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-gray-300 hover:bg-gray-700">
                    <Flag className="w-4 h-4 mr-2" />
                    Report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{reel.title}</h3>
              {reel.description && <p className="text-gray-300 mb-4">{reel.description}</p>}
              <div className="flex flex-wrap gap-2 mb-4">
                {reel.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-purple-900/50 text-purple-300 hover:bg-purple-900/70"
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </div>

            {renderMediaContent(reel)}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <div className="flex space-x-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLike(reel.id)}
                  className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  {reel.stats.likes}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComments((prev) => ({ ...prev, [reel.id]: !prev[reel.id] }))}
                  className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {reel.stats.comments}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShare(reel.id)}
                  className="text-gray-400 hover:text-green-400 hover:bg-green-400/10"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {reel.stats.shares}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedReel(reel)
                    setShowBranchDialog(true)
                  }}
                  className="text-gray-400 hover:text-purple-400 hover:bg-purple-400/10"
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  {reel.stats.branches}
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-400">Trending</span>
              </div>
            </div>

            {/* Branches */}
            {reel.branches.length > 0 && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-purple-400" />
                  <h4 className="text-lg font-semibold text-white">Branches ({reel.branches.length})</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reel.branches.map((branch) => (
                    <Card key={branch.id} className="bg-gray-800/50 border-gray-600">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={branch.author.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback className="text-xs">{branch.author.display_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex items-center space-x-1">
                            <p className="text-sm font-medium text-white">{branch.author.display_name}</p>
                            {branch.author.is_premium && <Crown className="w-3 h-3 text-yellow-500" />}
                          </div>
                          <span className="text-xs text-gray-400">• {formatTime(branch.created_at)}</span>
                        </div>
                        <h5 className="font-medium text-white mb-2">{branch.title}</h5>
                        {renderMediaContent(branch, true)}
                        {branch.description && (
                          <p className="text-sm text-gray-300 mt-2 line-clamp-2">{branch.description}</p>
                        )}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-600">
                          <div className="flex space-x-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLike(reel.id, true, branch.id)}
                              className="text-gray-400 hover:text-red-400 text-xs p-1"
                            >
                              <Heart className="w-3 h-3 mr-1" />
                              {branch.stats.likes}
                            </Button>
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 text-xs p-1">
                              <MessageCircle className="w-3 h-3 mr-1" />
                              {branch.stats.comments}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-purple-400 text-xs p-1"
                            >
                              <GitBranch className="w-3 h-3 mr-1" />
                              {branch.stats.branches}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            {showComments[reel.id] && (
              <div className="mt-6 space-y-4 border-t border-gray-700 pt-4">
                <h4 className="text-lg font-semibold text-white">Comments</h4>
                <div className="space-y-3">
                  {/* Mock comments */}
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                        <AvatarFallback>U{i + 1}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-white">User {i + 1}</p>
                          <span className="text-xs text-gray-400">2h ago</span>
                        </div>
                        <p className="text-sm text-gray-300 mt-1">
                          This is such an interesting take on the concept! I love how you explored the philosophical
                          implications.
                        </p>
                        <div className="flex items-center space-x-4 mt-2">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 text-xs p-0">
                            <Heart className="w-3 h-3 mr-1" />
                            {5 + i}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 text-xs p-0">
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <Textarea
                      placeholder="Add a comment..."
                      className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                      rows={2}
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                      >
                        Comment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Branch Creation Dialog */}
      <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
        <DialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Create a Branch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="branch-type" className="text-white">
                Branch Type
              </Label>
              <Select value={branchType} onValueChange={setBranchType}>
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="text">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>Text</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="image">
                    <div className="flex items-center space-x-2">
                      <ImageIcon className="w-4 h-4" />
                      <span>Image</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="video">
                    <div className="flex items-center space-x-2">
                      <Video className="w-4 h-4" />
                      <span>Video</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="audio">
                    <div className="flex items-center space-x-2">
                      <Music className="w-4 h-4" />
                      <span>Audio</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="branch-title" className="text-white">
                Title
              </Label>
              <Input
                id="branch-title"
                value={branchTitle}
                onChange={(e) => setBranchTitle(e.target.value)}
                placeholder="Give your branch a title..."
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
              />
            </div>

            <div>
              <Label htmlFor="branch-content" className="text-white">
                Content
              </Label>
              {branchType === "text" ? (
                <Textarea
                  id="branch-content"
                  value={branchContent}
                  onChange={(e) => setBranchContent(e.target.value)}
                  placeholder="Write your branch content..."
                  className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 min-h-[120px]"
                />
              ) : (
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-400">Upload your {branchType} file</p>
                  <Button
                    variant="outline"
                    className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                  >
                    Choose File
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="branch-description" className="text-white">
                Description (Optional)
              </Label>
              <Textarea
                id="branch-description"
                value={branchDescription}
                onChange={(e) => setBranchDescription(e.target.value)}
                placeholder="Add a description for your branch..."
                className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowBranchDialog(false)}
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateBranch}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                Create Branch
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

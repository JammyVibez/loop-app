"use client"

import { useState, useEffect, useRef } from "react"
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
  Loader2,
  Send,
  Gift,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useRealtime } from "@/hooks/use-realtime"
import { GiftModal } from "@/components/gifting/gift-modal"

interface ReelData {
  id: string
  type: string
  title: string
  content_url: string
  thumbnail_url?: string
  description?: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
    is_verified?: boolean
  }
  like_count: number
  comment_count: number
  share_count: number
  view_count: number
  branch_count: number
  is_liked: boolean
  is_saved: boolean
  hashtags: string[]
  created_at: string
  branches?: ReelData[]
  duration?: number
  allows_comments: boolean
  allows_duets: boolean
  allows_downloads: boolean
}

interface Comment {
  id: string
  content: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  }
  created_at: string
  like_count: number
  is_liked: boolean
}

export function TreeReels() {
  const [reels, setReels] = useState<ReelData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReel, setSelectedReel] = useState<ReelData | null>(null)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState<any>(null)
  const [branchType, setBranchType] = useState("text")
  const [branchTitle, setBranchTitle] = useState("")
  const [branchContent, setBranchContent] = useState("")
  const [branchDescription, setBranchDescription] = useState("")
  const [uploadingFile, setUploadingFile] = useState(false)
  const [isPlaying, setIsPlaying] = useState<{ [key: string]: boolean }>({})
  const [isMuted, setIsMuted] = useState<{ [key: string]: boolean }>({})
  const [showComments, setShowComments] = useState<{ [key: string]: boolean }>({})
  const [comments, setComments] = useState<{ [key: string]: Comment[] }>({})
  const [newComment, setNewComment] = useState<{ [key: string]: string }>({})
  const [interacting, setInteracting] = useState<{ [key: string]: boolean }>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const { user } = useAuth()
  const { toast } = useToast()
  const { socket, isConnected } = useRealtime()

  useEffect(() => {
    fetchReels()
  }, [])

  useEffect(() => {
    if (socket && isConnected) {
      socket.on("reel_liked", (data: { reel_id: string; like_count: number }) => {
        setReels((prev) =>
          prev.map((reel) => (reel.id === data.reel_id ? { ...reel, like_count: data.like_count } : reel)),
        )
      })

      socket.on("reel_commented", (data: { reel_id: string; comment_count: number; comment: Comment }) => {
        setReels((prev) =>
          prev.map((reel) => (reel.id === data.reel_id ? { ...reel, comment_count: data.comment_count } : reel)),
        )
        setComments((prev) => ({
          ...prev,
          [data.reel_id]: [data.comment, ...(prev[data.reel_id] || [])],
        }))
      })

      socket.on("reel_branched", (data: { reel_id: string; branch: ReelData; branch_count: number }) => {
        setReels((prev) =>
          prev.map((reel) =>
            reel.id === data.reel_id
              ? {
                  ...reel,
                  branch_count: data.branch_count,
                  branches: [...(reel.branches || []), data.branch],
                }
              : reel,
          ),
        )
      })

      return () => {
        socket.off("reel_liked")
        socket.off("reel_commented")
        socket.off("reel_branched")
      }
    }
  }, [socket, isConnected])

  const fetchReels = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/reels?category=trending&limit=10")
      const data = await response.json()

      if (data.success) {
        setReels(data.data.reels || [])
      }
    } catch (error) {
      console.error("Error fetching reels:", error)
      toast({
        title: "Error",
        description: "Failed to load reels",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInteraction = async (reelId: string, type: string, action: "add" | "remove" = "add") => {
    if (!user?.token || interacting[`${reelId}-${type}`]) return

    setInteracting((prev) => ({ ...prev, [`${reelId}-${type}`]: true }))

    try {
      const response = await fetch(`/api/reels/${reelId}/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ type, action }),
      })

      const data = await response.json()

      if (data.success) {
        setReels((prev) =>
          prev.map((reel) => {
            if (reel.id === reelId) {
              const updatedReel = { ...reel }
              if (type === "like") {
                updatedReel.like_count = data.data.counts.like_count
                updatedReel.is_liked = action === "add"
              } else if (type === "save") {
                updatedReel.is_saved = action === "add"
              } else if (type === "share") {
                updatedReel.share_count = data.data.counts.share_count
              }
              return updatedReel
            }
            return reel
          }),
        )

        if (socket && isConnected && type === "like") {
          socket.emit("reel_interaction", {
            reel_id: reelId,
            type,
            like_count: data.data.counts.like_count,
          })
        }

        if (type === "like") {
          toast({ description: action === "add" ? "Liked!" : "Unliked!" })
        } else if (type === "save") {
          toast({ description: action === "add" ? "Saved!" : "Unsaved!" })
        }
      }
    } catch (error) {
      console.error("Interaction error:", error)
      toast({
        title: "Error",
        description: `Failed to ${type} reel`,
        variant: "destructive",
      })
    } finally {
      setInteracting((prev) => ({ ...prev, [`${reelId}-${type}`]: false }))
    }
  }

  const handleLike = (reel: ReelData) => {
    const action = reel.is_liked ? "remove" : "add"
    handleInteraction(reel.id, "like", action)
  }

  const handleSave = (reel: ReelData) => {
    const action = reel.is_saved ? "remove" : "add"
    handleInteraction(reel.id, "save", action)
  }

  const handleShare = async (reelId: string) => {
    try {
      await navigator.share({
        title: "Check out this Loop Reel",
        url: `${window.location.origin}/reel/${reelId}`,
      })
      handleInteraction(reelId, "share")
    } catch (error) {
      navigator.clipboard.writeText(`${window.location.origin}/reel/${reelId}`)
      handleInteraction(reelId, "share")
      toast({ description: "Link copied to clipboard!" })
    }
  }

  const fetchComments = async (reelId: string) => {
    try {
      const response = await fetch(`/api/reels/${reelId}/comments`)
      const data = await response.json()

      if (data.success) {
        setComments((prev) => ({ ...prev, [reelId]: data.data.comments }))
      }
    } catch (error) {
      console.error("Error fetching comments:", error)
    }
  }

  const handleComment = async (reelId: string) => {
    const content = newComment[reelId]?.trim()
    if (!content || !user?.token) return

    try {
      const response = await fetch(`/api/reels/${reelId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ content }),
      })

      const data = await response.json()

      if (data.success) {
        setNewComment((prev) => ({ ...prev, [reelId]: "" }))
        setReels((prev) =>
          prev.map((reel) => (reel.id === reelId ? { ...reel, comment_count: reel.comment_count + 1 } : reel)),
        )

        if (socket && isConnected) {
          socket.emit("reel_comment", {
            reel_id: reelId,
            comment: data.data.comment,
            comment_count: data.data.comment_count,
          })
        }

        toast({ description: "Comment added!" })
      }
    } catch (error) {
      console.error("Comment error:", error)
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      })
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file) return null

    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", `reel_${branchType}`)

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user?.token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        return data.data.url
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload Error",
        description: "Failed to upload file",
        variant: "destructive",
      })
      return null
    } finally {
      setUploadingFile(false)
    }
  }

  const handleCreateBranch = async () => {
    if (!selectedReel || !branchTitle.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    let contentUrl = branchContent

    if (branchType !== "text" && fileInputRef.current?.files?.[0]) {
      const uploadedUrl = await handleFileUpload(fileInputRef.current.files[0])
      if (!uploadedUrl) return
      contentUrl = uploadedUrl
    }

    if (!contentUrl.trim()) {
      toast({
        title: "Error",
        description: "Please provide content for your branch",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/reels/${selectedReel.id}/branch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user?.token}`,
        },
        body: JSON.stringify({
          type: branchType,
          title: branchTitle,
          content_url: contentUrl,
          description: branchDescription,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setReels((prev) =>
          prev.map((reel) =>
            reel.id === selectedReel.id
              ? {
                  ...reel,
                  branches: [...(reel.branches || []), data.data.branch],
                  branch_count: reel.branch_count + 1,
                }
              : reel,
          ),
        )

        if (socket && isConnected) {
          socket.emit("reel_branch", {
            reel_id: selectedReel.id,
            branch: data.data.branch,
            branch_count: selectedReel.branch_count + 1,
          })
        }

        setShowBranchDialog(false)
        setBranchTitle("")
        setBranchContent("")
        setBranchDescription("")
        if (fileInputRef.current) fileInputRef.current.value = ""

        toast({ description: "Branch created successfully!" })
      }
    } catch (error) {
      console.error("Branch creation error:", error)
      toast({
        title: "Error",
        description: "Failed to create branch",
        variant: "destructive",
      })
    }
  }

  const togglePlay = (reelId: string) => {
    setIsPlaying((prev) => ({ ...prev, [reelId]: !prev[reelId] }))
  }

  const toggleMute = (reelId: string) => {
    setIsMuted((prev) => ({ ...prev, [reelId]: !prev[reelId] }))
  }

  const toggleComments = (reelId: string) => {
    const isShowing = showComments[reelId]
    setShowComments((prev) => ({ ...prev, [reelId]: !isShowing }))

    if (!isShowing && !comments[reelId]) {
      fetchComments(reelId)
    }
  }

  const formatTime = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const renderMediaContent = (reel: ReelData, isCompact = false) => {
    const size = isCompact ? "h-32" : "h-64"

    switch (reel.type) {
      case "video":
        return (
          <div className={`relative ${size} bg-gray-800 rounded-lg overflow-hidden group`}>
            <video
              src={reel.content_url}
              poster={reel.thumbnail_url}
              className="w-full h-full object-cover"
              muted={isMuted[reel.id]}
              loop
              playsInline
              ref={(video) => {
                if (video) {
                  if (isPlaying[reel.id]) {
                    video.play()
                  } else {
                    video.pause()
                  }
                }
              }}
            />
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
              {reel.duration && (
                <div className="absolute bottom-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded">
                  {Math.floor(reel.duration / 60)}:{(reel.duration % 60).toString().padStart(2, "0")}
                </div>
              )}
            </div>
          </div>
        )

      case "audio":
        return (
          <div
            className={`${size} bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-lg flex items-center justify-center relative overflow-hidden`}
          >
            <audio
              src={reel.content_url}
              ref={(audio) => {
                if (audio) {
                  audio.muted = isMuted[reel.id]
                  if (isPlaying[reel.id]) {
                    audio.play()
                  } else {
                    audio.pause()
                  }
                }
              }}
              loop
            />
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
              <div className="mt-2">
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

      case "image":
        return (
          <div className={`${size} bg-gray-800 rounded-lg overflow-hidden`}>
            <img
              src={reel.content_url || "/placeholder.svg"}
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
              <p className="text-gray-300 text-sm leading-relaxed line-clamp-6">{reel.content_url}</p>
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading reels...</span>
      </div>
    )
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
                    {reel.author.is_verified && <Badge className="bg-blue-500 text-white text-xs">✓</Badge>}
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
                  <DropdownMenuItem className="text-gray-300 hover:bg-gray-700" onClick={() => handleSave(reel)}>
                    <Bookmark className="w-4 h-4 mr-2" />
                    {reel.is_saved ? "Unsave" : "Save"}
                  </DropdownMenuItem>
                  {reel.allows_downloads && (
                    <DropdownMenuItem className="text-gray-300 hover:bg-gray-700">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-gray-300 hover:bg-gray-700"
                    onClick={() => {
                      setGiftRecipient(reel.author)
                      setShowGiftModal(true)
                    }}
                  >
                    <Gift className="w-4 h-4 mr-2" />
                    Send Gift
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
                {reel.hashtags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-purple-900/50 text-purple-300 hover:bg-purple-900/70 cursor-pointer"
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
                  onClick={() => handleLike(reel)}
                  disabled={interacting[`${reel.id}-like`]}
                  className={`${
                    reel.is_liked ? "text-red-400 hover:text-red-300" : "text-gray-400 hover:text-red-400"
                  } hover:bg-red-400/10`}
                >
                  {interacting[`${reel.id}-like`] ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Heart className={`w-4 h-4 mr-2 ${reel.is_liked ? "fill-current" : ""}`} />
                  )}
                  {reel.like_count}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleComments(reel.id)}
                  className="text-gray-400 hover:text-blue-400 hover:bg-blue-400/10"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {reel.comment_count}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleShare(reel.id)}
                  className="text-gray-400 hover:text-green-400 hover:bg-green-400/10"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  {reel.share_count}
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
                  {reel.branch_count}
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-400">{reel.view_count} views</span>
              </div>
            </div>

            {reel.branches && reel.branches.length > 0 && (
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
                            {/* <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLike(reel.id, true, branch.id)}
                              className="text-gray-400 hover:text-red-400 text-xs p-1"
                            >
                              <Heart className="w-3 h-3 mr-1" />
                              {branch.stats.likes}
                            </Button> */}
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 text-xs p-1">
                              <MessageCircle className="w-3 h-3 mr-1" />
                              {branch.comment_count}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-purple-400 text-xs p-1"
                            >
                              <GitBranch className="w-3 h-3 mr-1" />
                              {branch.branch_count}
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
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {comments[reel.id]?.map((comment) => (
                    <div key={comment.id} className="flex space-x-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={comment.author.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{comment.author.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-white">{comment.author.display_name}</p>
                          <span className="text-xs text-gray-400">{formatTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-300 mt-1">{comment.content}</p>
                        <div className="flex items-center space-x-4 mt-2">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-400 text-xs p-0">
                            <Heart className="w-3 h-3 mr-1" />
                            {comment.like_count}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-blue-400 text-xs p-0">
                            Reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {reel.allows_comments && (
                  <div className="flex space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 flex space-x-2">
                      <Input
                        placeholder="Add a comment..."
                        value={newComment[reel.id] || ""}
                        onChange={(e) => setNewComment((prev) => ({ ...prev, [reel.id]: e.target.value }))}
                        className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400"
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleComment(reel.id)
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleComment(reel.id)}
                        disabled={!newComment[reel.id]?.trim()}
                        className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
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
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={
                      branchType === "image"
                        ? "image/*"
                        : branchType === "video"
                          ? "video/*"
                          : branchType === "audio"
                            ? "audio/*"
                            : "*/*"
                    }
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setBranchContent(file.name)
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                  >
                    {uploadingFile ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Choose File"
                    )}
                  </Button>
                  {branchContent && <p className="text-sm text-gray-400 mt-2">Selected: {branchContent}</p>}
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
                disabled={uploadingFile}
                className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Branch"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gift Modal */}
      {giftRecipient && (
        <GiftModal
          open={showGiftModal}
          onOpenChange={setShowGiftModal}
          recipient={giftRecipient}
          context={{ type: "reel", id: selectedReel?.id || "", title: selectedReel?.title }}
        />
      )}
    </div>
  )
}

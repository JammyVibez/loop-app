"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Users,
  Settings,
  Crown,
  Shield,
  MessageCircle,
  Calendar,
  Trophy,
  Gift,
  Star,
  UserPlus,
  UserMinus,
  Lock,
  Globe,
  Plus,
  Hash,
  Bell,
  BellOff,
  ImageIcon,
  Video,
  FileText,
  BarChart3,
} from "lucide-react"
import { CircleChat } from "@/components/circles/circle-chat"
import { CircleEvents } from "@/components/circles/circle-events"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase"

interface CircleDetailProps {
  circleId: string
}

export function CircleDetail({ circleId }: CircleDetailProps) {
  const [circle, setCircle] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("posts")
  const [isJoined, setIsJoined] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showMemberManagement, setShowMemberManagement] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [newPost, setNewPost] = useState("")
  const [postType, setPostType] = useState("text")
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    const fetchCircleData = async () => {
      try {
        const supabase = createClient()

        const { data: circleData, error: circleError } = await supabase
          .from("circles")
          .select(`
            *,
            owner:profiles!circles_owner_id_fkey(*),
            member_count:circle_members(count),
            current_challenge:circle_challenges(
              title,
              description,
              ends_at,
              participants:circle_challenge_participants(count),
              prize
            ),
            stats:circle_stats(*),
            recent_posts:circle_posts(
              *,
              author:profiles(*),
              stats:circle_post_stats(*)
            )
          `)
          .eq("id", circleId)
          .single()

        if (circleError) {
          console.error("Error fetching circle:", circleError)
          return
        }

        if (user) {
          const { data: membershipData } = await supabase
            .from("circle_members")
            .select("role")
            .eq("circle_id", circleId)
            .eq("user_id", user.id)
            .single()

          setIsJoined(!!membershipData)
          if (membershipData) {
            circleData.user_role = membershipData.role
          }
        }

        const { data: staffData } = await supabase
          .from("circle_members")
          .select(`
            role,
            user:profiles(*)
          `)
          .eq("circle_id", circleId)
          .in("role", ["admin", "moderator"])

        circleData.staff = staffData || []
        setCircle(circleData)
      } catch (error) {
        console.error("Error fetching circle data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCircleData()
  }, [circleId, user])

  const handleJoinLeave = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to join circles.",
        variant: "destructive",
      })
      return
    }

    try {
      const supabase = createClient()

      if (isJoined) {
        const { error } = await supabase
          .from("circle_members")
          .delete()
          .eq("circle_id", circleId)
          .eq("user_id", user.id)

        if (error) throw error

        setIsJoined(false)
        setCircle((prev: any) => ({ ...prev, member_count: [{ count: (prev.member_count[0]?.count || 1) - 1 }] }))
        toast({ description: "Left the circle" })
      } else {
        if (circle.is_private) {
          const { error } = await supabase.from("circle_join_requests").insert({
            circle_id: circleId,
            user_id: user.id,
            status: "pending",
            created_at: new Date().toISOString(),
          })

          if (error) throw error

          toast({
            title: "Request Sent",
            description: "Your request to join this private circle has been sent to moderators.",
          })
        } else {
          const { error } = await supabase.from("circle_members").insert({
            circle_id: circleId,
            user_id: user.id,
            role: "member",
            joined_at: new Date().toISOString(),
          })

          if (error) throw error

          setIsJoined(true)
          setCircle((prev: any) => ({ ...prev, member_count: [{ count: (prev.member_count[0]?.count || 0) + 1 }] }))
          toast({ description: "Joined the circle!" })
        }
      }
    } catch (error) {
      console.error("Error joining/leaving circle:", error)
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCreatePost = async () => {
    if (!newPost.trim() && mediaFiles.length === 0) return

    try {
      const supabase = createClient()

      const mediaUrls: string[] = []
      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const fileExt = file.name.split(".").pop()
          const fileName = `${Date.now()}-${Math.random()}.${fileExt}`
          const filePath = `circle-posts/${circleId}/${fileName}`

          const { error: uploadError } = await supabase.storage.from("media").upload(filePath, file)

          if (uploadError) throw uploadError

          const {
            data: { publicUrl },
          } = supabase.storage.from("media").getPublicUrl(filePath)

          mediaUrls.push(publicUrl)
        }
      }

      const postData: any = {
        circle_id: circleId,
        author_id: user?.id,
        content: newPost,
        post_type: postType,
        created_at: new Date().toISOString(),
      }

      if (mediaUrls.length > 0) {
        postData.media_urls = mediaUrls
      }

      if (postType === "poll" && pollOptions.filter((opt) => opt.trim()).length >= 2) {
        postData.poll_options = pollOptions.filter((opt) => opt.trim())
      }

      const { data: newPostData, error } = await supabase
        .from("circle_posts")
        .insert(postData)
        .select(`
          *,
          author:profiles(*),
          stats:circle_post_stats(*)
        `)
        .single()

      if (error) throw error

      setCircle((prev: any) => ({
        ...prev,
        recent_posts: [newPostData, ...prev.recent_posts],
      }))

      setNewPost("")
      setMediaFiles([])
      setPollOptions(["", ""])
      setPostType("text")

      toast({ description: "Post shared with the circle!" })
    } catch (error) {
      console.error("Error creating post:", error)
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleMediaUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const maxFiles = user?.is_premium || user?.is_verified ? 4 : 1

    if (files.length > maxFiles) {
      toast({
        title: "File Limit Exceeded",
        description: `${user?.is_premium || user?.is_verified ? "Premium users" : "Free users"} can upload up to ${maxFiles} file${maxFiles > 1 ? "s" : ""} per post.`,
        variant: "destructive",
      })
      return
    }

    setMediaFiles(files)
    setPostType(files[0]?.type.startsWith("video/") ? "video" : "image")
  }

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, ""])
    }
  }

  const updatePollOption = (index: number, value: string) => {
    const newOptions = [...pollOptions]
    newOptions[index] = value
    setPollOptions(newOptions)
  }

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index))
    }
  }

  if (loading) {
    return <div className="flex justify-center p-8">Loading circle...</div>
  }

  if (!circle) {
    return <div className="text-center p-8">Circle not found</div>
  }

  const isStaff = circle.user_role === "owner" || circle.user_role === "admin" || circle.user_role === "moderator"

  const formatMemberCount = (count: number) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + "K"
    return count.toString()
  }

  const formatTimeAgo = (date: string) => {
    const now = new Date()
    const postDate = new Date(date)
    const diff = now.getTime() - postDate.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return "Just now"
  }

  return (
    <div className="space-y-6">
      {/* Circle Header */}
      <div className="relative">
        {/* Banner */}
        <div
          className="h-48 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg relative overflow-hidden"
          style={{
            backgroundImage: circle.banner_url ? `url(${circle.banner_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-4 right-4 flex space-x-2">
            {circle.is_private ? (
              <Badge className="bg-gray-800/80 text-white">
                <Lock className="w-3 h-3 mr-1" />
                Private
              </Badge>
            ) : (
              <Badge className="bg-green-600/80 text-white">
                <Globe className="w-3 h-3 mr-1" />
                Public
              </Badge>
            )}
            <Badge className="bg-purple-600/80 text-white">{circle.category}</Badge>
          </div>
        </div>

        {/* Circle Info */}
        <div className="relative -mt-16 px-6">
          <div className="flex items-end space-x-6">
            <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
              <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
              <AvatarFallback className="text-2xl">{circle.name.charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="flex-1 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">{circle.name}</h1>
                  <div className="flex items-center space-x-4 text-gray-300">
                    <div className="flex items-center space-x-1">
                      <Users className="w-4 h-4" />
                      <span>{formatMemberCount(circle.member_count[0]?.count || 0)} members</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Created {new Date(circle.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {isJoined && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotifications(!notifications)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-800"
                    >
                      {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </Button>
                  )}

                  <Button
                    onClick={handleJoinLeave}
                    className={
                      isJoined
                        ? "bg-gray-600 hover:bg-gray-700 text-white"
                        : "bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    }
                  >
                    {isJoined ? (
                      <>
                        <UserMinus className="w-4 h-4 mr-2" />
                        Leave
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        {circle.is_private ? "Request to Join" : "Join Circle"}
                      </>
                    )}
                  </Button>

                  {isStaff && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-700">
                        <DropdownMenuItem
                          onClick={() => setShowSettings(true)}
                          className="text-white hover:bg-gray-800"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Circle Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setShowMemberManagement(true)}
                          className="text-white hover:bg-gray-800"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Manage Members
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-white hover:bg-gray-800">
                          <Trophy className="w-4 h-4 mr-2" />
                          Create Contest
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-white hover:bg-gray-800">
                          <Gift className="w-4 h-4 mr-2" />
                          Premium Giveaway
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-gray-300 leading-relaxed">{circle.description}</p>
          </div>
        </div>
      </div>

      {/* Current Challenge */}
      {circle.current_challenge?.[0] && (
        <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <div>
                  <h3 className="text-xl font-bold text-white">{circle.current_challenge[0].title}</h3>
                  <p className="text-gray-300">{circle.current_challenge[0].description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Prize: {circle.current_challenge[0].prize}</p>
                <p className="text-sm text-gray-400">
                  {circle.current_challenge[0].participants?.[0]?.count || 0} participants
                </p>
                <Button size="sm" className="mt-2 bg-gradient-to-r from-yellow-500 to-orange-500">
                  Join Challenge
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-800">
          <TabsTrigger value="posts" className="text-white data-[state=active]:bg-purple-600">
            <Hash className="w-4 h-4 mr-2" />
            Posts
          </TabsTrigger>
          <TabsTrigger value="chat" className="text-white data-[state=active]:bg-purple-600">
            <MessageCircle className="w-4 h-4 mr-2" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="events" className="text-white data-[state=active]:bg-purple-600">
            <Calendar className="w-4 h-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="members" className="text-white data-[state=active]:bg-purple-600">
            <Users className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="about" className="text-white data-[state=active]:bg-purple-600">
            <Star className="w-4 h-4 mr-2" />
            About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-6">
          {/* Create Post */}
          {isJoined && (
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-3">
                    {/* Post Type Selector */}
                    <div className="flex space-x-2">
                      <Button
                        variant={postType === "text" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPostType("text")}
                        className="text-xs"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        Text
                      </Button>
                      <Button
                        variant={postType === "image" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPostType("image")}
                        className="text-xs"
                      >
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Image
                      </Button>
                      <Button
                        variant={postType === "video" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPostType("video")}
                        className="text-xs"
                      >
                        <Video className="w-3 h-3 mr-1" />
                        Video
                      </Button>
                      <Button
                        variant={postType === "poll" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPostType("poll")}
                        className="text-xs"
                      >
                        <BarChart3 className="w-3 h-3 mr-1" />
                        Poll
                      </Button>
                    </div>

                    <Textarea
                      placeholder="Share something with the circle..."
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                      rows={3}
                    />

                    {/* Media Upload */}
                    {(postType === "image" || postType === "video") && (
                      <div>
                        <input
                          type="file"
                          accept={postType === "image" ? "image/*" : "video/*"}
                          multiple={user?.is_premium || user?.is_verified}
                          onChange={handleMediaUpload}
                          className="hidden"
                          id="media-upload"
                        />
                        <label
                          htmlFor="media-upload"
                          className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:border-gray-500"
                        >
                          <div className="text-center">
                            <Plus className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">
                              Click to upload {postType}
                              {user?.is_premium || user?.is_verified ? " (up to 4 files)" : ""}
                            </p>
                          </div>
                        </label>
                        {mediaFiles.length > 0 && (
                          <div className="mt-2 text-sm text-gray-400">
                            {mediaFiles.length} file{mediaFiles.length > 1 ? "s" : ""} selected
                          </div>
                        )}
                      </div>
                    )}

                    {/* Poll Options */}
                    {postType === "poll" && (
                      <div className="space-y-2">
                        {pollOptions.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <Input
                              placeholder={`Option ${index + 1}`}
                              value={option}
                              onChange={(e) => updatePollOption(index, e.target.value)}
                              className="bg-gray-800 border-gray-600 text-white"
                            />
                            {pollOptions.length > 2 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removePollOption(index)}
                                className="text-red-400 hover:text-red-300"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 6 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={addPollOption}
                            className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Option
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center">
                      <div className="text-xs text-gray-400">
                        {user?.is_premium || user?.is_verified ? (
                          <span className="text-purple-400">Premium: Multi-media posts enabled</span>
                        ) : (
                          <span>Upgrade to Premium for multi-media posts</span>
                        )}
                      </div>
                      <Button
                        onClick={handleCreatePost}
                        disabled={!newPost.trim() && mediaFiles.length === 0}
                        className="bg-gradient-to-r from-purple-500 to-blue-500"
                      >
                        Share
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posts Feed */}
          <div className="space-y-4">
            {circle.recent_posts?.map((post: any) => (
              <Card key={post.id} className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={post.author?.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{post.author?.display_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="font-semibold text-white">{post.author?.display_name}</p>
                        <p className="text-gray-400 text-sm">@{post.author?.username}</p>
                        <span className="text-gray-500">•</span>
                        <p className="text-gray-400 text-sm">{formatTimeAgo(post.created_at)}</p>
                        {post.post_type !== "text" && (
                          <Badge variant="outline" className="text-xs">
                            {post.post_type}
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-300 leading-relaxed mb-4">{post.content}</p>

                      {/* Media Display */}
                      {post.media_urls && post.media_urls.length > 0 && (
                        <div
                          className={`grid gap-2 mb-4 ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
                        >
                          {post.media_urls.map((url: string, index: number) => (
                            <div key={index} className="rounded-lg overflow-hidden">
                              {post.post_type === "video" ? (
                                <video controls className="w-full h-auto">
                                  <source src={url} />
                                </video>
                              ) : (
                                <img
                                  src={url || "/placeholder.svg"}
                                  alt="Post media"
                                  className="w-full h-auto object-cover"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Poll Display */}
                      {post.post_type === "poll" && post.poll_options && (
                        <div className="space-y-2 mb-4">
                          {post.poll_options.map((option: string, index: number) => (
                            <Button
                              key={index}
                              variant="outline"
                              className="w-full justify-start text-left border-gray-600 hover:bg-gray-800 bg-transparent"
                            >
                              {option}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center space-x-6">
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors">
                          <span>❤️</span>
                          <span className="text-sm">{post.stats?.[0]?.likes || 0}</span>
                        </button>
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm">{post.stats?.[0]?.comments || 0}</span>
                        </button>
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-green-400 transition-colors">
                          <span>🌿</span>
                          <span className="text-sm">Branch</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chat">
          <CircleChat circleId={circleId} circleName={circle.name} />
        </TabsContent>

        <TabsContent value="events">
          <CircleEvents circleId={circleId} />
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          {/* Member Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">
                  {formatMemberCount(circle.member_count[0]?.count || 0)}
                </div>
                <div className="text-sm text-gray-400">Total Members</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
                <div className="text-2xl font-bold text-white">{circle.stats?.[0]?.active_members || 0}</div>
                <div className="text-sm text-gray-400">Active This Week</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">
                  {circle.staff?.filter((member: any) => member.role === "admin").length +
                    (circle.user_role === "owner" ? 1 : 0)}
                </div>
                <div className="text-sm text-gray-400">Staff Members</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="text-green-500 text-2xl font-bold">+{circle.stats?.[0]?.weekly_growth || 0}%</div>
                <div className="text-sm text-gray-400">Weekly Growth</div>
              </CardContent>
            </Card>
          </div>

          {/* Staff Members */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Circle Staff</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Owner */}
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={circle.owner?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{circle.owner?.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-white">{circle.owner?.display_name}</p>
                    <p className="text-sm text-gray-400">@{circle.owner?.username}</p>
                  </div>
                </div>
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  Owner
                </Badge>
              </div>

              {/* Admins */}
              {circle.staff
                ?.filter((member: any) => member.role === "admin")
                .map((admin: any) => (
                  <div key={admin.user.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={admin.user?.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{admin.user?.display_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-white">{admin.user?.display_name}</p>
                        <p className="text-sm text-gray-400">@{admin.user?.username}</p>
                      </div>
                    </div>
                    <Badge className="bg-red-600 text-white">
                      <Shield className="w-3 h-3 mr-1" />
                      Admin
                    </Badge>
                  </div>
                ))}

              {/* Moderators */}
              {circle.staff
                ?.filter((member: any) => member.role === "moderator")
                .map((moderator: any) => (
                  <div key={moderator.user.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={moderator.user?.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback>{moderator.user?.display_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-white">{moderator.user?.display_name}</p>
                        <p className="text-sm text-gray-400">@{moderator.user?.username}</p>
                      </div>
                    </div>
                    <Badge className="bg-blue-600 text-white">
                      <Shield className="w-3 h-3 mr-1" />
                      Moderator
                    </Badge>
                  </div>
                ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          {/* Circle Rules */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Circle Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {circle.rules?.map((rule: string, index: number) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-white text-sm font-bold">{index + 1}</span>
                    </div>
                    <p className="text-gray-300">{rule}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Circle Stats */}
          <Card className="bg-gray-900/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Circle Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400">
                    {circle.stats?.[0]?.total_posts?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-400">Total Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">
                    {circle.stats?.[0]?.total_comments?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-gray-400">Total Comments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{circle.stats?.[0]?.active_members || 0}</div>
                  <div className="text-sm text-gray-400">Active Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">+{circle.stats?.[0]?.weekly_growth || 0}%</div>
                  <div className="text-sm text-gray-400">Weekly Growth</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Circle Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl bg-gray-900 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Circle Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-white">Circle Name</Label>
                <Input defaultValue={circle.name} className="bg-gray-800 border-gray-600 text-white" />
              </div>
              <div>
                <Label className="text-white">Description</Label>
                <Textarea
                  defaultValue={circle.description}
                  className="bg-gray-800 border-gray-600 text-white"
                  rows={4}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Private Circle</Label>
                  <p className="text-sm text-gray-400">Require approval to join</p>
                </div>
                <Switch defaultChecked={circle.is_private} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Allow Voice Chat</Label>
                  <p className="text-sm text-gray-400">Enable voice channels</p>
                </div>
                <Switch defaultChecked={true} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Allow Video Chat</Label>
                  <p className="text-sm text-gray-400">Enable video channels</p>
                </div>
                <Switch defaultChecked={false} />
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
                onClick={() => {
                  setShowSettings(false)
                  toast({ description: "Circle settings updated!" })
                }}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

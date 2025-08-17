"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
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
  Video,
  Mic,
  Phone,
  Zap,
  Heart,
  Share,
  Bookmark,
  MoreHorizontal,
  Pin,
  Archive,
  Flag
} from "lucide-react"
import { RealTimeChat } from "@/components/messages/real-time-chat"
import { CircleEvents } from "@/components/circles/circle-events"
import { GiftModal } from "@/components/gifting/gift-modal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { formatDistanceToNow } from "date-fns"

interface EnhancedCircleDetailProps {
  circleId: string
}

interface CirclePost {
  id: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
    is_verified: boolean
  }
  content: string
  media_url?: string
  media_type?: 'image' | 'video' | 'audio'
  timestamp: string
  likes: number
  comments: number
  shares: number
  is_liked: boolean
  is_bookmarked: boolean
  is_pinned: boolean
  hashtags: string[]
  mentions: string[]
  poll?: {
    question: string
    options: Array<{
      id: string
      text: string
      votes: number
    }>
    total_votes: number
    expires_at: string
    user_vote?: string
  }
}

interface CircleMember {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_premium: boolean
  is_verified: boolean
  role: 'owner' | 'admin' | 'moderator' | 'member'
  joined_at: string
  last_active?: string
  contribution_score: number
  badges: string[]
}

interface CircleRoom {
  id: string
  name: string
  description?: string
  type: 'text' | 'voice' | 'video'
  is_private: boolean
  member_count: number
  is_active: boolean
  created_by: string
  created_at: string
}

export function EnhancedCircleDetail({ circleId }: EnhancedCircleDetailProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { currentTheme } = useTheme3D()
  
  // State management
  const [circle, setCircle] = useState<any>(null)
  const [posts, setPosts] = useState<CirclePost[]>([])
  const [members, setMembers] = useState<CircleMember[]>([])
  const [rooms, setRooms] = useState<CircleRoom[]>([])
  const [activeTab, setActiveTab] = useState("posts")
  const [activeRoom, setActiveRoom] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [userRole, setUserRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState<any>(null)
  const [notifications, setNotifications] = useState(true)
  const [selectedPoll, setSelectedPoll] = useState<string>("")
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [newRoom, setNewRoom] = useState({
    name: "",
    description: "",
    type: "text" as "text" | "voice" | "video",
    is_private: false
  })

  // Load circle data
  useEffect(() => {
    const loadCircleData = async () => {
      if (!user) return
      
      setLoading(true)
      try {
        // Load circle details
        const circleResponse = await fetch(`/api/circles/${circleId}`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (circleResponse.ok) {
          const circleData = await circleResponse.json()
          setCircle(circleData.circle)
          setIsJoined(circleData.is_member)
          setUserRole(circleData.user_role || 'member')
        }

        // Load posts
        const postsResponse = await fetch(`/api/circles/${circleId}/posts`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (postsResponse.ok) {
          const postsData = await postsResponse.json()
          setPosts(postsData.posts || [])
        }

        // Load members
        const membersResponse = await fetch(`/api/circles/${circleId}/members`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json()
          setMembers(membersData.members || [])
        }

        // Load rooms
        const roomsResponse = await fetch(`/api/circles/${circleId}/rooms`, {
          headers: { 'Authorization': `Bearer ${user.token}` }
        })
        
        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json()
          setRooms(roomsData.rooms || [])
        }

      } catch (error) {
        console.error('Failed to load circle data:', error)
        toast({
          title: "Error",
          description: "Failed to load circle data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    loadCircleData()
  }, [circleId, user])

  // Handle join/leave circle
  const handleJoinLeave = async () => {
    if (!user || !circle) return

    try {
      const response = await fetch(`/api/circles/${circleId}/join`, {
        method: isJoined ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        }
      })

      if (response.ok) {
        setIsJoined(!isJoined)
        setCircle((prev: any) => ({
          ...prev,
          member_count: prev.member_count + (isJoined ? -1 : 1)
        }))
        
        toast({
          description: isJoined ? "Left the circle" : "Joined the circle!"
        })
      }
    } catch (error) {
      console.error('Failed to join/leave circle:', error)
      toast({
        title: "Error",
        description: "Failed to update membership",
        variant: "destructive"
      })
    }
  }

  // Handle create post
  const handleCreatePost = async () => {
    if (!newPost.trim() || !user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          content: newPost,
          media_url: null,
          media_type: null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPosts(prev => [data.post, ...prev])
        setNewPost("")
        toast({ description: "Post shared with the circle!" })
      }
    } catch (error) {
      console.error('Failed to create post:', error)
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive"
      })
    }
  }

  // Handle post interactions
  const handleLike = async (postId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`
        }
      })

      if (response.ok) {
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                is_liked: !post.is_liked,
                likes: post.likes + (post.is_liked ? -1 : 1)
              }
            : post
        ))
      }
    } catch (error) {
      console.error('Failed to like post:', error)
    }
  }

  // Handle poll vote
  const handlePollVote = async (postId: string, optionId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${postId}/poll/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ option_id: optionId })
      })

      if (response.ok) {
        const data = await response.json()
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, poll: data.poll }
            : post
        ))
      }
    } catch (error) {
      console.error('Failed to vote on poll:', error)
    }
  }

  // Handle create room
  const handleCreateRoom = async () => {
    if (!newRoom.name.trim() || !user) return

    try {
      const response = await fetch(`/api/circles/${circleId}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify(newRoom)
      })

      if (response.ok) {
        const data = await response.json()
        setRooms(prev => [...prev, data.room])
        setNewRoom({ name: "", description: "", type: "text", is_private: false })
        setShowCreateRoom(false)
        toast({ description: "Room created successfully!" })
      }
    } catch (error) {
      console.error('Failed to create room:', error)
      toast({
        title: "Error",
        description: "Failed to create room",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading circle...</p>
        </div>
      </div>
    )
  }

  if (!circle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Circle not found</h2>
          <p className="text-gray-600">This circle doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Circle Header */}
        <Card className="mb-6 overflow-hidden">
          <div
            className="h-48 bg-gradient-to-r from-purple-600 to-blue-600 relative"
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

          <CardContent className="relative -mt-16 px-6 pb-6">
            <div className="flex items-end space-x-6">
              <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                <AvatarImage src={circle.avatar_url} alt={circle.name} />
                <AvatarFallback className="text-2xl">{circle.name.charAt(0)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{circle.name}</h1>
                    <div className="flex items-center space-x-4 text-gray-300">
                      <div className="flex items-center space-x-1">
                        <Users className="w-4 h-4" />
                        <span>{circle.member_count} members</span>
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
                          : "bg-gradient-to-r from-purple-500 to-blue-500"
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

                    {userRole === 'owner' && (
                      <a href={`/circles/${circleId}/admin`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-gray-300 hover:bg-gray-800"
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                      </a>
                    )}

                    {userRole === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSettings(true)}
                        className="border-gray-600 text-gray-300 hover:bg-gray-800"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-gray-300 leading-relaxed">{circle.description}</p>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="posts">
              <Hash className="w-4 h-4 mr-2" />
              Posts
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <MessageCircle className="w-4 h-4 mr-2" />
              Rooms
            </TabsTrigger>
            <TabsTrigger value="events">
              <Calendar className="w-4 h-4 mr-2" />
              Events
            </TabsTrigger>
            <TabsTrigger value="members">
              <Users className="w-4 h-4 mr-2" />
              Members
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
            <TabsTrigger value="about">
              <Star className="w-4 h-4 mr-2" />
              About
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-6">
            {/* Create Post */}
            {isJoined && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={user?.avatar_url} />
                      <AvatarFallback>{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-3">
                      <Textarea
                        placeholder="Share something with the circle..."
                        value={newPost}
                        onChange={(e) => setNewPost(e.target.value)}
                        className="resize-none"
                        rows={3}
                      />
                      <div className="flex justify-between items-center">
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-1" />
                            Media
                          </Button>
                          <Button variant="outline" size="sm">
                            <Hash className="w-4 h-4 mr-1" />
                            Poll
                          </Button>
                        </div>
                        <Button
                          onClick={handleCreatePost}
                          disabled={!newPost.trim()}
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
              {posts.map((post) => (
                <Card key={post.id} className="mb-4 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={post.author.avatar_url} alt={post.author.display_name} />
                        <AvatarFallback>{post.author.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold">{post.author.display_name}</span>
                          {post.author.is_verified && (
                            <Badge variant="secondary" className="bg-blue-500 text-white">✓</Badge>
                          )}
                          {post.author.is_premium && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                          <span className="text-sm text-gray-500">
                            {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
                          </span>
                          {post.is_pinned && (
                            <Pin className="w-4 h-4 text-purple-500" />
                          )}
                        </div>

                        <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">
                          {post.content}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`space-x-1 ${post.is_liked ? 'text-red-500' : ''}`}
                              onClick={() => handleLike(post.id)}
                            >
                              <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-current' : ''}`} />
                              <span>{post.likes}</span>
                            </Button>

                            <Button variant="ghost" size="sm" className="space-x-1">
                              <MessageCircle className="w-4 h-4" />
                              <span>{post.comments}</span>
                            </Button>

                            <Button variant="ghost" size="sm" className="space-x-1">
                              <Share className="w-4 h-4" />
                              <span>{post.shares}</span>
                            </Button>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={post.is_bookmarked ? 'text-yellow-500' : ''}
                            >
                              <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? 'fill-current' : ''}`} />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem>
                                  <Gift className="w-4 h-4 mr-2" />
                                  Gift Author
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rooms" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold">Circle Rooms</h3>
              {(userRole === 'owner' || userRole === 'admin' || userRole === 'moderator') && (
                <Button
                  onClick={() => setShowCreateRoom(true)}
                  className="bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Room
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <Card key={room.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{room.name}</h4>
                      <div className="flex items-center space-x-1">
                        {room.type === 'voice' && <Mic className="w-4 h-4 text-green-500" />}
                        {room.type === 'video' && <Video className="w-4 h-4 text-blue-500" />}
                        {room.type === 'text' && <MessageCircle className="w-4 h-4 text-purple-500" />}
                        {room.is_private && <Lock className="w-3 h-3 text-gray-500" />}
                      </div>
                    </div>
                    {room.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {room.member_count} members
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setActiveRoom(room.id)}
                        className="bg-gradient-to-r from-purple-500 to-blue-500"
                      >
                        Join
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Active Room Chat */}
            {activeRoom && (
              <Card className="h-96">
                <RealTimeChat conversationId={activeRoom} />
              </Card>
            )}
          </TabsContent>

          <TabsContent value="events">
            <CircleEvents circleId={circleId} />
          </TabsContent>

          <TabsContent value="members" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => (
                <Card key={member.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={member.avatar_url} alt={member.display_name} />
                        <AvatarFallback>{member.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold">{member.display_name}</span>
                          {member.is_verified && (
                            <Badge variant="secondary" className="bg-blue-500 text-white">✓</Badge>
                          )}
                          {member.is_premium && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-gray-500">@{member.username}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge className={`text-xs ${
                            member.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                            member.role === 'admin' ? 'bg-red-100 text-red-700' :
                            member.role === 'moderator' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {member.role}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {member.contribution_score} points
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setGiftRecipient(member)
                          setShowGiftModal(true)
                        }}
                      >
                        <Gift className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="leaderboard" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {members
                    .sort((a, b) => b.contribution_score - a.contribution_score)
                    .slice(0, 10)
                    .map((member, index) => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                          index === 0 ? 'bg-yellow-100 text-yellow-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {index + 1}
                        </div>
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={member.avatar_url} alt={member.display_name} />
                          <AvatarFallback>{member.display_name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{member.display_name}</span>
                            {member.is_premium && <Crown className="w-4 h-4 text-yellow-500" />}
                          </div>
                          <p className="text-sm text-gray-500">{member.contribution_score} points</p>
                        </div>
                        
{index < 3 && (
                          <Trophy className={`w-5 h-5 ${
                            index === 0 ? 'text-yellow-500' :
                            index === 1 ? 'text-gray-500' :
                            'text-orange-500'
                          }`} />
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="about" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Circle Rules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {circle.rules?.map((rule: string, index: number) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-bold">{index + 1}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{rule}</p>
                    </div>
                  )) || (
                    <p className="text-gray-500">No rules have been set for this circle.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Circle Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{circle.stats?.total_posts || 0}</div>
                    <div className="text-sm text-gray-500">Total Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{circle.stats?.total_comments || 0}</div>
                    <div className="text-sm text-gray-500">Total Comments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{circle.stats?.active_members || 0}</div>
                    <div className="text-sm text-gray-500">Active Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">+{circle.stats?.weekly_growth || 0}%</div>
                    <div className="text-sm text-gray-500">Weekly Growth</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Room Dialog */}
        <Dialog open={showCreateRoom} onOpenChange={setShowCreateRoom}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Room</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="room-name">Room Name</Label>
                <Input
                  id="room-name"
                  value={newRoom.name}
                  onChange={(e) => setNewRoom(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter room name..."
                />
              </div>
              <div>
                <Label htmlFor="room-description">Description (Optional)</Label>
                <Textarea
                  id="room-description"
                  value={newRoom.description}
                  onChange={(e) => setNewRoom(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this room is for..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Room Type</Label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="text"
                      checked={newRoom.type === 'text'}
                      onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                    />
                    <MessageCircle className="w-4 h-4" />
                    <span>Text</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="voice"
                      checked={newRoom.type === 'voice'}
                      onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                    />
                    <Mic className="w-4 h-4" />
                    <span>Voice</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      value="video"
                      checked={newRoom.type === 'video'}
                      onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                    />
                    <Video className="w-4 h-4" />
                    <span>Video</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newRoom.is_private}
                  onCheckedChange={(checked) => setNewRoom(prev => ({ ...prev, is_private: checked }))}
                />
                <Label>Private Room</Label>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setShowCreateRoom(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateRoom} className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">
                  Create Room
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Gift Modal */}
        {showGiftModal && giftRecipient && (
          <GiftModal
            open={showGiftModal}
            onOpenChange={setShowGiftModal}
            recipient={giftRecipient}
            context={{
              type: 'profile',
              id: giftRecipient.id,
              title: giftRecipient.display_name
            }}
          />
        )}
      </div>
    </div>
  )
}

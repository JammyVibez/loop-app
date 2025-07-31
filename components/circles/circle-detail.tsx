"use client"

import { useState } from "react"
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

interface CircleDetailProps {
  circleId: string
}

// Mock circle data
const mockCircle = {
  id: "1",
  name: "Creative Writers",
  description:
    "A community for writers to share stories and collaborate on narrative loops. Join us for weekly writing challenges, feedback sessions, and collaborative storytelling projects.",
  avatar_url: "/placeholder.svg?height=80&width=80",
  banner_url: "/placeholder.svg?height=200&width=800",
  member_count: 1247,
  is_private: false,
  is_member: true,
  is_admin: false,
  is_moderator: false,
  is_owner: false,
  category: "Writing",
  created_at: new Date("2023-06-15"),
  owner: {
    id: "owner1",
    username: "writingmaster",
    display_name: "Writing Master",
    avatar_url: "/placeholder.svg?height=40&width=40",
  },
  admins: [
    {
      id: "admin1",
      username: "storykeeper",
      display_name: "Story Keeper",
      avatar_url: "/placeholder.svg?height=40&width=40",
    },
  ],
  moderators: [
    {
      id: "mod1",
      username: "plottwist",
      display_name: "Plot Twist",
      avatar_url: "/placeholder.svg?height=40&width=40",
    },
  ],
  rules: [
    "Be respectful to all members",
    "No spam or self-promotion without permission",
    "Keep content relevant to writing and storytelling",
    "Use appropriate content warnings for mature themes",
    "Credit original authors when sharing work",
  ],
  current_challenge: {
    title: "Time Travel Stories",
    description: "Write a story involving time travel with an unexpected twist",
    ends_at: new Date("2024-01-22T23:59:59Z"),
    participants: 89,
    prize: "500 Loop Coins + Premium Badge",
  },
  stats: {
    total_posts: 2847,
    total_comments: 15632,
    active_members: 892,
    weekly_growth: 12,
  },
  recent_posts: [
    {
      id: "post1",
      author: {
        id: "user1",
        username: "novelist",
        display_name: "Aspiring Novelist",
        avatar_url: "/placeholder.svg?height=32&width=32",
      },
      content:
        "Just finished my first chapter! Looking for feedback on character development and pacing. The story follows a detective who discovers they can see the last 24 hours of a murder victim's life...",
      timestamp: new Date("2024-01-15T14:30:00Z"),
      likes: 23,
      comments: 8,
      type: "text",
    },
    {
      id: "post2",
      author: {
        id: "user2",
        username: "poet",
        display_name: "Midnight Poet",
        avatar_url: "/placeholder.svg?height=32&width=32",
      },
      content: "New poem inspired by our writing prompt: 'Whispers in the Digital Age'",
      timestamp: new Date("2024-01-15T13:15:00Z"),
      likes: 45,
      comments: 12,
      type: "text",
    },
  ],
}

export function CircleDetail({ circleId }: CircleDetailProps) {
  const [circle, setCircle] = useState(mockCircle)
  const [activeTab, setActiveTab] = useState("posts")
  const [isJoined, setIsJoined] = useState(circle.is_member)
  const [showSettings, setShowSettings] = useState(false)
  const [showMemberManagement, setShowMemberManagement] = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [newPost, setNewPost] = useState("")
  const { toast } = useToast()
  const { user } = useAuth()

  const isStaff = circle.is_owner || circle.is_admin || circle.is_moderator

  const handleJoinLeave = () => {
    if (isJoined) {
      setIsJoined(false)
      setCircle((prev) => ({ ...prev, member_count: prev.member_count - 1 }))
      toast({ description: "Left the circle" })
    } else {
      if (circle.is_private) {
        toast({
          title: "Request Sent",
          description: "Your request to join this private circle has been sent to moderators.",
        })
      } else {
        setIsJoined(true)
        setCircle((prev) => ({ ...prev, member_count: prev.member_count + 1 }))
        toast({ description: "Joined the circle!" })
      }
    }
  }

  const handleCreatePost = () => {
    if (!newPost.trim()) return

    const post = {
      id: Date.now().toString(),
      author: {
        id: user?.id || "current",
        username: user?.username || "user",
        display_name: user?.display_name || "User",
        avatar_url: user?.avatar_url || "/placeholder.svg",
      },
      content: newPost,
      timestamp: new Date(),
      likes: 0,
      comments: 0,
      type: "text" as const,
    }

    setCircle((prev) => ({
      ...prev,
      recent_posts: [post, ...prev.recent_posts],
    }))

    setNewPost("")
    toast({ description: "Post shared with the circle!" })
  }

  const formatMemberCount = (count: number) => {
    if (count >= 1000) return (count / 1000).toFixed(1) + "K"
    return count.toString()
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return "Just now"
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-yellow-500" />
      case "admin":
        return <Shield className="w-4 h-4 text-red-500" />
      case "moderator":
        return <Shield className="w-4 h-4 text-blue-500" />
      default:
        return null
    }
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
                      <span>{formatMemberCount(circle.member_count)} members</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-4 h-4" />
                      <span>Created {circle.created_at.toLocaleDateString()}</span>
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
                        {circle.is_private ? "Leave" : "Leave"}
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
      {circle.current_challenge && (
        <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <div>
                  <h3 className="text-xl font-bold text-white">{circle.current_challenge.title}</h3>
                  <p className="text-gray-300">{circle.current_challenge.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Prize: {circle.current_challenge.prize}</p>
                <p className="text-sm text-gray-400">{circle.current_challenge.participants} participants</p>
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
                    <Textarea
                      placeholder="Share something with the circle..."
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-400 resize-none"
                      rows={3}
                    />
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Media
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-gray-600 text-gray-300 hover:bg-gray-800 bg-transparent"
                        >
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
            {circle.recent_posts.map((post) => (
              <Card key={post.id} className="bg-gray-900/50 border-gray-700">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={post.author.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{post.author.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <p className="font-semibold text-white">{post.author.display_name}</p>
                        <p className="text-gray-400 text-sm">@{post.author.username}</p>
                        <span className="text-gray-500">•</span>
                        <p className="text-gray-400 text-sm">{formatTimeAgo(post.timestamp)}</p>
                      </div>
                      <p className="text-gray-300 leading-relaxed mb-4">{post.content}</p>
                      <div className="flex items-center space-x-6">
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-red-400 transition-colors">
                          <span>❤️</span>
                          <span className="text-sm">{post.likes}</span>
                        </button>
                        <button className="flex items-center space-x-2 text-gray-400 hover:text-blue-400 transition-colors">
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-sm">{post.comments}</span>
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
                <div className="text-2xl font-bold text-white">{formatMemberCount(circle.member_count)}</div>
                <div className="text-sm text-gray-400">Total Members</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <div className="w-3 h-3 bg-white rounded-full" />
                </div>
                <div className="text-2xl font-bold text-white">{circle.stats.active_members}</div>
                <div className="text-sm text-gray-400">Active This Week</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <Crown className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{circle.admins.length + 1}</div>
                <div className="text-sm text-gray-400">Staff Members</div>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-700">
              <CardContent className="p-4 text-center">
                <div className="text-green-500 text-2xl font-bold">+{circle.stats.weekly_growth}%</div>
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
                    <AvatarImage src={circle.owner.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback>{circle.owner.display_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold text-white">{circle.owner.display_name}</p>
                    <p className="text-sm text-gray-400">@{circle.owner.username}</p>
                  </div>
                </div>
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                  <Crown className="w-3 h-3 mr-1" />
                  Owner
                </Badge>
              </div>

              {/* Admins */}
              {circle.admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={admin.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{admin.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-white">{admin.display_name}</p>
                      <p className="text-sm text-gray-400">@{admin.username}</p>
                    </div>
                  </div>
                  <Badge className="bg-red-600 text-white">
                    <Shield className="w-3 h-3 mr-1" />
                    Admin
                  </Badge>
                </div>
              ))}

              {/* Moderators */}
              {circle.moderators.map((mod) => (
                <div key={mod.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={mod.avatar_url || "/placeholder.svg"} />
                      <AvatarFallback>{mod.display_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-white">{mod.display_name}</p>
                      <p className="text-sm text-gray-400">@{mod.username}</p>
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
                {circle.rules.map((rule, index) => (
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
                  <div className="text-2xl font-bold text-purple-400">{circle.stats.total_posts.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Total Posts</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{circle.stats.total_comments.toLocaleString()}</div>
                  <div className="text-sm text-gray-400">Total Comments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{circle.stats.active_members}</div>
                  <div className="text-sm text-gray-400">Active Members</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">+{circle.stats.weekly_growth}%</div>
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

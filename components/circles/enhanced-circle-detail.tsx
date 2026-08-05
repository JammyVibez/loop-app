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
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { RichContent } from "@/components/content/rich-content"
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
  Flag,
  Sparkles
} from "lucide-react"
import { RealtimeCircleChat } from "@/components/circles/realtime-circle-chat"
import { CircleEvents } from "@/components/circles/circle-events"
import { CommunityAdvancedPanel } from "@/components/circles/community-advanced-panel"
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

function mapCirclePost(post: any): CirclePost {
  const rawAuthor = Array.isArray(post?.author) ? post.author[0] : post?.author
  const author = {
    id: rawAuthor?.id || post?.author_id || "",
    username: rawAuthor?.username || "member",
    display_name: rawAuthor?.display_name || rawAuthor?.username || "Member",
    avatar_url: rawAuthor?.avatar_url,
    is_premium: Boolean(rawAuthor?.is_premium),
    is_verified: Boolean(rawAuthor?.is_verified),
  }
  return {
    id: post?.id,
    author,
    content: post?.content || "",
    media_url: post?.media_url || undefined,
    media_type: post?.media_type || undefined,
    timestamp: post?.timestamp || post?.created_at || new Date().toISOString(),
    likes: Number(post?.likes ?? post?.like_count ?? 0),
    comments: Number(post?.comments ?? post?.comment_count ?? 0),
    shares: Number(post?.shares ?? post?.share_count ?? 0),
    is_liked: Boolean(post?.is_liked),
    is_bookmarked: Boolean(post?.is_bookmarked),
    is_pinned: Boolean(post?.is_pinned),
    hashtags: Array.isArray(post?.hashtags) ? post.hashtags : [],
    mentions: Array.isArray(post?.mentions) ? post.mentions : [],
  }
}

function mapCircleMember(member: any): CircleMember {
  const profile =
    (Array.isArray(member?.user) ? member.user[0] : member?.user) ||
    (Array.isArray(member?.profile) ? member.profile[0] : member?.profile) ||
    {}
  return {
    id: member?.user_id || profile?.id || member?.id,
    username: profile?.username || "member",
    display_name: profile?.display_name || profile?.username || "Member",
    avatar_url: profile?.avatar_url,
    is_premium: Boolean(profile?.is_premium),
    is_verified: Boolean(profile?.is_verified),
    role: member?.role || "member",
    joined_at: member?.joined_at || new Date().toISOString(),
    last_active: profile?.last_active,
    contribution_score: Number(member?.contribution_score || 0),
    badges: Array.isArray(member?.badges) ? member.badges : [],
  }
}

export function EnhancedCircleDetail({ circleId }: EnhancedCircleDetailProps) {
  const { user, loading: authLoading, getAuthHeader } = useAuth()
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
  const [membershipPending, setMembershipPending] = useState(false)
  const [userRole, setUserRole] = useState<string>('member')
  const [loading, setLoading] = useState(true)
  const [newPost, setNewPost] = useState("")
  const [showSettings, setShowSettings] = useState(false)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [giftRecipient, setGiftRecipient] = useState<any>(null)
  const [notifications, setNotifications] = useState(true)
  const [selectedPoll, setSelectedPoll] = useState<string>("")
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [commentsPost, setCommentsPost] = useState<CirclePost | null>(null)
  const [postComments, setPostComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState("")
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentSending, setCommentSending] = useState(false)
  const [newRoom, setNewRoom] = useState({
    name: "",
    description: "",
    type: "text" as "text" | "voice" | "video",
    is_private: false
  })

  const studio = circle?.settings?.community_studio || {}
  const design = circle?.settings?.marketplace?.design || {}
  const styling = circle?.settings?.marketplace?.styling || {}
  const layout =
    design.layout ||
    studio.layout ||
    "default"
  const accent =
    styling.css_variables?.["--circle-accent"] ||
    design.colors?.secondary ||
    studio.accent ||
    "#22d3ee"
  const primary =
    styling.css_variables?.["--circle-primary"] ||
    design.colors?.primary ||
    "#7c3aed"
  const surface =
    styling.css_variables?.["--circle-surface"] ||
    design.colors?.background ||
    undefined
  const radius = styling.css_variables?.["--circle-radius"] || "1rem"
  const cardStyle = styling.card_style || design.header_style || "default"
  const layoutClass =
    layout === "immersive-hero" || layout === "cinematic"
      ? "circle-layout-cinematic"
      : layout === "forum"
        ? "circle-layout-forum"
        : layout === "compact" || layout === "minimal"
          ? "circle-layout-compact"
          : "circle-layout-default"

  // Load circle data
  useEffect(() => {
    const loadCircleData = async () => {
      if (authLoading) return

      if (!user) {
        setLoading(false)
        return
      }
      
      setLoading(true)
      try {
        // Load circle details
        const circleResponse = await fetch(`/api/circles/${circleId}`, {
          headers: getAuthHeader()
        })
        
        if (circleResponse.ok) {
          const circleData = await circleResponse.json()
          setCircle(circleData.circle)
          setIsJoined(Boolean(circleData.is_member ?? circleData.circle?.is_member))
          setMembershipPending(
            (circleData.membership_status ?? circleData.circle?.membership_status) === "pending"
          )
          setUserRole(circleData.user_role || circleData.circle?.user_role || 'member')
          setPosts((circleData.posts || []).map(mapCirclePost))
          setRooms((circleData.rooms || []).map((room: any) => ({
            ...room,
            type: room.type || room.room_type || "text",
            member_count: Number(room.member_count || 0),
          })))
        }

        // Load posts
        const postsResponse = await fetch(`/api/circles/${circleId}/posts`, {
          headers: getAuthHeader()
        })
        
        if (postsResponse.ok) {
          const postsData = await postsResponse.json()
          setPosts((postsData.posts || []).map(mapCirclePost))
        }

        // Load members
        const membersResponse = await fetch(`/api/circles/${circleId}/members`, {
          headers: getAuthHeader()
        })
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json()
          setMembers((membersData.members || []).map(mapCircleMember))
        }

        // Load rooms
        const roomsResponse = await fetch(`/api/circles/${circleId}/rooms`, {
          headers: getAuthHeader()
        })
        
        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json()
          setRooms((roomsData.rooms || []).map((room: any) => ({
            ...room,
            type: room.type || room.room_type || "text",
            member_count: Number(room.member_count || 0),
          })))
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
  }, [circleId, user, authLoading])

  // Handle join/leave circle
  const handleJoinLeave = async () => {
    if (!user || !circle) return

    const leaving = isJoined || membershipPending

    try {
      const response = await fetch(`/api/circles/${circleId}/join`, {
        method: leaving ? 'DELETE' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        }
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to update membership")

      if (leaving) {
        setIsJoined(false)
        setMembershipPending(false)
        setCircle((prev: any) => ({
          ...prev,
          member_count: Math.max(0, prev.member_count - (isJoined ? 1 : 0)),
        }))
        toast({ description: membershipPending ? "Join request cancelled" : "Left the circle" })
      } else {
        // Private circles come back with status "pending" — the user has NOT
        // actually joined yet and must wait for a moderator to approve them.
        // This used to be ignored, which showed "Joined!" and unlocked the
        // post composer client-side even though the backend still rejected
        // their posts/comments with 403 until approved.
        const joined = data.status === "active"
        setIsJoined(joined)
        setMembershipPending(data.status === "pending")
        if (joined) {
          setCircle((prev: any) => ({ ...prev, member_count: prev.member_count + 1 }))
        }
        toast({
          title: data.status === "pending" ? "Request sent 📨" : undefined,
          description:
            data.status === "pending"
              ? "A moderator will need to approve your request before you can post or chat."
              : "Joined the circle!",
        })
      }
    } catch (error: any) {
      console.error('Failed to join/leave circle:', error)
      toast({
        title: "Error",
        description: error?.message || "Failed to update membership",
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
          ...getAuthHeader()
        },
        body: JSON.stringify({
          content: newPost,
          media_url: null,
          media_type: null
        })
      })

      if (response.ok) {
        const data = await response.json()
        setPosts(prev => [mapCirclePost(data.post), ...prev])
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
      const response = await fetch(`/api/circles/${circleId}/posts/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ action: 'like' })
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

  const openComments = async (post: CirclePost) => {
    setCommentsPost(post)
    setCommentText("")
    setCommentsLoading(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${post.id}/comments`, {
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to load comments")
      setPostComments(data.comments || [])
    } catch (error: any) {
      toast({ title: "Comments unavailable", description: error.message, variant: "destructive" })
      setPostComments([])
    } finally {
      setCommentsLoading(false)
    }
  }

  const submitComment = async () => {
    if (!commentsPost || !commentText.trim() || !user) return
    setCommentSending(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${commentsPost.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content: commentText.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to comment")
      setPostComments((prev) => [...prev, data.comment])
      setCommentText("")
      setPosts((prev) =>
        prev.map((post) =>
          post.id === commentsPost.id ? { ...post, comments: Number(post.comments || 0) + 1 } : post,
        ),
      )
      setCommentsPost((prev) => (prev ? { ...prev, comments: Number(prev.comments || 0) + 1 } : prev))
    } catch (error: any) {
      toast({ title: "Comment failed", description: error.message, variant: "destructive" })
    } finally {
      setCommentSending(false)
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
          ...getAuthHeader()
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
          ...getAuthHeader()
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading circle...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold mb-2">Sign in to view this circle</h2>
          <p className="text-gray-600">Community pages require an account.</p>
          <a href="/login" className="inline-flex rounded-full bg-violet-600 px-4 py-2 text-sm text-white">Log in</a>
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
    <div
      className={`w-full space-y-4 sm:space-y-6 ${layoutClass}`}
      style={
        {
          "--circle-accent": accent,
          "--circle-primary": primary,
          "--circle-surface": surface || "transparent",
          "--circle-radius": radius,
        } as React.CSSProperties
      }
    >
      {/* Circle Header */}
      <Card
        className={`overflow-hidden border-border bg-card text-card-foreground ${
          cardStyle === "glass" ? "bg-background/70 backdrop-blur-xl" : ""
        }`}
        style={{ borderRadius: "var(--circle-radius)" }}
      >
        <div
          className={`relative ${
            layoutClass === "circle-layout-cinematic" ? "h-44 sm:h-56" : layoutClass === "circle-layout-compact" ? "h-24 sm:h-32" : "h-32 sm:h-44"
          }`}
          style={{
            backgroundImage: circle.banner_url
              ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.4)), url(${circle.banner_url})`
              : `linear-gradient(120deg, var(--circle-primary), var(--circle-accent))`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-black/25" />
          {(design.title || styling.css_variables || layout !== "default") && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-cyan-300 border border-cyan-500/30 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              Layout Pack: {layout.toUpperCase()}
            </div>
          )}
          <div className="absolute right-3 top-3 flex max-w-[70%] flex-wrap justify-end gap-1.5 sm:right-4 sm:top-4 sm:gap-2">
            {circle.is_private ? (
              <Badge className="bg-slate-900/80 text-white">
                <Lock className="mr-1 h-3 w-3" />
                Private
              </Badge>
            ) : (
              <Badge className="bg-emerald-600/90 text-white">
                <Globe className="mr-1 h-3 w-3" />
                Public
              </Badge>
            )}
            {circle.category && (
              <Badge style={{ backgroundColor: accent }} className="text-slate-950">
                {circle.category}
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="relative -mt-10 space-y-4 px-3 pb-4 sm:-mt-12 sm:px-6 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg sm:h-24 sm:w-24">
              <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name || "Circle"} />
              <AvatarFallback className="text-2xl">{(circle.name || "C").charAt(0)}</AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{circle.name || "Circle"}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {Number(circle.member_count || 0)} members
                  </span>
                  {circle.created_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Created {new Date(circle.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isJoined && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNotifications(!notifications)}
                    className="rounded-full"
                    aria-label={notifications ? "Mute notifications" : "Enable notifications"}
                  >
                    {notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  </Button>
                )}

                <Button
                  onClick={handleJoinLeave}
                  size="sm"
                  className={
                    isJoined || membershipPending
                      ? "rounded-full"
                      : "rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
                  }
                  variant={isJoined || membershipPending ? "outline" : "default"}
                  title={membershipPending ? "Click to cancel your join request" : undefined}
                >
                  {isJoined ? (
                    <>
                      <UserMinus className="mr-1.5 h-4 w-4" />
                      Leave
                    </>
                  ) : membershipPending ? (
                    <>
                      <Users className="mr-1.5 h-4 w-4" />
                      Request Pending
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-1.5 h-4 w-4" />
                      {circle.is_private ? "Request" : "Join"}
                    </>
                  )}
                </Button>

                {(userRole === "owner" || userRole === "admin") && (
                  <Button asChild variant="outline" size="sm" className="rounded-full border-amber-400/40 bg-amber-500/10">
                    <a href={`/circles/${circleId}/admin`}>
                      <Crown className="mr-1.5 h-4 w-4" />
                      <span className="hidden xs:inline sm:inline">Circle Admin</span>
                      <span className="sm:hidden">Admin</span>
                    </a>
                  </Button>
                )}

                {(userRole === "owner" || userRole === "admin") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettings(true)}
                    className="rounded-full"
                    aria-label="Circle settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {circle.description && (
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{circle.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto min-w-full w-max gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:min-w-0 sm:w-full sm:flex-wrap">
            {[
              { value: "posts", label: "Posts", icon: Hash },
              { value: "rooms", label: "Rooms", icon: MessageCircle },
              { value: "events", label: "Events", icon: Calendar },
              { value: "members", label: "Members", icon: Users },
              { value: "leaderboard", label: "Board", icon: Trophy },
              { value: "about", label: "About", icon: Star },
              { value: "studio", label: "Studio", icon: Settings },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="shrink-0 rounded-xl px-3 py-2 text-xs data-[state=active]:bg-background sm:text-sm"
              >
                <tab.icon className="mr-1.5 h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="posts" className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
          {/* Create Post */}
          {isJoined && (
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback>{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-3">
                    <MentionTextarea
                      placeholder="Share something… type @ to tag members"
                      value={newPost}
                      onChange={setNewPost}
                      className="resize-none"
                      rows={3}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" type="button">
                          <Plus className="mr-1 h-4 w-4" />
                          Media
                        </Button>
                        <Button variant="outline" size="sm" type="button">
                          <Hash className="mr-1 h-4 w-4" />
                          Poll
                        </Button>
                      </div>
                      <Button
                        onClick={handleCreatePost}
                        disabled={!newPost.trim()}
                        className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
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
          <div className="space-y-3 sm:space-y-4">
            {posts.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  No posts yet. Be the first to share something.
                </CardContent>
              </Card>
            )}
            {posts.map((post) => {
              const authorName = post.author?.display_name || post.author?.username || "Member"
              const stamped = (() => {
                try {
                  return formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })
                } catch {
                  return "just now"
                }
              })()
              return (
                <Card key={post.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-3 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-9 w-9 shrink-0 sm:h-10 sm:w-10">
                        <AvatarImage src={post.author?.avatar_url} alt={authorName} />
                        <AvatarFallback>{authorName.charAt(0)}</AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate font-semibold">{authorName}</span>
                          {post.author?.is_verified && (
                            <Badge variant="secondary" className="text-[10px]">✓</Badge>
                          )}
                          {post.author?.is_premium && <Crown className="h-4 w-4 text-yellow-500" />}
                          <span className="text-xs text-muted-foreground">{stamped}</span>
                          {post.is_pinned && <Pin className="h-4 w-4 text-violet-500" />}
                        </div>

                        <RichContent
                          text={post.content}
                          className="mb-3 text-sm leading-relaxed sm:text-base"
                        />

                        {post.media_url && (
                          <div className="mb-3 overflow-hidden rounded-xl border border-border/60">
                            {post.media_type === "video" ? (
                              <video src={post.media_url} controls className="max-h-96 w-full bg-black object-contain" />
                            ) : (
                              <img src={post.media_url} alt="Post media" className="max-h-96 w-full object-cover" />
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`px-2 ${post.is_liked ? "text-red-500" : ""}`}
                              onClick={() => handleLike(post.id)}
                            >
                              <Heart className={`mr-1 h-4 w-4 ${post.is_liked ? "fill-current" : ""}`} />
                              <span>{post.likes}</span>
                            </Button>

                            <Button variant="ghost" size="sm" className="px-2" onClick={() => openComments(post)}>
                              <MessageCircle className="mr-1 h-4 w-4" />
                              <span>{post.comments}</span>
                            </Button>

                            <Button variant="ghost" size="sm" className="hidden px-2 xs:inline-flex sm:inline-flex">
                              <Share className="mr-1 h-4 w-4" />
                              <span className="hidden sm:inline">{post.shares}</span>
                            </Button>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={post.is_bookmarked ? "text-yellow-500" : ""}
                            >
                              <Bookmark className={`h-4 w-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Gift className="mr-2 h-4 w-4" />
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
              )
            })}
          </div>
        </TabsContent>

          <TabsContent value="rooms" className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold sm:text-xl">Circle Rooms</h3>
              {(userRole === 'owner' || userRole === 'admin' || userRole === 'moderator') && (
                <Button
                  onClick={() => setShowCreateRoom(true)}
                  className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Room
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {rooms.map((room) => (
                <Card key={room.id} className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="truncate font-semibold">{room.name}</h4>
                      <div className="flex shrink-0 items-center gap-1">
                        {room.type === 'voice' && <Mic className="h-4 w-4 text-emerald-500" />}
                        {room.type === 'video' && <Video className="h-4 w-4 text-sky-500" />}
                        {room.type === 'text' && <MessageCircle className="h-4 w-4 text-violet-500" />}
                        {room.is_private && <Lock className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </div>
                    {room.description && (
                      <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                        {room.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-muted-foreground">
                        {Number(room.member_count || 0)} members
                      </span>
                      <Button
                        size="sm"
                        onClick={() => setActiveRoom(room.id)}
                        className="rounded-full"
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
              <RealtimeCircleChat
                circleId={circleId}
                roomId={activeRoom}
                roomName={rooms.find((room) => room.id === activeRoom)?.name || "room"}
              />
            )}
          </TabsContent>

          <TabsContent value="events">
            <CircleEvents circleId={circleId} isAdmin={userRole === "owner" || userRole === "admin" || userRole === "moderator"} />
          </TabsContent>

          <TabsContent value="members" className="mt-4 space-y-4 sm:mt-6 sm:space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {members.map((member) => {
                const name = member.display_name || member.username || "Member"
                return (
                <Card key={member.id} className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={member.avatar_url} alt={name} />
                        <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{name}</span>
                          {member.is_verified && (
                            <Badge variant="secondary" className="text-[10px]">✓</Badge>
                          )}
                          {member.is_premium && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">@{member.username}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs capitalize">
                            {member.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {member.contribution_score} points
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 rounded-full"
                        onClick={() => {
                          setGiftRecipient(member)
                          setShowGiftModal(true)
                        }}
                      >
                        <Gift className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )})}
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
                          <AvatarImage src={member.avatar_url} alt={member.display_name || member.username} />
                          <AvatarFallback>{(member.display_name || member.username || "?").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium truncate">{member.display_name || member.username}</span>
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
                  {Array.isArray(circle.rules) && circle.rules.length > 0 ? (
                    circle.rules.map((rule: string, index: number) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-bold">{index + 1}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300">{String(rule)}</p>
                    </div>
                    ))
                  ) : (
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

          <TabsContent value="studio" className="space-y-6">
            <CommunityAdvancedPanel
              circleId={circleId}
              canManage={userRole === "owner" || userRole === "admin" || userRole === "moderator"}
            />
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

        <Dialog open={Boolean(commentsPost)} onOpenChange={(open) => !open && setCommentsPost(null)}>
          <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Comments</DialogTitle>
            </DialogHeader>
            <div className="flex max-h-[60vh] flex-col gap-3">
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {commentsLoading ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Loading comments…</p>
                ) : postComments.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No comments yet. Be the first.</p>
                ) : (
                  postComments.map((comment) => {
                    const author = Array.isArray(comment.author) ? comment.author[0] : comment.author
                    const name = author?.display_name || author?.username || "Member"
                    return (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={author?.avatar_url} />
                          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 rounded-2xl bg-muted/50 px-3 py-2">
                          <div className="mb-0.5 flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(comment.created_at || Date.now()), { addSuffix: true })}
                            </span>
                          </div>
                          <RichContent text={comment.content} className="text-sm" />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="flex items-end gap-2 border-t pt-3">
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  placeholder={isJoined ? "Write a comment… @ to tag" : "Join the circle to comment"}
                  disabled={!isJoined || commentSending}
                  className="min-h-[44px] max-h-28 resize-none"
                  rows={2}
                />
                <Button
                  onClick={submitComment}
                  disabled={!isJoined || !commentText.trim() || commentSending}
                  className="rounded-full"
                >
                  Post
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  )
}

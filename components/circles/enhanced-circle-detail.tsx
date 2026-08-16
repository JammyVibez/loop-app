"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
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
  Sparkles,
  X,
  Loader2,
  Image as ImageIcon,
  Edit,
  Trash2,
  Link2,
  ArrowLeft,
  Tag,
  Settings2,
  Reply,
} from "lucide-react"
import { RealtimeCircleChat } from "@/components/circles/realtime-circle-chat"
import { SlackCircleWorkspace } from "@/components/circles/slack-circle-workspace"
import { CircleEvents } from "@/components/circles/circle-events"
import { CommunityAdvancedPanel } from "@/components/circles/community-advanced-panel"
import { GiftModal } from "@/components/gifting/gift-modal"
import { CirclePostPollWidget } from "@/components/circles/circle-post-poll-widget"
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { useTheme3D } from "@/providers/theme-3d-provider"
import { formatDistanceToNow } from "date-fns"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { supabase } from "@/lib/supabase"
import { absoluteAppUrl, shareContent } from "@/lib/share"

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
    level?: number
    cosmetics?: any
    active_cosmetics?: any
  }
  content: string
  media_url?: string
  media_urls?: string[]
  media_type?: 'image' | 'video' | 'audio'
  timestamp: string
  updated_at?: string
  likes: number
  comments: number
  shares: number
  is_liked: boolean
  is_bookmarked: boolean
  is_pinned: boolean
  hashtags: string[]
  tags: string[]
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
  type: 'text' | 'voice' | 'video' | 'announcement'
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
    level: Number(rawAuthor?.level || 1),
    cosmetics: rawAuthor?.cosmetics || rawAuthor?.active_cosmetics,
    active_cosmetics: rawAuthor?.active_cosmetics || rawAuthor?.cosmetics,
  }
  return {
    id: post?.id,
    author,
    content: post?.content || "",
    media_url: post?.media_url || undefined,
    media_urls: Array.isArray(post?.media_urls) && post.media_urls.length ? post.media_urls : post?.media_url ? [post.media_url] : [],
    media_type: post?.media_type || undefined,
    timestamp: post?.timestamp || post?.created_at || new Date().toISOString(),
    updated_at: post?.updated_at || undefined,
    likes: Number(post?.likes ?? post?.like_count ?? 0),
    comments: Number(post?.comments ?? post?.comment_count ?? 0),
    shares: Number(post?.shares ?? post?.share_count ?? 0),
    is_liked: Boolean(post?.is_liked),
    is_bookmarked: Boolean(post?.is_bookmarked),
    is_pinned: Boolean(post?.is_pinned),
    hashtags: Array.isArray(post?.hashtags) ? post.hashtags : [],
    tags: Array.isArray(post?.tags) ? post.tags : [],
    mentions: Array.isArray(post?.mentions) ? post.mentions : [],
    poll: post?.poll
      ? {
          question: post.poll.question,
          options: post.poll.options || [],
          total_votes: Number(post.poll.total_votes || 0),
          expires_at: post.poll.expires_at,
          user_vote: post.poll.user_vote,
        }
      : undefined,
  }
}

function isOwnCirclePost(post: CirclePost, userId?: string | null) {
  if (!userId) return false
  return String(post.author?.id || "") === String(userId)
}

function wasCirclePostEdited(post: CirclePost) {
  if (!post.updated_at || !post.timestamp) return false
  const created = new Date(post.timestamp).getTime()
  const updated = new Date(post.updated_at).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return false
  return updated - created > 2000
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
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== "undefined") {
      const ref = document.referrer
      if (ref && ref.startsWith(window.location.origin) && !ref.includes(`/circles/${circleId}`)) {
        router.back()
        return
      }
    }
    router.push("/circles")
  }

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
  const [newPostMedia, setNewPostMedia] = useState<string[]>([])
  const [uploadingPostMedia, setUploadingPostMedia] = useState(false)
  const [showPollBuilder, setShowPollBuilder] = useState(false)
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [postingCircle, setPostingCircle] = useState(false)
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [submittingReply, setSubmittingReply] = useState(false)
  // Admin-curated post tags
  const [circleTags, setCircleTags] = useState<any[]>([])
  const [postTags, setPostTags] = useState<string[]>([])
  const [showTagManager, setShowTagManager] = useState(false)
  const [newTagName, setNewTagName] = useState("")
  const [savingTag, setSavingTag] = useState(false)
  const [editingPost, setEditingPost] = useState<CirclePost | null>(null)
  const [editPostContent, setEditPostContent] = useState("")
  const [savingPostEdit, setSavingPostEdit] = useState(false)
  const [deletePostId, setDeletePostId] = useState<string | null>(null)
  const [deletingPost, setDeletingPost] = useState(false)
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null)
  const [doubleTapPostId, setDoubleTapPostId] = useState<string | null>(null)
  const [newRoom, setNewRoom] = useState({
    name: "",
    description: "",
    type: "text" as "text" | "voice" | "video" | "announcement",
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

        // Load the admin-curated tag vocabulary
        const tagsResponse = await fetch(`/api/circles/${circleId}/tags`)
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json()
          setCircleTags(tagsData.tags || [])
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

  // Refetches just the posts feed — used by the realtime subscription below
  // so new posts/comments/likes from other members show up without a full
  // page reload. Previously this feed was fetch-once-on-load only, while
  // circle rooms and the admin dashboard already had live updates.
  const refreshPosts = async () => {
    try {
      const response = await fetch(`/api/circles/${circleId}/posts`, { headers: getAuthHeader() })
      if (response.ok) {
        const data = await response.json()
        setPosts((data.posts || []).map(mapCirclePost))
      }
    } catch (error) {
      console.error("Failed to refresh circle posts:", error)
    }
  }

  useEffect(() => {
    if (!circleId || !isJoined) return

    const channel = supabase
      .channel(`circle-feed:${circleId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_posts", filter: `circle_id=eq.${circleId}` },
        () => void refreshPosts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circle_post_comments", filter: `circle_id=eq.${circleId}` },
        () => void refreshPosts(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, isJoined])

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

  // Pro (is_premium): up to 10 media files. Verified: 4. Everyone else: 1 —
  // same tiers as loop posts (components/create-loop-button.tsx getMaxFiles).
  const getMaxCirclePostFiles = () => (user?.is_premium ? 10 : user?.is_verified ? 4 : 1)

  const handlePickPostMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (!files.length) return

    const maxFiles = getMaxCirclePostFiles()
    if (newPostMedia.length >= maxFiles) {
      toast({
        title: `Up to ${maxFiles} files`,
        description: user?.is_premium ? "You've reached the file limit." : "Upgrade to Pro for up to 10 files per post.",
        variant: "destructive",
      })
      return
    }

    setUploadingPostMedia(true)
    try {
      const allowed = files.slice(0, Math.max(0, maxFiles - newPostMedia.length))
      const uploaded = await Promise.all(
        allowed.map((file) => uploadMediaFile(file, { type: "image", folder: "circle-posts", authHeaders: getAuthHeader() })),
      )
      setNewPostMedia((prev) => [...prev, ...uploaded.map((u) => u.url)])
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Could not upload file.", variant: "destructive" })
    } finally {
      setUploadingPostMedia(false)
    }
  }

  const handleRemovePostMedia = (url: string) => {
    setNewPostMedia((prev) => prev.filter((u) => u !== url))
  }

  // Handle create post
  const handleCreatePost = async () => {
    if (!user) return
    const pollPayload =
      showPollBuilder && pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2
        ? { question: pollQuestion.trim(), options: pollOptions.filter((o) => o.trim()) }
        : null

    if (!newPost.trim() && newPostMedia.length === 0 && !pollPayload) return

    setPostingCircle(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({
          content: newPost,
          media_urls: newPostMedia,
          media_type: newPostMedia.length ? "image" : null,
          poll: pollPayload,
          tags: postTags,
        })
      })

      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setPosts(prev => [mapCirclePost(data.post), ...prev])
        setNewPost("")
        setNewPostMedia([])
        setShowPollBuilder(false)
        setPollQuestion("")
        setPollOptions(["", ""])
        setPostTags([])
        toast({ description: "Post shared with the circle!" })
      } else {
        toast({ title: "Couldn't post", description: data.error || "Failed to create post", variant: "destructive" })
      }
    } catch (error) {
      console.error('Failed to create post:', error)
      toast({
        title: "Error",
        description: "Failed to create post",
        variant: "destructive"
      })
    } finally {
      setPostingCircle(false)
    }
  }

  // --- Circle tag helpers (admin-curated vocabulary) ---
  const isStaff = ["owner", "admin", "moderator"].includes(userRole)
  const togglePostTag = (name: string) => {
    setPostTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name].slice(0, 5)))
  }

  const handleCreateTag = async () => {
    const name = newTagName.trim()
    if (!name || savingTag) return
    setSavingTag(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create tag")
      setCircleTags((prev) => [...prev, data.tag])
      setNewTagName("")
      toast({ description: `Tag “${data.tag.name}” added — members can now tag posts with it.` })
    } catch (error: any) {
      toast({ title: "Couldn't create tag", description: error.message, variant: "destructive" })
    } finally {
      setSavingTag(false)
    }
  }

  const handleDeleteTag = async (tagId: string, name: string) => {
    try {
      const res = await fetch(`/api/circles/${circleId}/tags/${tagId}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete tag")
      }
      setCircleTags((prev) => prev.filter((t) => t.id !== tagId))
      setPostTags((prev) => prev.filter((t) => t !== name))
      toast({ description: `Tag “${name}” removed.` })
    } catch (error: any) {
      toast({ title: "Couldn't delete tag", description: error.message, variant: "destructive" })
    }
  }

  // Handle post interactions. Optimistic toggle first, then reconcile with
  // the server's authoritative is_liked so a stale/incorrect initial load
  // (posts never told us whether *this* user had liked them) can't desync.
  const handleLike = async (postId: string) => {
    if (!user) return

    const target = posts.find((p) => p.id === postId)
    if (!target) return
    const optimisticLiked = !target.is_liked

    setPosts(prev => prev.map(post =>
      post.id === postId
        ? { ...post, is_liked: optimisticLiked, likes: post.likes + (optimisticLiked ? 1 : -1) }
        : post
    ))

    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${postId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ action: 'like' })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(data.error || "Failed to like post")

      if (typeof data.is_liked === "boolean" && data.is_liked !== optimisticLiked) {
        // Server disagreed with our optimistic guess (e.g. two tabs open) — reconcile.
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { ...post, is_liked: data.is_liked, likes: Math.max(0, post.likes + (data.is_liked ? 1 : -1)) }
            : post
        ))
      }
    } catch (error: any) {
      // Roll back the optimistic update on failure.
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, is_liked: !optimisticLiked, likes: Math.max(0, post.likes + (optimisticLiked ? -1 : 1)) }
          : post
      ))
      toast({ title: "Couldn't like post", description: error.message, variant: "destructive" })
    }
  }

  const handleMediaDoubleTap = (postId: string) => {
    setDoubleTapPostId(postId)
    setTimeout(() => setDoubleTapPostId(null), 700)
    handleLike(postId)
  }

  const handleBookmark = async (postId: string) => {
    if (!user) return
    const target = posts.find((p) => p.id === postId)
    if (!target) return
    const optimisticSaved = !target.is_bookmarked

    setPosts(prev => prev.map(post =>
      post.id === postId
        ? { ...post, is_bookmarked: optimisticSaved }
        : post
    ))

    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${postId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ action: "save" }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to bookmark post")

      if (typeof data.is_active === "boolean") {
        setPosts(prev => prev.map(post =>
          post.id === postId ? { ...post, is_bookmarked: data.is_active } : post
        ))
      }
      toast({
        description: optimisticSaved ? "Saved to Bookmarks" : "Removed from Bookmarks",
      })
    } catch (error: any) {
      setPosts(prev => prev.map(post =>
        post.id === postId ? { ...post, is_bookmarked: target.is_bookmarked } : post
      ))
      toast({ title: "Couldn't update bookmark", description: error.message, variant: "destructive" })
    }
  }

  const canModeratePost = () => userRole === "owner" || userRole === "admin" || userRole === "moderator"

  const handleEditPost = (post: CirclePost) => {
    setEditingPost(post)
    setEditPostContent(post.content)
  }

  const saveEditPost = async () => {
    if (!editingPost || !editPostContent.trim()) return
    setSavingPostEdit(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/posts`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ postId: editingPost.id, content: editPostContent.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to update post")
      const nextContent = data.post?.content ?? editPostContent.trim()
      const nextUpdated = data.post?.updated_at || new Date().toISOString()
      setPosts((prev) =>
        prev.map((post) =>
          post.id === editingPost.id
            ? { ...post, content: nextContent, updated_at: nextUpdated }
            : post,
        ),
      )
      setEditingPost(null)
      toast({ description: "Post updated" })
    } catch (error: any) {
      toast({ title: "Couldn't update post", description: error.message, variant: "destructive" })
    } finally {
      setSavingPostEdit(false)
    }
  }

  const postingEnabled = circle?.settings?.allow_posts !== false
  const canBypassPostFreeze = userRole === "owner" || userRole === "admin" || userRole === "moderator"
  const canUseComposer = isJoined && (postingEnabled || canBypassPostFreeze)

  const toggleAllowPosts = async (enabled: boolean) => {
    if (!canBypassPostFreeze) return
    const previous = circle
    setCircle((prev: any) =>
      prev
        ? {
            ...prev,
            settings: { ...(prev.settings || {}), allow_posts: enabled },
          }
        : prev,
    )
    try {
      const response = await fetch(`/api/circles/${circleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ allow_posts: enabled }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to update posting setting")
      if (data.circle) {
        setCircle((prev: any) => ({
          ...(prev || {}),
          ...data.circle,
          settings: data.circle.settings || { ...(prev?.settings || {}), allow_posts: enabled },
        }))
      }
      toast({
        description: enabled
          ? "Members can create posts again."
          : "Post creation is off for members until you turn it back on.",
      })
    } catch (error: any) {
      setCircle(previous)
      toast({ title: "Couldn't update posting", description: error.message, variant: "destructive" })
    }
  }

  const confirmDeletePost = async () => {
    if (!deletePostId) return
    setDeletingPost(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/posts?postId=${deletePostId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Failed to delete post")
      setPosts((prev) => prev.filter((post) => post.id !== deletePostId))
      toast({ description: "Post deleted" })
    } catch (error: any) {
      toast({ title: "Couldn't delete post", description: error.message, variant: "destructive" })
    } finally {
      setDeletingPost(false)
      setDeletePostId(null)
    }
  }

  const handleSharePost = async (post: CirclePost) => {
    const result = await shareContent({
      url: absoluteAppUrl(`/circles/${circleId}?post=${post.id}`),
      title: `${post.author.display_name} in a circle on loopapp.me`,
      text: post.content.slice(0, 120) || "Check out this post",
    })
    if (result === "aborted") return
    if (result === "failed") {
      toast({ title: "Couldn't share", variant: "destructive" })
      return
    }
    if (result === "copied") {
      toast({ title: "Link copied", description: "Post link is on your clipboard." })
    }
    setPosts((prev) =>
      prev.map((p) => (p.id === post.id ? { ...p, shares: Number(p.shares || 0) + 1 } : p)),
    )
  }

  const handleShareCircle = async () => {
    if (!circle) return
    const result = await shareContent({
      url: absoluteAppUrl(`/circles/${circleId}`),
      title: circle.name || "Circle on loopapp.me",
      text: circle.description?.slice(0, 140) || `Join ${circle.name} on loopapp.me`,
    })
    if (result === "copied") {
      toast({ title: "Link copied", description: "Circle link is on your clipboard." })
    } else if (result === "failed") {
      toast({ title: "Couldn't share", variant: "destructive" })
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

  const submitReply = async (parentId: string) => {
    if (!commentsPost || !replyText.trim() || !user) return
    setSubmittingReply(true)
    try {
      const response = await fetch(`/api/circles/${circleId}/posts/${commentsPost.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content: replyText.trim(), parent_comment_id: parentId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to reply")
      setPostComments((prev) => [...prev, data.comment])
      setReplyText("")
      setReplyingTo(null)
      setPosts((prev) =>
        prev.map((post) =>
          post.id === commentsPost.id ? { ...post, comments: Number(post.comments || 0) + 1 } : post,
        ),
      )
      setCommentsPost((prev) => (prev ? { ...prev, comments: Number(prev.comments || 0) + 1 } : prev))
      toast({ description: "Reply posted" })
    } catch (error: any) {
      toast({ title: "Reply failed", description: error.message, variant: "destructive" })
    } finally {
      setSubmittingReply(false)
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

  const backBar = (title?: string) => (
    <div className="sticky top-16 z-30 -mx-3 mb-2 flex items-center gap-3 border-b border-border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-4 sm:px-4">
      <button
        type="button"
        onClick={handleBack}
        className="rounded-full p-2 text-foreground hover:bg-muted"
        aria-label="Back to circles"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight sm:text-base">
          {title || "Community"}
        </p>
        <Link href="/circles" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Circles
        </Link>
      </div>
    </div>
  )

  if (authLoading || loading) {
    return (
      <div className="w-full">
        {backBar("Loading…")}
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-muted-foreground">Loading circle...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-full">
        {backBar("Sign in")}
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="space-y-3 text-center">
            <h2 className="mb-2 text-2xl font-bold">Sign in to view this circle</h2>
            <p className="text-muted-foreground">Community pages require an account.</p>
            <a href="/login" className="inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
              Log in
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (!circle) {
    return (
      <div className="w-full">
        {backBar("Not found")}
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="space-y-3 text-center">
            <h2 className="mb-2 text-2xl font-bold">Circle not found</h2>
            <p className="text-muted-foreground">This circle doesn't exist or you don't have access to it.</p>
            <Button variant="outline" className="rounded-full" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Circles
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Pro-only communities get the dedicated Slack-style workspace (channel
  // sidebar + chat + member rail) instead of the tabbed community UI.
  if ((circle as any).is_premium_only) {
    return (
      <div className="w-full">
        {backBar(circle.name || "Community")}
        <SlackCircleWorkspace circleId={circle.id} />
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
      {backBar(circle.name || "Community")}

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
                  variant="outline"
                  size="sm"
                  onClick={handleShareCircle}
                  className="rounded-full"
                  aria-label="Share circle"
                >
                  <Share className="h-4 w-4" />
                </Button>

                <Button
                  onClick={handleJoinLeave}
                  size="sm"
                  className="rounded-full"
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

      {/* Private circles hide posts, rooms, events, and the member list from
          anyone who isn't an approved member — visitors only see enough to
          decide whether to request access, and requesters land here until a
          moderator approves them. */}
      {circle.is_private && !isJoined ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            {membershipPending ? (
              <>
                <h3 className="text-lg font-semibold">Your request is pending approval</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  This is a private circle. An admin needs to approve your request before you can see posts,
                  rooms, events, or members. We'll notify you once you're in.
                </p>
                <Button variant="outline" size="sm" className="rounded-full" onClick={handleJoinLeave}>
                  Cancel request
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">This circle is private</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Posts, rooms, events, and the member list are only visible to approved members. Request to
                  join and an admin will review it.
                </p>
                <Button
                  onClick={handleJoinLeave}
                  size="sm"
                  className="rounded-full"
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Request to join
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
      <>
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
          {canBypassPostFreeze && (
            <Card className="border-border">
              <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Member post creation</p>
                  <p className="text-xs text-muted-foreground">
                    Turn this off to hide the create-post box for regular members. Admins can still post.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="allow-posts-toggle" className="text-xs text-muted-foreground">
                    {postingEnabled ? "On" : "Off"}
                  </Label>
                  <Switch
                    id="allow-posts-toggle"
                    checked={postingEnabled}
                    onCheckedChange={(checked) => void toggleAllowPosts(checked)}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {isJoined && !postingEnabled && !canBypassPostFreeze && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Posting is temporarily turned off by community admins. You can still read and interact with existing posts.
              </CardContent>
            </Card>
          )}

          {/* Create Post */}
          {canUseComposer && (
            <Card className="overflow-hidden border-border/80 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                {!postingEnabled && canBypassPostFreeze && (
                  <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    Member posting is off — only admins/moderators can create posts right now.
                  </p>
                )}
                {/* Composer identity header */}
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name || "Circle"} />
                    <AvatarFallback className="text-xs">{(circle.name || "C").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">
                      Post to {circle.name || "this circle"}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      Visible to every member in the community feed
                    </p>
                  </div>
                  <span className="hidden shrink-0 items-center gap-1 text-[10px] font-medium text-muted-foreground sm:flex">
                    <Sparkles className="h-3 w-3 text-violet-400" />
                    Real-time
                  </span>
                </div>
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

                    {newPostMedia.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {newPostMedia.map((url) => (
                          <div key={url} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border">
                            <img src={url} alt="" className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemovePostMedia(url)}
                              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {showPollBuilder && (
                      <div className="space-y-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold">Poll question</Label>
                          <button type="button" onClick={() => setShowPollBuilder(false)} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <Input
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                          placeholder="Ask the community something…"
                        />
                        {pollOptions.map((opt, i) => (
                          <Input
                            key={i}
                            value={opt}
                            onChange={(e) =>
                              setPollOptions((prev) => prev.map((o, idx) => (idx === i ? e.target.value : o)))
                            }
                            placeholder={`Option ${i + 1}`}
                          />
                        ))}
                        <div className="flex items-center gap-2">
                          {pollOptions.length < 4 && (
                            <Button type="button" variant="outline" size="sm" onClick={() => setPollOptions((prev) => [...prev, ""])}>
                              Add option
                            </Button>
                          )}
                          {pollOptions.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPollOptions((prev) => prev.slice(0, -1))}
                            >
                              Remove last
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {(circleTags.length > 0 || isStaff) && (
                      <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-1 flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                            <Tag className="h-3 w-3" /> Tag this post:
                          </span>
                          {circleTags.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground/70">
                              No tags yet{isStaff ? " — create the first one below" : ""}.
                            </span>
                          ) : (
                            circleTags.map((tag) => {
                              const active = postTags.includes(tag.name)
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => togglePostTag(tag.name)}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                                    active
                                      ? "border-violet-500 bg-violet-500/20 text-violet-300 shadow-sm"
                                      : "border-border text-muted-foreground hover:border-violet-400/40 hover:text-violet-300"
                                  }`}
                                >
                                  #{tag.name}
                                </button>
                              )
                            })
                          )}
                          {isStaff && (
                            <button
                              type="button"
                              onClick={() => setShowTagManager((v) => !v)}
                              className="ml-auto rounded-full border border-dashed border-violet-400/40 px-2.5 py-1 text-[11px] font-semibold text-violet-400 hover:bg-violet-500/10"
                            >
                              <Settings2 className="mr-1 inline h-3 w-3" />
                              Manage tags
                            </button>
                          )}
                        </div>
                        {isStaff && showTagManager && (
                          <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
                            <div className="flex gap-2">
                              <Input
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                placeholder="New tag name… e.g. events, clips, memes"
                                className="h-9 flex-1 text-xs"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    void handleCreateTag()
                                  }
                                }}
                              />
                              <Button size="sm" variant="outline" onClick={() => void handleCreateTag()} disabled={savingTag || !newTagName.trim()} className="h-9">
                                {savingTag ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                Add
                              </Button>
                            </div>
                            {circleTags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {circleTags.map((tag) => (
                                  <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                                    #{tag.name}
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteTag(tag.id, tag.name)}
                                      className="text-muted-foreground/60 hover:text-rose-500"
                                      aria-label={`Delete tag ${tag.name}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-2">
                        <input
                          id="circle-post-media-input"
                          type="file"
                          accept="image/*"
                          multiple={getMaxCirclePostFiles() > 1}
                          className="hidden"
                          onChange={handlePickPostMedia}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          disabled={uploadingPostMedia || newPostMedia.length >= getMaxCirclePostFiles()}
                          onClick={() => document.getElementById("circle-post-media-input")?.click()}
                          className="border-violet-500/40 text-violet-500 hover:bg-violet-500/10"
                        >
                          {uploadingPostMedia ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1 h-4 w-4" />}
                          Media{getMaxCirclePostFiles() > 1 ? ` (${getMaxCirclePostFiles()})` : ""}
                        </Button>
                        <Button
                          variant={showPollBuilder ? "default" : "outline"}
                          size="sm"
                          type="button"
                          onClick={() => setShowPollBuilder((v) => !v)}
                          className={
                            showPollBuilder
                              ? "border-transparent bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-md shadow-violet-900/20"
                              : "border-cyan-500/40 text-cyan-500 hover:bg-cyan-500/10"
                          }
                        >
                          <Hash className="mr-1 h-4 w-4" />
                          Poll
                        </Button>
                      </div>
                      <Button
                        onClick={handleCreatePost}
                        disabled={
                          postingCircle ||
                          (!newPost.trim() && newPostMedia.length === 0 && !(showPollBuilder && pollQuestion.trim()))
                        }
                        className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 shadow-lg shadow-violet-900/30 hover:from-violet-500 hover:to-cyan-400"
                      >
                        {postingCircle ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
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
              const authorRole = members.find((m) => String(m.id) === String(post.author?.id))?.role
              const roleBadge =
                authorRole === "owner"
                  ? { label: "Owner", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30" }
                  : authorRole === "admin"
                    ? { label: "Admin", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" }
                    : authorRole === "moderator"
                      ? { label: "Mod", cls: "bg-sky-500/15 text-sky-500 border-sky-500/30" }
                      : null
              const stamped = (() => {
                try {
                  return formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })
                } catch {
                  return "just now"
                }
              })()
              const isDoubleTapped = doubleTapPostId === post.id
              return (
                <Card key={post.id} className="relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-border/80 bg-card/80 backdrop-blur-sm">
                  {post.is_pinned && (
                    <div className="bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-transparent border-b border-violet-500/20 px-4 py-1.5 flex items-center justify-between text-xs text-violet-600 dark:text-violet-300 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Pin className="h-3.5 w-3.5 fill-current" />
                        Pinned Community Announcement
                      </span>
                    </div>
                  )}
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <Link href={`/profile/${post.author?.username || ""}`} className="shrink-0 transition-transform hover:scale-105">
                        <CosmeticAvatar
                          src={post.author?.avatar_url || ""}
                          alt={authorName}
                          fallback={authorName.charAt(0)}
                          size="md"
                          cosmetics={post.author?.cosmetics}
                        />
                      </Link>

                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link href={`/profile/${post.author?.username || ""}`} className="font-bold text-sm sm:text-base hover:underline truncate">
                            {authorName}
                          </Link>
                          {post.author?.username && (
                            <span className="text-xs text-muted-foreground truncate">@{post.author.username}</span>
                          )}
                          {post.author?.is_verified && (
                            <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">✓</Badge>
                          )}
                          {post.author?.is_premium && <Crown className="h-4 w-4 text-amber-500" />}
                          {roleBadge && (
                            <Badge variant="outline" className={`h-4 px-1.5 text-[9px] font-bold uppercase tracking-wide ${roleBadge.cls}`}>
                              {roleBadge.label}
                            </Badge>
                          )}
                          {post.author?.level && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold border-emerald-500/30 bg-emerald-500/10 text-emerald-500">
                              LVL {post.author.level}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">• {stamped}</span>
                          {wasCirclePostEdited(post) && (
                            <span className="text-xs text-muted-foreground">(edited)</span>
                          )}
                        </div>

                        <RichContent
                          text={post.content}
                          className="mb-3 text-sm leading-relaxed sm:text-base"
                        />

                        {post.tags && post.tags.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {post.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="rounded-full border-violet-500/30 bg-violet-500/5 px-2 py-0.5 text-[11px] font-semibold text-violet-500 dark:text-violet-300"
                              >
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {post.poll && (
                          <CirclePostPollWidget circleId={circleId} postId={post.id} poll={post.poll} />
                        )}

                        {post.media_urls && post.media_urls.length > 0 && (
                          <div
                            className={`relative mb-3 overflow-hidden rounded-xl border border-border/60 bg-black/5 ${
                              post.media_urls.length > 1 ? `grid gap-1 ${post.media_urls.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}` : ""
                            }`}
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              handleMediaDoubleTap(post.id)
                            }}
                          >
                            {isDoubleTapped && (
                              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                                <Heart className="h-20 w-20 fill-red-500 text-red-500 animate-in zoom-in-50 fade-in duration-300 drop-shadow-xl" />
                              </div>
                            )}
                            {post.media_urls.map((url, i) =>
                              post.media_type === "video" && i === 0 ? (
                                <video
                                  key={url}
                                  src={url}
                                  controls
                                  className="max-h-96 w-full bg-black object-contain cursor-pointer"
                                />
                              ) : (
                                <img
                                  key={url}
                                  src={url}
                                  alt="Post media"
                                  onClick={() => setPreviewMediaUrl(url)}
                                  className="h-full max-h-96 w-full object-cover transition-transform duration-300 hover:scale-105 cursor-zoom-in"
                                />
                              ),
                            )}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-border/60 bg-muted/20 px-1.5 py-1.5 sm:px-2.5">
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={post.is_liked ? "Unlike this post" : "Like this post"}
                              className={`h-8 rounded-full px-2 sm:px-2.5 transition-all duration-300 ${
                                post.is_liked ? "text-red-500 bg-red-500/10 hover:bg-red-500/20" : "hover:bg-red-500/10 hover:text-red-500"
                              }`}
                              onClick={() => handleLike(post.id)}
                            >
                              <Heart className={`mr-1.5 h-4 w-4 transition-transform active:scale-125 ${post.is_liked ? "fill-current" : ""}`} />
                              <span className="text-xs font-semibold">{post.likes}</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="View comments on this post"
                              className="h-8 rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:bg-sky-500/10 hover:text-sky-500"
                              onClick={() => openComments(post)}
                            >
                              <MessageCircle className="mr-1.5 h-4 w-4" />
                              <span className="text-xs font-semibold">{post.comments}</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Share this post"
                              className="hidden h-8 rounded-full px-2 sm:px-2.5 transition-all duration-200 hover:bg-emerald-500/10 hover:text-emerald-500 xs:inline-flex"
                              onClick={() => handleSharePost(post)}
                            >
                              <Share className="mr-1.5 h-4 w-4" />
                              <span className="text-xs font-semibold hidden sm:inline">{post.shares}</span>
                            </Button>
                          </div>

                          <div className="flex items-center gap-0.5 sm:gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-8 rounded-full px-2 transition-all duration-200 ${
                                post.is_bookmarked ? "bg-amber-500/10 text-amber-500" : "hover:bg-amber-500/10 hover:text-amber-500"
                              }`}
                              onClick={() => handleBookmark(post.id)}
                              title={post.is_bookmarked ? "Bookmarked" : "Bookmark post"}
                              aria-label={post.is_bookmarked ? "Remove bookmark" : "Bookmark this post"}
                            >
                              <Bookmark className={`h-4 w-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
                            </Button>

                            {isOwnCirclePost(post, user?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-full px-2 transition-all duration-200 hover:bg-muted"
                                onClick={() => handleEditPost(post)}
                                aria-label="Edit post"
                              >
                                <Edit className="mr-1 h-3.5 w-3.5" />
                                <span className="hidden sm:inline text-xs">Edit</span>
                              </Button>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0" aria-label="More post actions">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                {isOwnCirclePost(post, user?.id) && (
                                  <DropdownMenuItem onClick={() => handleEditPost(post)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit Post
                                  </DropdownMenuItem>
                                )}
                                {(isOwnCirclePost(post, user?.id) || canModeratePost()) && (
                                  <DropdownMenuItem
                                    onClick={() => setDeletePostId(post.id)}
                                    className="text-red-500 focus:text-red-500"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Post
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => handleSharePost(post)}>
                                  <Link2 className="mr-2 h-4 w-4" />
                                  Copy Link
                                </DropdownMenuItem>
                                {!isOwnCirclePost(post, user?.id) && (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setGiftRecipient(post.author)
                                      setShowGiftModal(true)
                                    }}
                                  >
                                    <Gift className="mr-2 h-4 w-4" />
                                    Gift Author
                                  </DropdownMenuItem>
                                )}
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
                  className="rounded-full"
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
                        {room.type === 'announcement' && <Bell className="h-4 w-4 text-amber-500" />}
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
                          index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300' :
                          index === 1 ? 'bg-muted text-foreground' :
                          index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
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
                          <p className="text-sm text-muted-foreground">{member.contribution_score} points</p>
                        </div>
                        
{index < 3 && (
                          <Trophy className={`w-5 h-5 ${
                            index === 0 ? 'text-yellow-500' :
                            index === 1 ? 'text-muted-foreground' :
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
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-sm font-bold">{index + 1}</span>
                      </div>
                      <p className="text-foreground/90">{String(rule)}</p>
                    </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No rules have been set for this circle.</p>
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
                    <div className="text-sm text-muted-foreground">Total Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{circle.stats?.total_comments || 0}</div>
                    <div className="text-sm text-muted-foreground">Total Comments</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{circle.stats?.active_members || 0}</div>
                    <div className="text-sm text-muted-foreground">Active Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">+{circle.stats?.weekly_growth || 0}%</div>
                    <div className="text-sm text-muted-foreground">Weekly Growth</div>
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
      </>
      )}

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
                  {(userRole === "owner" || userRole === "admin") && (
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        value="announcement"
                        checked={newRoom.type === 'announcement'}
                        onChange={(e) => setNewRoom(prev => ({ ...prev, type: e.target.value as any }))}
                      />
                      <Bell className="w-4 h-4" />
                      <span>Announcement</span>
                    </label>
                  )}
                </div>
                {newRoom.type === "announcement" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Everyone in the circle can read this channel — only admins and moderators can post.
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newRoom.is_private}
                  onCheckedChange={(checked) => setNewRoom(prev => ({ ...prev, is_private: checked }))}
                />
                <Label>Private Room</Label>
              </div>
              {newRoom.is_private && (
                <p className="text-xs text-muted-foreground">
                  Only members you explicitly grant access to (from the room's menu after creating it) can see or post in this channel.
                </p>
              )}
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => setShowCreateRoom(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateRoom} className="flex-1">
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
                  (() => {
                    // Thread comments: flat rows from the API become a reply tree.
                    const byParent = new Map<string, any[]>()
                    const roots: any[] = []
                    for (const c of postComments) {
                      if (c.parent_comment_id && c.parent_comment_id !== c.id) {
                        if (!byParent.has(c.parent_comment_id)) byParent.set(c.parent_comment_id, [])
                        byParent.get(c.parent_comment_id)!.push(c)
                      } else {
                        roots.push(c)
                      }
                    }
                    const replyCount = (comment: any): number => {
                      const kids = byParent.get(comment.id) || []
                      return kids.reduce((sum, k) => sum + 1 + replyCount(k), 0)
                    }
                    const renderComment = (comment: any, depth: number) => {
                      const author = Array.isArray(comment.author) ? comment.author[0] : comment.author
                      const name = author?.display_name || author?.username || "Member"
                      const replies = byParent.get(comment.id) || []
                      const isReply = depth > 0
                      return (
                        <div key={comment.id} className={isReply ? "ml-4 sm:ml-6 space-y-2.5 border-l-2 border-violet-500/20 pl-3 sm:pl-4" : "space-y-2.5"}>
                          <div className="flex gap-3">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={author?.avatar_url} />
                              <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className={isReply ? "rounded-2xl border border-violet-500/10 bg-violet-500/5 px-3 py-2" : "rounded-2xl bg-muted/50 px-3 py-2"}>
                                <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold">{name}</span>
                                  {author?.is_verified && (
                                    <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-blue-500/10 text-blue-500 border-blue-500/20">
                                      ✓
                                    </Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(comment.created_at || Date.now()), { addSuffix: true })}
                                  </span>
                                </div>
                                <RichContent text={comment.content} className="text-sm" />
                                <div className="mt-1.5 flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplyingTo(comment.id)
                                      setReplyText("")
                                    }}
                                    className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground transition hover:text-violet-400"
                                  >
                                    <Reply className="h-3 w-3" /> Reply
                                  </button>
                                  {replyCount(comment) > 0 && (
                                    <span className="text-[10px] font-semibold text-muted-foreground/70">
                                      {replyCount(comment)} {replyCount(comment) === 1 ? "reply" : "replies"}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {replyingTo === comment.id && (
                                <div className="mt-2 flex items-end gap-2">
                                  <MentionTextarea
                                    value={replyText}
                                    onChange={setReplyText}
                                    placeholder={`Reply to @${author?.username || "comment"}… @ to tag`}
                                    className="min-h-[40px] max-h-24 resize-none"
                                    rows={2}
                                  />
                                  <div className="flex flex-col gap-1">
                                    <Button
                                      size="sm"
                                      onClick={() => void submitReply(comment.id)}
                                      disabled={submittingReply || !replyText.trim()}
                                      className="rounded-full px-3"
                                      title="Post reply"
                                    >
                                      {submittingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Reply className="h-3.5 w-3.5" />}
                                    </Button>
                                    <button
                                      type="button"
                                      onClick={() => setReplyingTo(null)}
                                      className="text-[10px] text-muted-foreground hover:text-foreground"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          {depth < 3 && replies.length > 0 && (
                            <div className="space-y-2.5">
                              {replies.map((r) => renderComment(r, depth + 1))}
                            </div>
                          )}
                        </div>
                      )
                    }
                    return <div className="space-y-3">{roots.map((c) => renderComment(c, 0))}</div>
                  })()
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

        <Dialog open={Boolean(editingPost)} onOpenChange={(open) => !open && setEditingPost(null)}>
          <DialogContent className="border-border bg-popover text-foreground sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit your post</DialogTitle>
            </DialogHeader>
            <MentionTextarea
              value={editPostContent}
              onChange={setEditPostContent}
              className="min-h-[140px] resize-none border-border bg-muted"
              rows={5}
              placeholder="Update your post…"
            />
            <DialogFooter>
              <Button variant="outline" className="border-border" onClick={() => setEditingPost(null)}>
                Cancel
              </Button>
              <Button onClick={saveEditPost} disabled={savingPostEdit || !editPostContent.trim()}>
                {savingPostEdit ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={Boolean(deletePostId)}
          onOpenChange={(open) => !open && setDeletePostId(null)}
          title="Delete this post?"
          description="This cannot be undone."
          confirmLabel={deletingPost ? "Deleting..." : "Delete"}
          destructive
          onConfirm={confirmDeletePost}
        />

        <Dialog open={Boolean(previewMediaUrl)} onOpenChange={(open) => !open && setPreviewMediaUrl(null)}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95 border-none">
            <div className="relative flex items-center justify-center min-h-[50vh] max-h-[85vh]">
              {previewMediaUrl && (
                <img
                  src={previewMediaUrl}
                  alt="Enlarged post media"
                  className="max-h-[85vh] w-auto max-w-full object-contain"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { MessageCircle, Heart, Reply, MoreHorizontal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

interface Comment {
  id: string
  author: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    is_verified: boolean
    verification_level?: "root" | "influencer"
  }
  content: string
  created_at: Date
  likes: number
  replies: Comment[]
  isLiked?: boolean
}

interface CommentsSectionProps {
  loopId: string
  comments?: Comment[]
}

// Mock comments data
const mockComments: Comment[] = [
  {
    id: "comment-1",
    author: {
      id: "2",
      username: "storyteller",
      display_name: "Story Teller",
      avatar_url: "/placeholder.svg?height=32&width=32",
      is_verified: true,
      verification_level: "influencer",
    },
    content:
      "This is such a fascinating concept! I love how you've explored the philosophical implications of time travel.",
    created_at: new Date("2024-01-15T11:30:00Z"),
    likes: 23,
    replies: [
      {
        id: "reply-1",
        author: {
          id: "3",
          username: "philosopher",
          display_name: "Deep Thinker",
          avatar_url: "/placeholder.svg?height=32&width=32",
          is_verified: true,
          verification_level: "influencer",
        },
        content: "Exactly! The observer paradox in time travel is something that deserves more exploration.",
        created_at: new Date("2024-01-15T12:00:00Z"),
        likes: 8,
        replies: [],
      },
    ],
  },
  {
    id: "comment-2",
    author: {
      id: "4",
      username: "scifiwriter",
      display_name: "Sci-Fi Writer",
      avatar_url: "/placeholder.svg?height=32&width=32",
      is_verified: false,
    },
    content:
      "This reminds me of the concept in quantum mechanics where observation changes the outcome. What if time travel works the same way?",
    created_at: new Date("2024-01-15T13:15:00Z"),
    likes: 15,
    replies: [],
  },
]

export function CommentsSection({ loopId, comments = mockComments }: CommentsSectionProps) {
  const [newComment, setNewComment] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [commentsData, setCommentsData] = useState(comments)
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const { toast } = useToast()
  const { user } = useAuth()

  const handleSubmitComment = () => {
    if (!newComment.trim()) return

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      author: {
        id: user?.id || "current-user",
        username: user?.username || "currentuser",
        display_name: user?.display_name || "Current User",
        avatar_url: user?.avatar_url || "/placeholder.svg?height=32&width=32",
        is_verified: user?.is_verified || false,
        verification_level: user?.verification_level,
      },
      content: newComment,
      created_at: new Date(),
      likes: 0,
      replies: [],
    }

    setCommentsData([comment, ...commentsData])
    setNewComment("")
    toast({ description: "Comment added successfully!" })
  }

  const handleSubmitReply = (parentId: string) => {
    if (!replyContent.trim()) return

    const reply: Comment = {
      id: `reply-${Date.now()}`,
      author: {
        id: user?.id || "current-user",
        username: user?.username || "currentuser",
        display_name: user?.display_name || "Current User",
        avatar_url: user?.avatar_url || "/placeholder.svg?height=32&width=32",
        is_verified: user?.is_verified || false,
        verification_level: user?.verification_level,
      },
      content: replyContent,
      created_at: new Date(),
      likes: 0,
      replies: [],
    }

    setCommentsData(
      commentsData.map((comment) =>
        comment.id === parentId ? { ...comment, replies: [...comment.replies, reply] } : comment,
      ),
    )

    setReplyContent("")
    setReplyingTo(null)
    toast({ description: "Reply added successfully!" })
  }

  const handleLikeComment = (commentId: string) => {
    setLikedComments((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(commentId)) {
        newSet.delete(commentId)
      } else {
        newSet.add(commentId)
      }
      return newSet
    })
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return "Just now"
  }

  const getVerificationBadge = (author: Comment["author"]) => {
    if (!author.is_verified) return null
    return (
      <Badge
        variant="secondary"
        className={`ml-1 text-xs ${
          author.verification_level === "root"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        }`}
      >
        {author.verification_level === "root" ? "🌱" : "⭐"}
      </Badge>
    )
  }

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? "ml-8 border-l-2 border-gray-200 dark:border-gray-700 pl-4" : ""}`}>
      <div className="flex space-x-3">
        <Avatar className="w-8 h-8">
          <AvatarImage src={comment.author.avatar_url || "/placeholder.svg"} />
          <AvatarFallback>{comment.author.display_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm">{comment.author.display_name}</span>
            {getVerificationBadge(comment.author)}
            <span className="text-gray-500 dark:text-gray-400 text-xs">@{comment.author.username}</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">•</span>
            <span className="text-gray-500 dark:text-gray-400 text-xs">{formatTimeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">{comment.content}</p>
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleLikeComment(comment.id)}
              className={`text-xs ${likedComments.has(comment.id) ? "text-red-500" : "text-gray-500"}`}
            >
              <Heart className={`w-3 h-3 mr-1 ${likedComments.has(comment.id) ? "fill-current" : ""}`} />
              {comment.likes + (likedComments.has(comment.id) ? 1 : 0)}
            </Button>
            {!isReply && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                className="text-xs text-gray-500"
              >
                <Reply className="w-3 h-3 mr-1" />
                Reply
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-xs text-gray-500">
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </div>

          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={() => handleSubmitReply(comment.id)}
                  disabled={!replyContent.trim()}
                  className="bg-gradient-to-r from-purple-500 to-blue-500"
                >
                  Reply
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReplyingTo(null)
                    setReplyContent("")
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="mt-4 space-y-4">{comment.replies.map((reply) => renderComment(reply, true))}</div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageCircle className="w-5 h-5" />
          <span>Comments ({commentsData.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add comment form */}
        <div className="space-y-3">
          <div className="flex space-x-3">
            <Avatar className="w-8 h-8">
              <AvatarImage src={user?.avatar_url || "/placeholder.svg?height=32&width=32"} />
              <AvatarFallback>{user?.display_name?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={!newComment.trim()}
              className="bg-gradient-to-r from-purple-500 to-blue-500"
            >
              Comment
            </Button>
          </div>
        </div>

        {/* Comments list */}
        <div className="space-y-6">{commentsData.map((comment) => renderComment(comment))}</div>

        {commentsData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No comments yet. Be the first to comment!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

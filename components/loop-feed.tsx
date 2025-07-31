"use client"

import { useState, useEffect } from "react"
import { LoopCard } from "./loop-card"
import { CreateLoopButton } from "./create-loop-button"
import { Loader2 } from "lucide-react"

interface Loop {
  id: string
  user: {
    id: string
    username: string
    display_name: string
    avatar_url: string
    is_verified: boolean
  }
  content: string
  media_url?: string
  media_type?: "image" | "video" | "audio"
  likes: number
  comments: number
  branches: number
  created_at: string
  hashtags: string[]
  is_liked: boolean
  is_bookmarked: boolean
  parent_loop_id?: string
}

export function LoopFeed() {
  const [loops, setLoops] = useState<Loop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data - replace with real API call
    const mockLoops: Loop[] = [
      {
        id: "1",
        user: {
          id: "1",
          username: "techcreator",
          display_name: "Tech Creator",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_verified: true,
        },
        content:
          "Just launched my new AI-powered loop! This tool can generate creative content branches automatically. What do you think? #AI #Innovation #LoopTech",
        media_url: "/placeholder.svg?height=300&width=500",
        media_type: "image",
        likes: 234,
        comments: 45,
        branches: 12,
        created_at: "2024-01-20T10:30:00Z",
        hashtags: ["AI", "Innovation", "LoopTech"],
        is_liked: false,
        is_bookmarked: false,
      },
      {
        id: "2",
        user: {
          id: "2",
          username: "musicmaker",
          display_name: "Music Maker",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_verified: false,
        },
        content:
          "Created this beat in my home studio. Feel free to branch it and add your own vocals! 🎵 #Music #Collaboration #HomeStudio",
        media_type: "audio",
        likes: 189,
        comments: 23,
        branches: 8,
        created_at: "2024-01-20T09:15:00Z",
        hashtags: ["Music", "Collaboration", "HomeStudio"],
        is_liked: true,
        is_bookmarked: false,
      },
      {
        id: "3",
        user: {
          id: "3",
          username: "storyteller",
          display_name: "Digital Storyteller",
          avatar_url: "/placeholder.svg?height=40&width=40",
          is_verified: true,
        },
        content:
          "Chapter 1 of my interactive story is live! Each branch will take the story in a different direction. Where should our hero go next? 📚✨",
        likes: 156,
        comments: 67,
        branches: 15,
        created_at: "2024-01-20T08:45:00Z",
        hashtags: ["Story", "Interactive", "Creative"],
        is_liked: false,
        is_bookmarked: true,
      },
    ]

    setTimeout(() => {
      setLoops(mockLoops)
      setLoading(false)
    }, 1000)
  }, [])

  const handleLike = (loopId: string) => {
    setLoops(
      loops.map((loop) =>
        loop.id === loopId
          ? {
              ...loop,
              is_liked: !loop.is_liked,
              likes: loop.is_liked ? loop.likes - 1 : loop.likes + 1,
            }
          : loop,
      ),
    )
  }

  const handleBookmark = (loopId: string) => {
    setLoops(loops.map((loop) => (loop.id === loopId ? { ...loop, is_bookmarked: !loop.is_bookmarked } : loop)))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <CreateLoopButton />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CreateLoopButton />

      {loops.map((loop) => (
        <LoopCard key={loop.id} loop={loop} onLike={handleLike} onBookmark={handleBookmark} />
      ))}
    </div>
  )
}

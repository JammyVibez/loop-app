"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Search, Users } from "lucide-react"
import Link from "next/link"

interface Follower {
  id: string
  username: string
  displayName: string
  avatar: string
  bio: string
  verified: boolean
  premium: boolean
  followers: number
  loops: number
  isFollowing: boolean
  mutualFollowers: number
  joinedDate: string
}

export default function FollowersPage() {
  const params = useParams()
  const username = params.username as string
  const [followers, setFollowers] = useState<Follower[]>([])
  const [filteredFollowers, setFilteredFollowers] = useState<Follower[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    // Simulate API call
    const fetchFollowers = async () => {
      setLoading(true)

      const mockFollowers: Follower[] = [
        {
          id: "1",
          username: "techfan123",
          displayName: "Mike Johnson",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Tech enthusiast • Love learning new frameworks",
          verified: false,
          premium: false,
          followers: 234,
          loops: 45,
          isFollowing: false,
          mutualFollowers: 2,
          joinedDate: "2023-08-15",
        },
        {
          id: "2",
          username: "designlover",
          displayName: "Anna Smith",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Graphic designer • Creating beautiful visuals",
          verified: true,
          premium: true,
          followers: 1890,
          loops: 123,
          isFollowing: true,
          mutualFollowers: 8,
          joinedDate: "2023-02-10",
        },
        {
          id: "3",
          username: "codelearner",
          displayName: "James Wilson",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Junior developer • Always learning something new",
          verified: false,
          premium: false,
          followers: 567,
          loops: 78,
          isFollowing: false,
          mutualFollowers: 5,
          joinedDate: "2023-06-22",
        },
        {
          id: "4",
          username: "startupguru",
          displayName: "Rachel Green",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Entrepreneur • Building the next big thing",
          verified: true,
          premium: false,
          followers: 3450,
          loops: 234,
          isFollowing: true,
          mutualFollowers: 12,
          joinedDate: "2022-12-05",
        },
        {
          id: "5",
          username: "webdev_ninja",
          displayName: "Tom Brown",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Full-stack developer • JavaScript enthusiast",
          verified: false,
          premium: true,
          followers: 890,
          loops: 156,
          isFollowing: false,
          mutualFollowers: 3,
          joinedDate: "2023-04-18",
        },
      ]

      setTimeout(() => {
        setFollowers(mockFollowers)
        setFilteredFollowers(mockFollowers)
        setLoading(false)
      }, 1000)
    }

    fetchFollowers()
  }, [username])

  useEffect(() => {
    const filtered = followers.filter(
      (follower) =>
        follower.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        follower.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        follower.bio.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    setFilteredFollowers(filtered)
  }, [searchQuery, followers])

  const handleFollow = (followerId: string) => {
    setFollowers((prev) =>
      prev.map((follower) =>
        follower.id === followerId ? { ...follower, isFollowing: !follower.isFollowing } : follower,
      ),
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href={`/profile/${username}`}>
              <Button variant="ghost" size="sm">
                ← Back to Profile
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">@{username}</h1>
              <p className="text-muted-foreground">{followers.length} Followers</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search followers..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Followers List */}
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="rounded-full bg-muted h-12 w-12"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                    <div className="h-8 bg-muted rounded w-20"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFollowers.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No followers found</h3>
                  <p className="text-muted-foreground">
                    {searchQuery ? "Try adjusting your search terms" : "This user has no followers yet"}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredFollowers.map((follower) => (
                <Card key={follower.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <Link href={`/profile/${follower.username}`}>
                        <Avatar className="h-12 w-12 cursor-pointer">
                          <AvatarImage src={follower.avatar || "/placeholder.svg"} />
                          <AvatarFallback>{follower.displayName.charAt(0)}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link href={`/profile/${follower.username}`} className="font-semibold hover:underline">
                            {follower.displayName}
                          </Link>
                          {follower.verified && (
                            <Badge variant="secondary" className="text-xs">
                              ✓
                            </Badge>
                          )}
                          {follower.premium && (
                            <Badge variant="outline" className="text-xs">
                              ⭐
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">@{follower.username}</p>
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{follower.bio}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{follower.followers.toLocaleString()} followers</span>
                          <span>{follower.loops} loops</span>
                          {follower.mutualFollowers > 0 && <span>{follower.mutualFollowers} mutual</span>}
                          <span>Joined {new Date(follower.joinedDate).getFullYear()}</span>
                        </div>
                      </div>
                      <Button
                        variant={follower.isFollowing ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleFollow(follower.id)}
                      >
                        {follower.isFollowing ? "Following" : "Follow"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

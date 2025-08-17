"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TrendingUp, Hash, Users, Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import Link from "next/link"

interface TrendingUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
  follower_count?: number
}

interface TrendingHashtag {
  tag: string
  count: number
}

export function TrendingSidebar() {
  const [trendingUsers, setTrendingUsers] = useState<TrendingUser[]>([])
  const [trendingHashtags, setTrendingHashtags] = useState<TrendingHashtag[]>([])
  const [loading, setLoading] = useState(true)
  const [following, setFollowing] = useState<{ [id: string]: boolean }>({})
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      fetchTrendingData()
    }
  }, [user])

  const fetchTrendingData = async () => {
    if (!user?.token) return

    try {
      // Fetch trending hashtags
      const hashtagResponse = await fetch("/api/search?q=trending&type=hashtags&limit=5", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })
      const hashtagData = await hashtagResponse.json()
      if (hashtagData.success && hashtagData.results && hashtagData.results.hashtags) {
        setTrendingHashtags(hashtagData.results.hashtags)
      } else {
        setTrendingHashtags([])
      }

      // Fetch latest registered users (not trending)
      const userResponse = await fetch("/api/users?sort=newest&limit=5", {
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      })
      const userData = await userResponse.json()
      if (userData.success) {
        setTrendingUsers(userData.users || [])
      } else {
        setTrendingUsers([])
      }
    } catch (error) {
      console.error("Error fetching trending data:", error)
      setTrendingHashtags([]) // Ensure hashtags are cleared on error
    } finally {
      setLoading(false)
    }
  }

  const handleFollow = async (userId: string) => {
    if (!user?.token) return
    setFollowing(prev => ({ ...prev, [userId]: true }))
    try {
      const res = await fetch(`/api/users/${userId}/follow`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "application/json",
        },
      })
      const data = await res.json()
      if (!data.success) {
        setFollowing(prev => ({ ...prev, [userId]: false }))
      } else {
        // After following, reload new users
        fetchTrendingData()
      }
    } catch (err) {
      setFollowing(prev => ({ ...prev, [userId]: false }))
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Trending Hashtags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Hash className="w-5 h-5" />
            <span>Trending Hashtags</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : trendingHashtags.length === 0 ? (
            <p className="text-sm text-gray-500">No trending hashtags yet</p>
          ) : (
            <div className="space-y-3">
              {trendingHashtags.map((hashtag, index) => (
                <Link
                  key={hashtag.tag}
                  href={`/hashtag/${encodeURIComponent(hashtag.tag)}`}
                  className="block hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">#{hashtag.tag}</p>
                      <p className="text-xs text-gray-500">
                        {hashtag.count} loops
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggested Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Who to Follow</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {trendingUsers.map((suggestedUser) => (
                <div key={suggestedUser.id} className="flex items-center justify-between">
                  <Link
                    href={`/profile/${suggestedUser.username}`}
                    className="flex items-center space-x-3 flex-1 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={suggestedUser.avatar_url} alt={suggestedUser.display_name} />
                      <AvatarFallback>
                        {suggestedUser.display_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        <p className="text-sm font-medium truncate">
                          {suggestedUser.display_name}
                        </p>
                        {suggestedUser.is_verified && (
                          <Badge variant="secondary" className="text-xs">
                            ✓
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        @{suggestedUser.username}
                      </p>
                      {suggestedUser.follower_count && (
                        <p className="text-xs text-gray-500">
                          {suggestedUser.follower_count.toLocaleString()} followers
                        </p>
                      )}
                    </div>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={following[suggestedUser.id]}
                    onClick={() => handleFollow(suggestedUser.id)}
                  >
                    {following[suggestedUser.id] ? "Following" : "Follow"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Your Stats</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Loop Coins</span>
              <Badge variant="secondary">
                {user.loop_coins.toLocaleString()}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Account Type</span>
              <Badge variant={user.is_premium ? "default" : "outline"}>
                {user.is_premium ? "Premium" : "Free"}
              </Badge>
            </div>
            {user.is_verified && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <Badge variant="secondary">
                  ✓ Verified
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
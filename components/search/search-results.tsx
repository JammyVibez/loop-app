"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Hash, Users, GitBranch, Search } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface SearchResultsProps {
  query: string
}

export function SearchResults({ query }: SearchResultsProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())
  const [searchResults, setSearchResults] = useState<{ loops: any[]; users: any[]; hashtags: any[] }>({
    loops: [],
    users: [],
    hashtags: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) return
      setLoading(true)

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          headers: { ...getAuthHeader() },
          cache: "no-store",
        })
        if (response.ok) {
          const data = await response.json()
          const users = data.users || []
          setSearchResults({
            loops: data.loops || [],
            users,
            hashtags: data.hashtags || [],
          })
          if (user) {
            setFollowedUsers(new Set(users.filter((p: any) => p.is_following).map((p: any) => p.id)))
          }
        } else {
          // Fallback lightweight profile search via users API
          const usersRes = await fetch(`/api/users?q=${encodeURIComponent(query)}&limit=20`, {
            headers: { ...getAuthHeader() },
          })
          const usersData = usersRes.ok ? await usersRes.json() : { users: [] }
          const users = usersData.users || usersData.data || []
          setSearchResults({
            loops: [],
            users,
            hashtags: [],
          })
        }
      } catch (error) {
        console.error("Error performing search:", error)
      } finally {
        setLoading(false)
      }
    }

    void performSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, user?.id])

  const handleFollow = async (userId: string) => {
    if (!user) {
      window.location.href = "/login"
      return
    }
    const wasFollowing = followedUsers.has(userId)
    setFollowedUsers((prev) => {
      const next = new Set(prev)
      if (wasFollowing) next.delete(userId)
      else next.add(userId)
      return next
    })
    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          target_user_id: userId,
          action: wasFollowing ? "unfollow" : "follow",
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Follow failed")
      setFollowedUsers((prev) => {
        const next = new Set(prev)
        if (data.is_following) next.add(userId)
        else next.delete(userId)
        return next
      })
    } catch (error: any) {
      setFollowedUsers((prev) => {
        const next = new Set(prev)
        if (wasFollowing) next.add(userId)
        else next.delete(userId)
        return next
      })
      toast({ title: "Could not update follow", description: error.message, variant: "destructive" })
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const getVerificationBadge = (user: any) => {
    if (!user.is_verified) return null
    return (
      <Badge
        variant="secondary"
        className={`${
          user.verification_level === "root"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
        }`}
      >
        {user.verification_level === "root" ? "🌱 Root" : "⭐ Verified"}
      </Badge>
    )
  }

  if (loading) {
    return <div className="flex justify-center p-8">Searching...</div>
  }

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="loops" className="flex items-center space-x-2">
          <GitBranch className="w-4 h-4" />
          <span>Loops ({searchResults.loops.length})</span>
        </TabsTrigger>
        <TabsTrigger value="users" className="flex items-center space-x-2">
          <Users className="w-4 h-4" />
          <span>Users ({searchResults.users.length})</span>
        </TabsTrigger>
        <TabsTrigger value="hashtags" className="flex items-center space-x-2">
          <Hash className="w-4 h-4" />
          <span>Hashtags ({searchResults.hashtags.length})</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-6">
        <div className="space-y-8">
          {/* Top Results */}
          {searchResults.users.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">People</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {searchResults.users.slice(0, 2).map((user: any) => (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <Link href={`/profile/${user.username}`} className="flex items-center space-x-3 flex-1">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                            <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold truncate">{user.display_name}</h4>
                              {getVerificationBadge(user)}
                            </div>
                            <p className="text-sm text-gray-500">@{user.username}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{user.bio}</p>
                            <div className="flex items-center space-x-4 mt-1">
                              <span className="text-xs text-gray-500">
                                {formatNumber(user.followers?.[0]?.count || 0)} followers
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatNumber(user.following?.[0]?.count || 0)} following
                              </span>
                            </div>
                          </div>
                        </Link>
                        <Button
                          variant={followedUsers.has(user.id) ? "outline" : "default"}
                          size="sm"
                          onClick={() => handleFollow(user.id)}
                        >
                          {followedUsers.has(user.id) ? "Following" : "Follow"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Loops */}
          {searchResults.loops.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Loops</h3>
              <div className="space-y-4">
                {searchResults.loops.slice(0, 3).map((loop: any) => (
                  <LoopCard key={loop.id} loop={loop} />
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {searchResults.hashtags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Hashtags</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {searchResults.hashtags.slice(0, 3).map((hashtag: any) => (
                  <Link key={hashtag.tag} href={`/hashtag/${hashtag.tag}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 text-center">
                        <Hash className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <h4 className="font-semibold">#{hashtag.tag}</h4>
                        <p className="text-sm text-gray-500">
                          {formatNumber(hashtag.loop_count?.[0]?.count || 0)} loops
                        </p>
                        {hashtag.is_trending && <Badge className="mt-2 bg-green-100 text-green-700">🔥 Trending</Badge>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="loops" className="mt-6">
        {searchResults.loops.length > 0 ? (
          <div className="space-y-4">
            {searchResults.loops.map((loop: any) => (
              <LoopCard key={loop.id} loop={loop} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No loops found</h3>
            <p className="text-gray-500">Try searching with different keywords</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="users" className="mt-6">
        {searchResults.users.length > 0 ? (
          <div className="space-y-4">
            {searchResults.users.map((user: any) => (
              <Card key={user.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <Link href={`/profile/${user.username}`} className="flex items-center space-x-4 flex-1">
                      <Avatar className="w-16 h-16">
                        <AvatarImage src={user.avatar_url || "/placeholder.svg"} />
                        <AvatarFallback className="text-xl">{user.display_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-xl font-semibold">{user.display_name}</h3>
                          {getVerificationBadge(user)}
                          {user.is_premium && (
                            <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">Premium</Badge>
                          )}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">@{user.username}</p>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">{user.bio}</p>
                        <div className="flex items-center space-x-6">
                          <span className="text-sm">
                            <strong>{formatNumber(user.followers?.[0]?.count || 0)}</strong> followers
                          </span>
                          <span className="text-sm">
                            <strong>{formatNumber(user.following?.[0]?.count || 0)}</strong> following
                          </span>
                        </div>
                      </div>
                    </Link>
                    <Button
                      variant={followedUsers.has(user.id) ? "outline" : "default"}
                      onClick={() => handleFollow(user.id)}
                    >
                      {followedUsers.has(user.id) ? "Following" : "Follow"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No users found</h3>
            <p className="text-gray-500">Try searching with different keywords</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="hashtags" className="mt-6">
        {searchResults.hashtags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.hashtags.map((hashtag: any) => (
              <Link key={hashtag.tag} href={`/hashtag/${hashtag.tag}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Hash className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">#{hashtag.tag}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">
                      {formatNumber(hashtag.loop_count?.[0]?.count || 0)} loops
                    </p>
                    {hashtag.is_trending && <Badge className="bg-green-100 text-green-700">🔥 Trending</Badge>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Hash className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No hashtags found</h3>
            <p className="text-gray-500">Try searching with different keywords</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

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
import { createClient } from "@/lib/supabase"

interface SearchResultsProps {
  query: string
}

export function SearchResults({ query }: SearchResultsProps) {
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())
  const [searchResults, setSearchResults] = useState({
    loops: [],
    users: [],
    hashtags: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const performSearch = async () => {
      if (!query.trim()) return

      try {
        const supabase = createClient()

        const { data: loops, error: loopsError } = await supabase
          .from("loops")
          .select(`
            *,
            author:profiles(*),
            stats:loop_stats(*)
          `)
          .or(`content.ilike.%${query}%,author.display_name.ilike.%${query}%,author.username.ilike.%${query}%`)
          .limit(20)

        const { data: users, error: usersError } = await supabase
          .from("profiles")
          .select(`
            *,
            followers:follows!followed_id(count),
            following:follows!follower_id(count)
          `)
          .or(`display_name.ilike.%${query}%,username.ilike.%${query}%,bio.ilike.%${query}%`)
          .limit(20)

        const { data: hashtags, error: hashtagsError } = await supabase
          .from("hashtags")
          .select(`
            *,
            loop_count:loop_hashtags(count)
          `)
          .ilike("tag", `%${query}%`)
          .limit(20)

        if (!loopsError && !usersError && !hashtagsError) {
          setSearchResults({
            loops: loops || [],
            users: users || [],
            hashtags: hashtags || [],
          })
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: followedData } = await supabase.from("follows").select("followed_id").eq("follower_id", user.id)

          if (followedData) {
            setFollowedUsers(new Set(followedData.map((f) => f.followed_id)))
          }
        }
      } catch (error) {
        console.error("Error performing search:", error)
      } finally {
        setLoading(false)
      }
    }

    performSearch()
  }, [query])

  const handleFollow = async (userId: string) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      if (followedUsers.has(userId)) {
        await supabase.from("follows").delete().eq("follower_id", user.id).eq("followed_id", userId)
      } else {
        await supabase.from("follows").insert({
          follower_id: user.id,
          followed_id: userId,
          created_at: new Date().toISOString(),
        })
      }

      setFollowedUsers((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(userId)) {
          newSet.delete(userId)
        } else {
          newSet.add(userId)
        }
        return newSet
      })
    } catch (error) {
      console.error("Error following/unfollowing user:", error)
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

"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Hash, Users, GitBranch, Search } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import Link from "next/link"

interface SearchResultsProps {
  query: string
}

// Mock search results
const mockResults = {
  loops: [
    {
      id: "1",
      author: {
        id: "1",
        username: "creativemind",
        display_name: "Creative Mind",
        avatar_url: "/placeholder.svg?height=40&width=40",
        is_verified: true,
        verification_level: "root" as const,
        is_premium: true,
      },
      content: {
        type: "text" as const,
        text: "What if we could travel through time but only to witness, never to change anything? 🤔 This thought has been looping in my mind all day... #timetravel #philosophy",
      },
      created_at: new Date("2024-01-15T10:30:00Z"),
      stats: {
        likes: 234,
        branches: 12,
        comments: 45,
        saves: 67,
      },
    },
  ],
  users: [
    {
      id: "1",
      username: "creativemind",
      display_name: "Creative Mind",
      avatar_url: "/placeholder.svg?height=60&width=60",
      bio: "Exploring the intersection of creativity and technology",
      is_verified: true,
      verification_level: "root" as const,
      is_premium: true,
      followers: 12500,
      following: 890,
    },
    {
      id: "2",
      username: "codemaster",
      display_name: "Code Master",
      avatar_url: "/placeholder.svg?height=60&width=60",
      bio: "Full-stack developer sharing coding tips and tricks",
      is_verified: true,
      verification_level: "influencer" as const,
      is_premium: false,
      followers: 8900,
      following: 1200,
    },
  ],
  hashtags: [
    { tag: "timetravel", count: 1234, trending: true },
    { tag: "philosophy", count: 987, trending: false },
    { tag: "creativity", count: 756, trending: true },
  ],
}

export function SearchResults({ query }: SearchResultsProps) {
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(new Set())

  const handleFollow = (userId: string) => {
    setFollowedUsers((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
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

  // Filter results based on query
  const filteredLoops = mockResults.loops.filter(
    (loop) =>
      loop.content.text?.toLowerCase().includes(query.toLowerCase()) ||
      loop.author.display_name.toLowerCase().includes(query.toLowerCase()) ||
      loop.author.username.toLowerCase().includes(query.toLowerCase()),
  )

  const filteredUsers = mockResults.users.filter(
    (user) =>
      user.display_name.toLowerCase().includes(query.toLowerCase()) ||
      user.username.toLowerCase().includes(query.toLowerCase()) ||
      user.bio?.toLowerCase().includes(query.toLowerCase()),
  )

  const filteredHashtags = mockResults.hashtags.filter((hashtag) =>
    hashtag.tag.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <Tabs defaultValue="all" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="all">All</TabsTrigger>
        <TabsTrigger value="loops" className="flex items-center space-x-2">
          <GitBranch className="w-4 h-4" />
          <span>Loops ({filteredLoops.length})</span>
        </TabsTrigger>
        <TabsTrigger value="users" className="flex items-center space-x-2">
          <Users className="w-4 h-4" />
          <span>Users ({filteredUsers.length})</span>
        </TabsTrigger>
        <TabsTrigger value="hashtags" className="flex items-center space-x-2">
          <Hash className="w-4 h-4" />
          <span>Hashtags ({filteredHashtags.length})</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-6">
        <div className="space-y-8">
          {/* Top Results */}
          {filteredUsers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">People</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredUsers.slice(0, 2).map((user) => (
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
                              <span className="text-xs text-gray-500">{formatNumber(user.followers)} followers</span>
                              <span className="text-xs text-gray-500">{formatNumber(user.following)} following</span>
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
          {filteredLoops.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Loops</h3>
              <div className="space-y-4">
                {filteredLoops.slice(0, 3).map((loop) => (
                  <LoopCard key={loop.id} loop={loop} />
                ))}
              </div>
            </div>
          )}

          {/* Hashtags */}
          {filteredHashtags.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Hashtags</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredHashtags.slice(0, 3).map((hashtag) => (
                  <Link key={hashtag.tag} href={`/hashtag/${hashtag.tag}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4 text-center">
                        <Hash className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <h4 className="font-semibold">#{hashtag.tag}</h4>
                        <p className="text-sm text-gray-500">{formatNumber(hashtag.count)} loops</p>
                        {hashtag.trending && <Badge className="mt-2 bg-green-100 text-green-700">Trending</Badge>}
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
        {filteredLoops.length > 0 ? (
          <div className="space-y-4">
            {filteredLoops.map((loop) => (
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
        {filteredUsers.length > 0 ? (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
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
                            <strong>{formatNumber(user.followers)}</strong> followers
                          </span>
                          <span className="text-sm">
                            <strong>{formatNumber(user.following)}</strong> following
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
        {filteredHashtags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHashtags.map((hashtag) => (
              <Link key={hashtag.tag} href={`/hashtag/${hashtag.tag}`}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <Hash className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">#{hashtag.tag}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-3">{formatNumber(hashtag.count)} loops</p>
                    {hashtag.trending && <Badge className="bg-green-100 text-green-700">🔥 Trending</Badge>}
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

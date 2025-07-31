"use client"

import Link from "next/link"
import { TrendingUp, Hash, Users, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"

export function TrendingSidebar() {
  const trendingHashtags = [
    { tag: "AI", posts: 1234 },
    { tag: "WebDev", posts: 892 },
    { tag: "Design", posts: 756 },
    { tag: "Music", posts: 643 },
    { tag: "Photography", posts: 521 },
  ]

  const suggestedUsers = [
    {
      id: "1",
      username: "designguru",
      display_name: "Design Guru",
      avatar_url: "/placeholder.svg?height=32&width=32",
      is_verified: true,
      followers: 12500,
    },
    {
      id: "2",
      username: "codemaster",
      display_name: "Code Master",
      avatar_url: "/placeholder.svg?height=32&width=32",
      is_verified: false,
      followers: 8900,
    },
    {
      id: "3",
      username: "artcreator",
      display_name: "Art Creator",
      avatar_url: "/placeholder.svg?height=32&width=32",
      is_verified: true,
      followers: 15600,
    },
  ]

  const trendingCircles = [
    {
      id: "1",
      name: "Web Developers",
      members: 2500,
      avatar_url: "/placeholder.svg?height=32&width=32",
    },
    {
      id: "2",
      name: "Digital Artists",
      members: 1800,
      avatar_url: "/placeholder.svg?height=32&width=32",
    },
    {
      id: "3",
      name: "Music Producers",
      members: 1200,
      avatar_url: "/placeholder.svg?height=32&width=32",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Trending Hashtags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <span>Trending</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {trendingHashtags.map((item, index) => (
            <Link key={item.tag} href={`/hashtag/${item.tag}`}>
              <div className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <Hash className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">{item.tag}</span>
                </div>
                <span className="text-sm text-muted-foreground">{item.posts}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Suggested Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <span>Who to Follow</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {suggestedUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.display_name} />
                  <AvatarFallback>{user.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center space-x-1">
                    <Link href={`/profile/${user.username}`}>
                      <span className="font-medium text-sm hover:underline">{user.display_name}</span>
                    </Link>
                    {user.is_verified && (
                      <Badge variant="secondary" className="h-3 w-3 p-0 bg-blue-500">
                        <span className="text-white text-xs">✓</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                  <p className="text-xs text-muted-foreground">{user.followers.toLocaleString()} followers</p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                Follow
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Trending Circles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-green-600" />
            <span>Popular Circles</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {trendingCircles.map((circle) => (
            <div key={circle.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
                  <AvatarFallback>{circle.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <Link href={`/circles/${circle.id}`}>
                    <span className="font-medium text-sm hover:underline">{circle.name}</span>
                  </Link>
                  <p className="text-xs text-muted-foreground">{circle.members.toLocaleString()} members</p>
                </div>
              </div>
              <Button size="sm" variant="outline">
                Join
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

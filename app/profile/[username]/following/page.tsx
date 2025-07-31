"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Users, UserCheck, UserPlus } from "lucide-react"
import Link from "next/link"

interface User {
  id: string
  username: string
  displayName: string
  avatar: string
  bio: string
  verified: boolean
  premium: boolean
  followers: number
  following: number
  loops: number
  isFollowing: boolean
  mutualFollowers: number
  joinedDate: string
}

export default function FollowingPage() {
  const params = useParams()
  const username = params.username as string
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("following")

  useEffect(() => {
    // Simulate API call
    const fetchUsers = async () => {
      setLoading(true)

      const mockUsers: User[] = [
        {
          id: "1",
          username: "sarahdev",
          displayName: "Sarah Chen",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Full-stack developer passionate about React and Node.js",
          verified: true,
          premium: true,
          followers: 15420,
          following: 892,
          loops: 234,
          isFollowing: true,
          mutualFollowers: 12,
          joinedDate: "2023-01-15",
        },
        {
          id: "2",
          username: "reactmaster",
          displayName: "Alex Rodriguez",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "React expert • Building the future of web development",
          verified: true,
          premium: false,
          followers: 8930,
          following: 445,
          loops: 156,
          isFollowing: false,
          mutualFollowers: 8,
          joinedDate: "2023-03-22",
        },
        {
          id: "3",
          username: "designguru",
          displayName: "Emma Wilson",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "UI/UX Designer • Creating beautiful digital experiences",
          verified: false,
          premium: true,
          followers: 5670,
          following: 234,
          loops: 89,
          isFollowing: true,
          mutualFollowers: 5,
          joinedDate: "2023-05-10",
        },
        {
          id: "4",
          username: "codemaster",
          displayName: "David Kim",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Software architect • Open source contributor",
          verified: true,
          premium: true,
          followers: 12340,
          following: 567,
          loops: 345,
          isFollowing: false,
          mutualFollowers: 15,
          joinedDate: "2022-11-08",
        },
        {
          id: "5",
          username: "mobileguru",
          displayName: "Lisa Zhang",
          avatar: "/placeholder.svg?height=40&width=40",
          bio: "Mobile app developer • iOS & Android specialist",
          verified: false,
          premium: false,
          followers: 3450,
          following: 123,
          loops: 67,
          isFollowing: true,
          mutualFollowers: 3,
          joinedDate: "2023-07-14",
        },
      ]

      setTimeout(() => {
        setUsers(mockUsers)
        setFilteredUsers(mockUsers)
        setLoading(false)
      }, 1000)
    }

    fetchUsers()
  }, [username])

  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.bio.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const handleFollow = (userId: string) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              isFollowing: !user.isFollowing,
              followers: user.isFollowing ? user.followers - 1 : user.followers + 1,
            }
          : user,
      ),
    )
  }

  const getDisplayUsers = () => {
    if (activeTab === "following") {
      return filteredUsers.filter((user) => user.isFollowing)
    } else {
      return filteredUsers.filter((user) => !user.isFollowing)
    }
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
              <p className="text-muted-foreground">Connections</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search connections..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="following" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Following ({users.filter((u) => u.isFollowing).length})
            </TabsTrigger>
            <TabsTrigger value="suggested" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Suggested ({users.filter((u) => !u.isFollowing).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
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
                {getDisplayUsers().length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        {activeTab === "following" ? "No following found" : "No suggestions found"}
                      </h3>
                      <p className="text-muted-foreground">
                        {searchQuery
                          ? "Try adjusting your search terms"
                          : activeTab === "following"
                            ? "This user is not following anyone yet"
                            : "No new suggestions available"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  getDisplayUsers().map((user) => (
                    <Card key={user.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-4">
                          <Link href={`/profile/${user.username}`}>
                            <Avatar className="h-12 w-12 cursor-pointer">
                              <AvatarImage src={user.avatar || "/placeholder.svg"} />
                              <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
                            </Avatar>
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Link href={`/profile/${user.username}`} className="font-semibold hover:underline">
                                {user.displayName}
                              </Link>
                              {user.verified && (
                                <Badge variant="secondary" className="text-xs">
                                  ✓
                                </Badge>
                              )}
                              {user.premium && (
                                <Badge variant="outline" className="text-xs">
                                  ⭐
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">@{user.username}</p>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{user.bio}</p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{user.followers.toLocaleString()} followers</span>
                              <span>{user.loops} loops</span>
                              {user.mutualFollowers > 0 && <span>{user.mutualFollowers} mutual</span>}
                              <span>Joined {new Date(user.joinedDate).getFullYear()}</span>
                            </div>
                          </div>
                          <Button
                            variant={user.isFollowing ? "outline" : "default"}
                            size="sm"
                            onClick={() => handleFollow(user.id)}
                          >
                            {user.isFollowing ? "Following" : "Follow"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

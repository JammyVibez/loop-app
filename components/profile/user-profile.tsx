"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Calendar,
  MapPin,
  LinkIcon,
  TreePine,
  Heart,
  MessageCircle,
  Settings,
  UserPlus,
  UserCheck,
  Crown,
  Share,
} from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { ProfileThemeCustomizer } from "@/components/profile/profile-theme-customizer"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface UserProfileProps {
  username: string
}

export function UserProfile({ username }: UserProfileProps) {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const [isFollowing, setIsFollowing] = useState(false)
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false)

  // Mock user data - in real app, this would come from API
  const user = {
    id: "1",
    username: username,
    display_name: "Sarah Chen",
    bio: "Full-stack developer passionate about React and Node.js. Building the future of web development, one loop at a time. 🚀",
    avatar_url: "/placeholder.svg?height=120&width=120",
    banner_url: "/placeholder.svg?height=200&width=800",
    location: "San Francisco, CA",
    website: "https://sarahchen.dev",
    joined_date: "2023-01-15",
    is_verified: true,
    verification_level: "influencer" as const,
    is_premium: true,
    stats: {
      followers: 15420,
      following: 892,
      loops: 234,
      likes_received: 45600,
    },
    theme: {
      primary_color: "#8B5CF6",
      background_gradient: "from-purple-100 to-blue-100",
    },
  }

  const isOwnProfile = currentUser?.username === username

  const mockLoops = [
    {
      id: "1",
      author: user,
      content: {
        type: "text" as const,
        text: "Just finished building a new React component library! 🎉 It includes 50+ reusable components with full TypeScript support. The goal was to create something that could be used across multiple projects while maintaining consistency and performance.\n\n#react #typescript #componentlibrary",
      },
      created_at: new Date("2024-01-15T10:30:00Z"),
      stats: { likes: 1247, branches: 23, comments: 89, saves: 234 },
    },
    {
      id: "2",
      author: user,
      content: {
        type: "image" as const,
        image_url: "/placeholder.svg?height=400&width=600",
        caption: "Working on some new UI designs for our upcoming project. What do you think of this color scheme? 🎨",
      },
      created_at: new Date("2024-01-14T15:20:00Z"),
      stats: { likes: 892, branches: 12, comments: 56, saves: 178 },
    },
  ]

  const handleFollow = () => {
    setIsFollowing(!isFollowing)
    toast({
      description: isFollowing ? "Unfollowed user" : "Following user",
    })
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href)
    toast({
      description: "Profile link copied to clipboard!",
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Profile Header */}
        <Card className="mb-6 overflow-hidden">
          {/* Banner */}
          <div
            className={`h-48 bg-gradient-to-r ${user.theme.background_gradient} relative`}
            style={{
              backgroundImage: user.banner_url ? `url(${user.banner_url})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute top-4 right-4 flex space-x-2">
              <Button variant="secondary" size="sm" onClick={handleShare}>
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              {isOwnProfile && (
                <Button variant="secondary" size="sm" onClick={() => setShowThemeCustomizer(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Customize
                </Button>
              )}
            </div>
          </div>

          <CardContent className="relative pt-0 pb-6">
            {/* Profile Info */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between -mt-16 mb-6">
              <div className="flex items-end space-x-4">
                <Avatar className="w-32 h-32 border-4 border-white dark:border-gray-800">
                  <AvatarImage src={user.avatar_url || "/placeholder.svg"} alt={user.display_name} />
                  <AvatarFallback className="text-2xl">{user.display_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="pb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <h1 className="text-3xl font-bold text-white md:text-gray-900 dark:md:text-white">
                      {user.display_name}
                    </h1>
                    {user.is_verified && (
                      <Badge
                        variant="secondary"
                        className={
                          user.verification_level === "root"
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }
                      >
                        {user.verification_level === "root" ? "🌱 Root" : "⭐ Verified"}
                      </Badge>
                    )}
                    {user.is_premium && (
                      <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-300 md:text-gray-600 dark:md:text-gray-400">@{user.username}</p>
                </div>
              </div>

              <div className="flex space-x-2 mt-4 md:mt-0">
                {!isOwnProfile && (
                  <>
                    <Button
                      onClick={handleFollow}
                      variant={isFollowing ? "outline" : "default"}
                      className={!isFollowing ? "bg-gradient-to-r from-purple-500 to-blue-500" : ""}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Follow
                        </>
                      )}
                    </Button>
                    <Button variant="outline">
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                  </>
                )}
                {isOwnProfile && (
                  <Link href="/settings">
                    <Button variant="outline">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Bio and Info */}
            <div className="space-y-4">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{user.bio}</p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {user.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{user.location}</span>
                  </div>
                )}
                {user.website && (
                  <div className="flex items-center space-x-1">
                    <LinkIcon className="w-4 h-4" />
                    <a
                      href={user.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:underline"
                    >
                      {user.website.replace("https://", "")}
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {new Date(user.joined_date).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex space-x-6">
                <Link href={`/profile/${username}/following`} className="hover:underline transition-colors">
                  <span className="font-bold">{user.stats.following.toLocaleString()}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Following</span>
                </Link>
                <Link href={`/profile/${username}/followers`} className="hover:underline transition-colors">
                  <span className="font-bold">{user.stats.followers.toLocaleString()}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Followers</span>
                </Link>
                <div>
                  <span className="font-bold">{user.stats.loops.toLocaleString()}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Loops</span>
                </div>
                <div>
                  <span className="font-bold">{user.stats.likes_received.toLocaleString()}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Likes</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Content */}
        <Tabs defaultValue="loops" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="loops" className="flex items-center space-x-2">
              <TreePine className="w-4 h-4" />
              <span>Loops</span>
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center space-x-2">
              <TreePine className="w-4 h-4" />
              <span>Branches</span>
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex items-center space-x-2">
              <Heart className="w-4 h-4" />
              <span>Likes</span>
            </TabsTrigger>
            <TabsTrigger value="media" className="flex items-center space-x-2">
              <span>📷</span>
              <span>Media</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="loops" className="mt-6">
            <div className="space-y-6">
              {mockLoops.map((loop) => (
                <LoopCard key={loop.id} loop={loop} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="branches" className="mt-6">
            <div className="text-center py-12">
              <TreePine className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No branches yet</h3>
              <p className="text-gray-500 dark:text-gray-500">Branches from other loops will appear here</p>
            </div>
          </TabsContent>

          <TabsContent value="likes" className="mt-6">
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No liked loops</h3>
              <p className="text-gray-500 dark:text-gray-500">Liked loops will appear here</p>
            </div>
          </TabsContent>

          <TabsContent value="media" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Theme Customizer Modal */}
      {showThemeCustomizer && (
        <ProfileThemeCustomizer
          isOpen={showThemeCustomizer}
          onClose={() => setShowThemeCustomizer(false)}
          currentTheme={user.theme}
        />
      )}
    </div>
  )
}

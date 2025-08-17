"use client"

import { useState, useEffect } from "react"
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
import { createClient } from "@supabase/supabase-js"

interface UserProfileProps {
  username: string
}

export function UserProfile({ username }: UserProfileProps) {
  const { user: currentUser } = useAuth()
  const { toast } = useToast()
  const [isFollowing, setIsFollowing] = useState(false)
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loops, setLoops] = useState<any[]>([])
  const [loopsLoading, setLoopsLoading] = useState(true)
  const [loopsError, setLoopsError] = useState<string>("")

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const fetchProfile = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single()
      if (!error && data) {
        setProfile(data)
      }
      setLoading(false)
    }
    const fetchLoops = async () => {
      setLoopsLoading(true)
      setLoopsError("")
      try {
        const { data, error } = await supabase
          .from("loops")
          .select(`
            *,
            author:profiles!author_id(id, username, display_name, avatar_url, is_verified, is_premium),
            loop_stats(likes_count, comments_count, branches_count, shares_count, views_count)
          `)
          .eq("author_id", profile?.id)
          .order("created_at", { ascending: false })
        if (error) {
          setLoopsError("Failed to fetch loops.")
          setLoops([])
        } else {
          setLoops(data || [])
        }
      } catch (err) {
        setLoopsError("Error loading loops.")
        setLoops([])
      }
      setLoopsLoading(false)
    }
    fetchProfile()
    fetchLoops()
    // Optionally, subscribe to changes for realtime updates
    const subscription = supabase
      .channel('public:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `username=eq.${username}` }, payload => {
        fetchProfile()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [username])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading profile...</div>
  }
  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">Profile not found</div>
  }

  const isOwnProfile = currentUser?.username === username

  // const mockLoops = [
  //   {
  //     id: "1",
  //     user: profile,
  //     content: "Just finished building a new React component library! 🎉 It includes 50+ reusable components with full TypeScript support. The goal was to create something that could be used across multiple projects while maintaining consistency and performance.\n\n#react #typescript #componentlibrary",
  //     media_url: undefined,
  //     media_type: undefined,
  //     likes: 1247,
  //     comments: 89,
  //     branches: 23,
  //     created_at: new Date("2024-01-15T10:30:00Z").toISOString(),
  //     hashtags: ["react", "typescript", "componentlibrary"],
  //     is_liked: false,
  //     is_bookmarked: false,
  //     parent_loop_id: undefined,
  //   },
  // ]

  const handleFollow = async () => {
    if (!currentUser || !profile) return

    try {
      const response = await fetch('/api/users/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
          action: isFollowing ? 'unfollow' : 'follow',
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setIsFollowing(data.is_following)
        toast({
          description: data.message,
        })
      } else {
        toast({
          description: data.error || 'Failed to update follow status',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        description: 'Network error occurred',
        variant: 'destructive',
      })
    }
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
            className={`h-48 bg-gradient-to-r ${profile.theme_data?.background_gradient || "from-purple-100 to-blue-100"} relative`}
            style={{
              backgroundImage: profile.banner_url ? `url(${profile.banner_url})` : undefined,
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
                  <AvatarImage src={profile.avatar_url || "/placeholder.svg"} alt={profile.display_name} />
                  <AvatarFallback className="text-2xl">{profile.display_name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="pb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <h1 className="text-3xl font-bold text-white md:text-gray-900 dark:md:text-white">
                      {profile.display_name}
                    </h1>
                    {profile.is_verified && (
                      <Badge
                        variant="secondary"
                        className={
                          profile.is_admin
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }
                      >
                        {profile.is_admin ? "🌱 Root" : "⭐ Verified"}
                      </Badge>
                    )}
                    {profile.is_premium && (
                      <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-300 md:text-gray-600 dark:md:text-gray-400">@{profile.username}</p>
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
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{profile.bio}</p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {profile.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <div className="flex items-center space-x-1">
                    <LinkIcon className="w-4 h-4" />
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 hover:underline"
                    >
                      {profile.website.replace("https://", "")}
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex space-x-6">
                <Link href={`/profile/${username}/following`} className="hover:underline transition-colors">
                  <span className="font-bold">{profile.following_count?.toLocaleString() ?? 0}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Following</span>
                </Link>
                <Link href={`/profile/${username}/followers`} className="hover:underline transition-colors">
                  <span className="font-bold">{profile.followers_count?.toLocaleString() ?? 0}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Followers</span>
                </Link>
                <div>
                  <span className="font-bold">{profile.loops_count?.toLocaleString() ?? 0}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Loops</span>
                </div>
                <div>
                  <span className="font-bold">{loops.length?.toLocaleString() ?? 0}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-1">Total Loops</span>
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
              {loopsLoading ? (
                <div className="text-center py-12 text-gray-500">Loading loops...</div>
              ) : loopsError ? (
                <div className="text-center py-12 text-red-500">{loopsError}</div>
              ) : loops.length > 0 ? (
                loops.map((loop) => (
                  <LoopCard
                    key={loop.id}
                    loop={loop}
                    onLike={() => {}}
                    onBookmark={() => {}}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-gray-500">No loops found.</div>
              )}
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
          open={showThemeCustomizer}
          onOpenChange={setShowThemeCustomizer}
          currentTheme={profile.theme_data}
          onThemeUpdate={(theme) => {
            setProfile({ ...profile, theme_data: theme })
          }}
        />
      )}
    </div>
  )
}

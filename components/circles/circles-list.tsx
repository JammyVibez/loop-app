"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Calendar, Trophy, Lock, Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const mockCircles = [
  {
    id: "1",
    name: "Creative Writers",
    description: "A community for writers to share stories and collaborate on narrative loops",
    avatar_url: "/placeholder.svg?height=60&width=60",
    banner_url: "/placeholder.svg?height=200&width=400",
    member_count: 1247,
    is_private: false,
    is_member: true,
    category: "Writing",
    current_challenge: {
      title: "Time Travel Stories",
      ends_at: new Date("2024-01-22T23:59:59Z"),
    },
    recent_activity: "2 hours ago",
  },
  {
    id: "2",
    name: "Digital Artists Hub",
    description: "Share your digital art and get feedback from fellow artists",
    avatar_url: "/placeholder.svg?height=60&width=60",
    banner_url: "/placeholder.svg?height=200&width=400",
    member_count: 892,
    is_private: false,
    is_member: false,
    category: "Art",
    current_challenge: {
      title: "Abstract Emotions",
      ends_at: new Date("2024-01-25T23:59:59Z"),
    },
    recent_activity: "1 hour ago",
  },
  {
    id: "3",
    name: "Music Producers",
    description: "Collaborate on beats, share samples, and create musical loops together",
    avatar_url: "/placeholder.svg?height=60&width=60",
    banner_url: "/placeholder.svg?height=200&width=400",
    member_count: 634,
    is_private: true,
    is_member: false,
    category: "Music",
    current_challenge: {
      title: "Lo-Fi Beats Challenge",
      ends_at: new Date("2024-01-20T23:59:59Z"),
    },
    recent_activity: "30 minutes ago",
  },
  {
    id: "4",
    name: "Philosophy Discussions",
    description: "Deep conversations about life, existence, and everything in between",
    avatar_url: "/placeholder.svg?height=60&width=60",
    banner_url: "/placeholder.svg?height=200&width=400",
    member_count: 456,
    is_private: false,
    is_member: true,
    category: "Philosophy",
    current_challenge: {
      title: "What is Reality?",
      ends_at: new Date("2024-01-28T23:59:59Z"),
    },
    recent_activity: "5 minutes ago",
  },
]

export function CirclesList() {
  const [joinedCircles, setJoinedCircles] = useState<Set<string>>(
    new Set(mockCircles.filter((c) => c.is_member).map((c) => c.id)),
  )
  const { toast } = useToast()

  const handleJoinCircle = (circle: (typeof mockCircles)[0]) => {
    if (circle.is_private) {
      toast({
        title: "Request Sent",
        description: "Your request to join this private circle has been sent to the moderators.",
      })
    } else {
      setJoinedCircles((prev) => new Set([...prev, circle.id]))
      toast({
        title: "Joined Circle!",
        description: `You've successfully joined ${circle.name}`,
      })
    }
  }

  const handleLeaveCircle = (circleId: string) => {
    setJoinedCircles((prev) => {
      const newSet = new Set(prev)
      newSet.delete(circleId)
      return newSet
    })
    toast({
      title: "Left Circle",
      description: "You've left the circle successfully.",
    })
  }

  const formatMemberCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K"
    }
    return count.toString()
  }

  const getTimeUntilChallenge = (endDate: Date) => {
    const now = new Date()
    const diff = endDate.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}d ${hours}h left`
    if (hours > 0) return `${hours}h left`
    return "Ending soon"
  }

  const renderCircleCard = (circle: (typeof mockCircles)[0]) => (
    <Card key={circle.id} className="hover:shadow-lg transition-shadow">
      <div
        className="h-32 bg-gradient-to-r from-purple-400 to-blue-500 rounded-t-lg relative"
        style={{
          backgroundImage: circle.banner_url ? `url(${circle.banner_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute top-4 right-4">
          {circle.is_private ? (
            <Badge variant="secondary" className="bg-gray-800 text-white">
              <Lock className="w-3 h-3 mr-1" />
              Private
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-green-600 text-white">
              <Globe className="w-3 h-3 mr-1" />
              Public
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="relative pt-0 pb-4">
        <div className="flex items-end justify-between -mt-8 mb-4">
          <Avatar className="w-16 h-16 border-4 border-white">
            <AvatarImage src={circle.avatar_url || "/placeholder.svg"} alt={circle.name} />
            <AvatarFallback>{circle.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <Badge variant="outline">{circle.category}</Badge>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="font-bold text-lg">{circle.name}</h3>
            <p className="text-sm text-gray-600">{circle.description}</p>
          </div>

          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Users className="w-4 h-4" />
                <span>{formatMemberCount(circle.member_count)} members</span>
              </div>
              <span>Active {circle.recent_activity}</span>
            </div>
          </div>

          {circle.current_challenge && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-sm">{circle.current_challenge.title}</span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-gray-600">
                  <Calendar className="w-3 h-3" />
                  <span>{getTimeUntilChallenge(circle.current_challenge.ends_at)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex space-x-2">
            {joinedCircles.has(circle.id) ? (
              <>
                <Button className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500">View Circle</Button>
                <Button
                  variant="outline"
                  onClick={() => handleLeaveCircle(circle.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  Leave
                </Button>
              </>
            ) : (
              <Button
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
                onClick={() => handleJoinCircle(circle)}
              >
                {circle.is_private ? "Request to Join" : "Join Circle"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  const myCircles = mockCircles.filter((circle) => joinedCircles.has(circle.id))
  const discoverCircles = mockCircles.filter((circle) => !joinedCircles.has(circle.id))

  return (
    <Tabs defaultValue="discover" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="discover">Discover</TabsTrigger>
        <TabsTrigger value="my-circles">My Circles ({myCircles.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="discover" className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {discoverCircles.map(renderCircleCard)}
        </div>
      </TabsContent>

      <TabsContent value="my-circles" className="mt-6">
        {myCircles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{myCircles.map(renderCircleCard)}</div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No circles joined yet</h3>
            <p className="text-gray-500 mb-4">Discover and join circles to connect with like-minded creators</p>
            <Button className="bg-gradient-to-r from-purple-500 to-blue-500">Explore Circles</Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

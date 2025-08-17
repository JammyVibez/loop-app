"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Calendar, Trophy, Lock, Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"

export function CirclesList() {
  const [circles, setCircles] = useState([])
  const [joinedCircles, setJoinedCircles] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchCircles = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { data: circlesData, error: circlesError } = await supabase
          .from("circles")
          .select(`
            *,
            member_count:circle_members(count),
            current_challenge:circle_challenges(
              title,
              ends_at
            ),
            user_membership:circle_members!inner(
              user_id,
              role,
              joined_at
            )
          `)
          .order("created_at", { ascending: false })

        if (circlesError) {
          console.error("Error fetching circles:", circlesError)
          return
        }

        if (user) {
          const { data: userCircles, error: userCirclesError } = await supabase
            .from("circle_members")
            .select("circle_id")
            .eq("user_id", user.id)

          if (!userCirclesError && userCircles) {
            setJoinedCircles(new Set(userCircles.map((uc) => uc.circle_id)))
          }
        }

        setCircles(circlesData || [])
      } catch (error) {
        console.error("Error fetching circles:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCircles()
  }, [])

  const handleJoinCircle = async (circle: any) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to join circles.",
          variant: "destructive",
        })
        return
      }

      if (circle.is_private) {
        const { error } = await supabase.from("circle_join_requests").insert({
          circle_id: circle.id,
          user_id: user.id,
          status: "pending",
          created_at: new Date().toISOString(),
        })

        if (error) {
          console.error("Error creating join request:", error)
          toast({
            title: "Error",
            description: "Failed to send join request.",
            variant: "destructive",
          })
          return
        }

        toast({
          title: "Request Sent",
          description: "Your request to join this private circle has been sent to the moderators.",
        })
      } else {
        const { error } = await supabase.from("circle_members").insert({
          circle_id: circle.id,
          user_id: user.id,
          role: "member",
          joined_at: new Date().toISOString(),
        })

        if (error) {
          console.error("Error joining circle:", error)
          toast({
            title: "Error",
            description: "Failed to join circle.",
            variant: "destructive",
          })
          return
        }

        setJoinedCircles((prev) => new Set([...prev, circle.id]))
        toast({
          title: "Joined Circle!",
          description: `You've successfully joined ${circle.name}`,
        })
      }
    } catch (error) {
      console.error("Error joining circle:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      })
    }
  }

  const handleLeaveCircle = async (circleId: string) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { error } = await supabase.from("circle_members").delete().eq("circle_id", circleId).eq("user_id", user.id)

      if (error) {
        console.error("Error leaving circle:", error)
        toast({
          title: "Error",
          description: "Failed to leave circle.",
          variant: "destructive",
        })
        return
      }

      setJoinedCircles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(circleId)
        return newSet
      })
      toast({
        title: "Left Circle",
        description: "You've left the circle successfully.",
      })
    } catch (error) {
      console.error("Error leaving circle:", error)
    }
  }

  const formatMemberCount = (count: number) => {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + "K"
    }
    return count.toString()
  }

  const getTimeUntilChallenge = (endDate: string) => {
    const now = new Date()
    const end = new Date(endDate)
    const diff = end.getTime() - now.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 0) return `${days}d ${hours}h left`
    if (hours > 0) return `${hours}h left`
    return "Ending soon"
  }

  const renderCircleCard = (circle: any) => (
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
                <span>{formatMemberCount(circle.member_count?.[0]?.count || 0)} members</span>
              </div>
              <span>Active {circle.recent_activity || "recently"}</span>
            </div>
          </div>

          {circle.current_challenge?.[0] && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Trophy className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-sm">{circle.current_challenge[0].title}</span>
                </div>
                <div className="flex items-center space-x-1 text-xs text-gray-600">
                  <Calendar className="w-3 h-3" />
                  <span>{getTimeUntilChallenge(circle.current_challenge[0].ends_at)}</span>
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

  if (loading) {
    return <div className="flex justify-center p-8">Loading circles...</div>
  }

  const myCircles = circles.filter((circle: any) => joinedCircles.has(circle.id))
  const discoverCircles = circles.filter((circle: any) => !joinedCircles.has(circle.id))

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

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Lock, Globe } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

export function CirclesList() {
  const [circles, setCircles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()

  const fetchCircles = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/circles?limit=60", {
        headers: user ? getAuthHeader() : undefined,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to fetch circles")
      setCircles(data.circles || [])
    } catch (error) {
      console.error("Error fetching circles:", error)
      toast({ title: "Error", description: "Failed to load circles", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCircles()
  }, [user?.id])

  const handleJoinCircle = async (circle: any) => {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to join circles.", variant: "destructive" })
      return
    }

    try {
      const response = await fetch(`/api/circles/${circle.id}/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to join circle")

      setCircles((prev) =>
        prev.map((item) =>
          item.id === circle.id
            ? {
                ...item,
                is_member: data.status === "active",
                membership_status: data.status,
                member_count: item.member_count + (data.status === "active" ? 1 : 0),
              }
            : item,
        ),
      )
      toast({ title: data.status === "pending" ? "Request Sent" : "Joined Circle!", description: data.message })
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to join circle.", variant: "destructive" })
    }
  }

  const handleLeaveCircle = async (circleId: string) => {
    if (!user) return
    try {
      const response = await fetch(`/api/circles/${circleId}/join`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to leave circle")
      setCircles((prev) => prev.map((item) => item.id === circleId ? { ...item, is_member: false, membership_status: null, member_count: Math.max(0, item.member_count - 1) } : item))
      toast({ title: "Left Circle", description: data.message || "You've left the circle successfully." })
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to leave circle.", variant: "destructive" })
    }
  }

  const formatMemberCount = (count: number) => count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString()

  const renderCircleCard = (circle: any) => (
    <Card key={circle.id} className="landing-card-3d overflow-hidden border-white/10 bg-[#0a1020]/85 text-slate-100 shadow-xl shadow-black/20">
      <div
        className="relative h-32 bg-gradient-to-r from-violet-500 to-cyan-500"
        style={{ backgroundImage: circle.banner_url ? `url(${circle.banner_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute right-4 top-4">
          {circle.is_private ? (
            <Badge className="bg-slate-950/80 text-white"><Lock className="mr-1 h-3 w-3" /> Private</Badge>
          ) : (
            <Badge className="bg-emerald-600/80 text-white"><Globe className="mr-1 h-3 w-3" /> Public</Badge>
          )}
        </div>
      </div>
      <CardContent className="relative pb-4 pt-0">
        <div className="mb-4 -mt-8 flex items-end justify-between">
          <Avatar className="h-16 w-16 border-4 border-[#0a1020]">
            <AvatarImage src={circle.avatar_url || circle.owner?.avatar_url || "/placeholder.svg"} alt={circle.name} />
            <AvatarFallback>{circle.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <Badge variant="outline" className="border-white/15 text-slate-200">{circle.category}</Badge>
        </div>

        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-bold text-white">{circle.name}</h3>
            <p className="line-clamp-2 text-sm text-slate-400">{circle.description}</p>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {formatMemberCount(circle.member_count || 0)} members</span>
            {circle.membership_status === "pending" && <Badge className="bg-amber-500/15 text-amber-200">Pending</Badge>}
          </div>

          <div className="flex gap-2">
            {circle.is_member ? (
              <>
                <Link href={`/circles/${circle.id}`} className="flex-1">
                  <Button className="w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white">View Circle</Button>
                </Link>
                <Button variant="outline" onClick={() => handleLeaveCircle(circle.id)} className="rounded-full border-white/15 bg-white/[0.04] text-red-300 hover:bg-white/10">Leave</Button>
              </>
            ) : circle.membership_status === "pending" ? (
              <Link href={`/circles/${circle.id}`} className="w-full">
                <Button className="w-full rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15">View Request</Button>
              </Link>
            ) : (
              <Button className="w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white" onClick={() => handleJoinCircle(circle)}>
                {circle.is_private ? "Request to Join" : "Join Circle"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  if (loading) return <div className="flex justify-center p-8 text-slate-300">Loading circles...</div>

  const myCircles = circles.filter((circle) => circle.is_member || circle.membership_status === "pending")
  const discoverCircles = circles.filter((circle) => !circle.is_member && circle.membership_status !== "pending")

  return (
    <Tabs defaultValue="discover" className="w-full">
      <TabsList className="grid w-full grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1">
        <TabsTrigger value="discover" className="rounded-full">Discover</TabsTrigger>
        <TabsTrigger value="my-circles" className="rounded-full">My Circles ({myCircles.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="discover" className="mt-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{discoverCircles.map(renderCircleCard)}</div>
      </TabsContent>

      <TabsContent value="my-circles" className="mt-6">
        {myCircles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{myCircles.map(renderCircleCard)}</div>
        ) : (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-4 h-16 w-16 text-slate-500" />
            <h3 className="mb-2 text-lg font-semibold text-slate-300">No circles joined yet</h3>
            <p className="mb-4 text-slate-500">Discover and join circles to connect with like-minded creators.</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

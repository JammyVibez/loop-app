"use client"

import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { CirclePulse } from "@/components/circles/circle-pulse"
import { CreateCircleButton } from "@/components/circles/create-circle-button"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Users,
  Lock,
  Globe,
  Search,
  Zap,
  CheckCircle2,
  Crown,
  TrendingUp,
  Share2,
  Copy,
  Check,
  Flame,
  MessageSquare,
  Compass,
  Plus,
  ArrowUpDown,
  Tag,
  ShieldCheck,
  MessageCirclePlus,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"

const CATEGORIES = [
  { id: "all", label: "All Communities", icon: Compass },
  { id: "Tech & AI", label: "Tech & AI", icon: Zap },
  { id: "Gaming", label: "Gaming", icon: Flame },
  { id: "Creative & Art", label: "Creative & Art", icon: Tag },
  { id: "Music & Audio", label: "Music & Audio", icon: TrendingUp },
  { id: "Business & Startup", label: "Business", icon: ShieldCheck },
  { id: "General", label: "General & Lifestyle", icon: Users },
]

export function CirclesList() {
  const [circles, setCircles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [sortBy, setSortBy] = useState<"members" | "trending" | "recent">("trending")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab") === "my-circles" ? "my-circles" : "discover"
  const [activeTab, setActiveTab] = useState<string>(initialTab)

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
      toast({ title: data.status === "pending" ? "Request Sent 📨" : "Joined Circle! 🎉", description: data.message })
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
      setCircles((prev) =>
        prev.map((item) =>
          item.id === circleId
            ? { ...item, is_member: false, membership_status: null, member_count: Math.max(0, item.member_count - 1) }
            : item,
        ),
      )
      toast({ title: "Left Circle", description: data.message || "You've left the circle successfully." })
    } catch (error: any) {
      toast({ title: "Error", description: error?.message || "Failed to leave circle.", variant: "destructive" })
    }
  }

  const handleCopyShareLink = (circle: any, e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `${window.location.origin}/circles/${circle.id}`
    navigator.clipboard.writeText(url)
    setCopiedId(circle.id)
    toast({
      title: "Community Link Copied! 🔗",
      description: `Share link for "${circle.name}" copied to clipboard.`,
    })
    setTimeout(() => setCopiedId(null), 2500)
  }

  const formatMemberCount = (count: number) => (count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString())

  // Filter & Sort Logic
  const processedCircles = useMemo(() => {
    let result = [...circles]

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q) ||
          c.owner?.username?.toLowerCase().includes(q),
      )
    }

    // Category filter
    if (selectedCategory !== "all") {
      result = result.filter((c) => c.category?.toLowerCase().includes(selectedCategory.toLowerCase()))
    }

    // Sort order
    if (sortBy === "members") {
      result.sort((a, b) => (b.member_count || 0) - (a.member_count || 0))
    } else if (sortBy === "recent") {
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    } else {
      // Trending: real post activity weighted higher than raw member count,
      // so a small, active circle can outrank a large, quiet one. (This
      // previously multiplied member_count by 1.5 on both sides of the
      // comparison, which is a no-op — it was identical to sorting by
      // members alone despite the comment claiming otherwise.)
      const score = (c: any) => (Number(c.post_count) || 0) * 3 + (Number(c.member_count) || 0)
      result.sort((a, b) => score(b) - score(a))
    }

    return result
  }, [circles, searchQuery, selectedCategory, sortBy])

  const myCircles = useMemo(
    () => processedCircles.filter((circle) => circle.is_member || circle.membership_status === "pending"),
    [processedCircles],
  )
  const discoverCircles = useMemo(
    () => processedCircles.filter((circle) => !circle.is_member && circle.membership_status !== "pending"),
    [processedCircles],
  )

  const renderCircleCard = (circle: any) => {
    const isOwnerVerified = Boolean(circle.owner?.is_verified)
    const isOwnerPro = Boolean(circle.owner?.is_premium)

    return (
      <Card
        key={circle.id}
        className="group relative overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-2xl hover:shadow-cyan-950/40"
      >
        {/* Banner with 3D gradient overlay */}
        <div
          className="relative h-36 bg-slate-800 transition-all duration-500 group-hover:scale-105"
          style={{
            backgroundImage: circle.banner_url ? `url(${circle.banner_url})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />

          {/* Top Badges */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
            <Badge className="bg-slate-950/80 backdrop-blur-md text-xs font-bold text-cyan-300 border border-cyan-500/30">
              {circle.category || "Community"}
            </Badge>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                onClick={(e) => handleCopyShareLink(circle, e)}
                className="h-8 w-8 rounded-full bg-slate-950/80 text-slate-300 hover:text-white backdrop-blur-md border border-white/10"
              >
                {copiedId === circle.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
              </Button>

              {circle.is_private ? (
                <Badge className="bg-amber-950/90 text-amber-300 border border-amber-500/40 backdrop-blur-md">
                  <Lock className="mr-1 h-3 w-3 text-amber-400" /> Private
                </Badge>
              ) : (
                <Badge className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 backdrop-blur-md">
                  <Globe className="mr-1 h-3 w-3 text-emerald-400" /> Public
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Card Content Header */}
        <CardContent className="relative pb-5 pt-0 px-5 space-y-4">
          <div className="-mt-10 flex items-end justify-between">
            <div className="relative">
              <Avatar className="h-20 w-20 border-4 border-card shadow-2xl ring-2 ring-cyan-500/40">
                <AvatarImage src={circle.avatar_url || circle.owner?.avatar_url || "/placeholder.svg"} alt={circle.name} />
                <AvatarFallback className="bg-slate-700 font-bold text-xl text-white">
                  {circle.name?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>

              {/* Founder Verified / Pro Badge */}
              {isOwnerVerified && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 text-white p-1 shadow-lg ring-2 ring-card">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              )}
              {isOwnerPro && !isOwnerVerified && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-amber-500 text-black p-1 shadow-lg ring-2 ring-card">
                  <Crown className="h-3.5 w-3.5" />
                </div>
              )}
            </div>

            {/* Member count indicator */}
            <div className="flex items-center gap-1.5 rounded-full bg-muted border border-border px-3 py-1 text-xs font-bold text-muted-foreground shadow-inner">
              <Users className="h-3.5 w-3.5 text-cyan-400" />
              <span>{formatMemberCount(circle.member_count || 0)} Members</span>
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-foreground group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors line-clamp-1">
                {circle.name}
              </h3>
              {circle.membership_status === "pending" && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">Pending</Badge>
              )}
            </div>

            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {circle.description || "A vibrant community for creators to connect, collaborate, and share loops."}
            </p>
          </div>

          {/* Owner Info & Activity Pill */}
          <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-muted-foreground">Created by</span>
              <span className="font-bold text-foreground truncate">@{circle.owner?.username || "creator"}</span>
              {isOwnerVerified && <CheckCircle2 className="h-3 w-3 text-blue-400 shrink-0" />}
              {isOwnerPro && <Crown className="h-3 w-3 text-amber-400 shrink-0" />}
            </div>

            <div className="flex items-center gap-1 text-[11px] text-cyan-400 font-semibold shrink-0">
              <MessageSquare className="h-3 w-3" />
              <span>Active Stage</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-1 flex gap-2">
            {circle.is_member ? (
              <>
                <Link href={`/circles/${circle.id}`} className="flex-1">
                  <Button className="w-full rounded-2xl bg-primary font-bold text-primary-foreground text-xs h-10 shadow-sm hover:scale-[1.02] transition-transform">
                    Enter Circle Studio
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => handleLeaveCircle(circle.id)}
                  className="rounded-2xl border-rose-500/40 bg-rose-950/20 text-rose-300 hover:bg-rose-500/20 text-xs h-10 px-3"
                >
                  Leave
                </Button>
              </>
            ) : circle.membership_status === "pending" ? (
              <Link href={`/circles/${circle.id}`} className="w-full">
                <Button className="w-full rounded-2xl border border-amber-500/40 bg-amber-950/30 text-amber-200 hover:bg-amber-500/20 text-xs font-bold h-10">
                  View Pending Request
                </Button>
              </Link>
            ) : (
              <Button
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-extrabold text-black hover:from-cyan-400 hover:to-indigo-500 text-xs h-10 shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-transform"
                onClick={() => handleJoinCircle(circle)}
              >
                {circle.is_private ? "Request Membership" : "Join Community"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Circle Pulse — live activity in the user's circles */}
      <CirclePulse />

      {/* Search Bar & Sorting Controls Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 rounded-3xl border border-border bg-card/90 p-3 sm:p-4 backdrop-blur-2xl shadow-xl">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communities, topics, creators..."
            className="pl-10 rounded-2xl border-border bg-muted text-xs text-foreground placeholder:text-muted-foreground h-10 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0">
            <ArrowUpDown className="h-3.5 w-3.5 text-cyan-400" /> Sort:
          </span>
          <Button
            size="sm"
            variant={sortBy === "trending" ? "default" : "outline"}
            onClick={() => setSortBy("trending")}
            className={`rounded-xl text-xs font-bold h-8 px-3 ${
              sortBy === "trending"
                ? "bg-cyan-500 text-black hover:bg-cyan-400"
                : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            Trending 🔥
          </Button>
          <Button
            size="sm"
            variant={sortBy === "members" ? "default" : "outline"}
            onClick={() => setSortBy("members")}
            className={`rounded-xl text-xs font-bold h-8 px-3 ${
              sortBy === "members"
                ? "bg-cyan-500 text-black hover:bg-cyan-400"
                : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            Most Popular 👥
          </Button>
          <Button
            size="sm"
            variant={sortBy === "recent" ? "default" : "outline"}
            onClick={() => setSortBy("recent")}
            className={`rounded-xl text-xs font-bold h-8 px-3 ${
              sortBy === "recent"
                ? "bg-cyan-500 text-black hover:bg-cyan-400"
                : "border-border bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            Recently Added ✨
          </Button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-2xl px-4 py-2 text-xs font-bold transition-all shadow-md ${
                isActive
                  ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-black shadow-cyan-500/20 scale-105"
                  : "border border-cyan-500/50 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-black" : "text-cyan-400"}`} />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Main Community Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-2xl border border-border bg-card/90 p-1.5 backdrop-blur-xl">
          <TabsTrigger
            value="discover"
            className="rounded-xl text-xs font-extrabold data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-indigo-600 data-[state=active]:text-black"
          >
            Discover Communities ({discoverCircles.length})
          </TabsTrigger>
          <TabsTrigger
            value="my-circles"
            className="rounded-xl text-xs font-extrabold data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500 data-[state=active]:to-indigo-600 data-[state=active]:text-black"
          >
            My Communities ({myCircles.length})
          </TabsTrigger>
        </TabsList>

        {/* Discover Tab */}
        <TabsContent value="discover" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="h-80 animate-pulse rounded-3xl border border-border bg-muted/50" />
              ))}
            </div>
          ) : discoverCircles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{discoverCircles.map(renderCircleCard)}</div>
          ) : (
            <div className="py-16 text-center rounded-3xl border border-border bg-muted/60 p-8 space-y-4">
              <Compass className="mx-auto h-12 w-12 text-cyan-400 opacity-60" />
              <h3 className="text-lg font-extrabold text-foreground">No circles match that search… yet</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Try a different keyword or category — or be the one who starts the conversation and create your own community.
              </p>
              <CreateCircleButton />
            </div>
          )}
        </TabsContent>

        {/* My Circles Tab */}
        <TabsContent value="my-circles" className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="h-80 animate-pulse rounded-3xl border border-border bg-muted/50" />
              ))}
            </div>
          ) : myCircles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{myCircles.map(renderCircleCard)}</div>
          ) : (
            <div className="py-16 text-center rounded-3xl border border-border bg-muted/60 p-8 space-y-4">
              <Users className="mx-auto h-12 w-12 text-cyan-400 opacity-60" />
              <h3 className="text-lg font-extrabold text-foreground">Your circles are quiet… for now</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Find your people first — explore the Discover tab and join circles around your interests, then the pulse here will show you everything that's happening.
              </p>
              <Button
                onClick={() => {
                  setSelectedCategory("all")
                  setActiveTab("discover")
                }}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-black"
              >
                <MessageCirclePlus className="mr-1.5 h-4 w-4" />
                Find communities
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

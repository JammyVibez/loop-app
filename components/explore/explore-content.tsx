"use client"

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, TreePine, Sparkles, TrendingUp, Hash } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { LoopTreeViewer } from "@/components/loop-tree-viewer"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function ExploreContent() {
  const [loops, setLoops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState("recent")

  useEffect(() => {
    const fetchLoops = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("loops")
        .select("*, user:profiles!inner(*)")
        .order("created_at", { ascending: false })
        .limit(20)
      if (!error && data) {
        setLoops(data)
      }
      setLoading(false)
    }
    fetchLoops()

    // Real-time subscription
    const subscription = supabase
      .channel('public:loops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loops' }, (payload) => {
        fetchLoops()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="space-y-6">
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <TabsTrigger
            value="recent"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <Clock className="w-4 h-4" />
            <span className="hidden sm:inline">Recent</span>
          </TabsTrigger>
          <TabsTrigger
            value="deepest"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <TreePine className="w-4 h-4" />
            <span className="hidden sm:inline">Deepest</span>
          </TabsTrigger>
          <TabsTrigger
            value="creative"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Creative</span>
          </TabsTrigger>
          <TabsTrigger
            value="hashtags"
            className="flex items-center space-x-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
          >
            <Hash className="w-4 h-4" />
            <span className="hidden sm:inline">Hashtags</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Recent Loops</h2>
              <Badge variant="secondary">Newest first</Badge>
            </div>
            {loops.length === 0 && <div>No loops found.</div>}
            {loops.map((loop) => (
              <LoopCard
                key={loop.id}
                loop={{
                  id: loop.id,
                  user: loop.user || loop.author || {},
                  content: loop.content || "",
                  media_url: loop.media_url || "",
                  media_type: loop.media_type || "text",
                  likes: loop.likes || 0,
                  comments: loop.comments || 0,
                  branches: loop.branches || 0,
                  created_at: loop.created_at,
                  hashtags: loop.hashtags || [],
                  is_liked: false,
                  is_bookmarked: false,
                  parent_loop_id: loop.parent_loop_id,
                }}
                onLike={() => {}}
                onBookmark={() => {}}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="deepest" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <TreePine className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-semibold">Deepest Trees</h2>
              <Badge variant="secondary">Most branches</Badge>
            </div>
            {loops.length === 0 && <div>No loops found.</div>}
            {loops.map((tree) => (
              <div key={tree.id} className="space-y-4">
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <TreePine className="w-5 h-5 text-green-600" />
                        <span className="font-semibold">Tree Depth: {tree.tree_depth} levels</span>
                      </div>
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                        {tree.total_branches} branches
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
                <LoopCard loop={tree} />
                {tree.branches.length > 0 && <LoopTreeViewer rootLoop={tree} />}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="creative" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-yellow-600" />
              <h2 className="text-xl font-semibold">Most Creative</h2>
              <Badge variant="secondary">Highest engagement</Badge>
            </div>
            {loops.length === 0 && <div>No loops found.</div>}
            {loops.map((loop) => (
              <div key={loop.id} className="space-y-4">
                <Card className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-5 h-5 text-yellow-600" />
                        <span className="font-semibold">Creativity Score: {loop.creativity_score}%</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {loop.unique_tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <LoopCard loop={loop} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="hashtags" className="mt-6">
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Hash className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-semibold">Trending Hashtags</h2>
              <Badge variant="secondary">24h growth</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loops.length === 0 && <div>No loops found.</div>}
              {loops.map((hashtag, index) => (
                <Card key={hashtag.tag} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                        <Hash className="w-5 h-5 text-purple-600" />
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      >
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {hashtag.growth}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400">#{hashtag.tag}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{formatNumber(hashtag.count)} loops</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

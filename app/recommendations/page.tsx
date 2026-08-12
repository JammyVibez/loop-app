"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Sparkles, Sliders, RefreshCw, Zap, Cpu, Flame, Compass, BrainCircuit, Check } from "lucide-react"
import { LoopCard } from "@/components/loop-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { useAuth } from "@/hooks/use-auth"
import { LeftSidebar, MobileSidebarSheet } from "@/components/left-sidebar"
import { Header } from "@/components/header"

export default function RecommendationsPage() {
  const { user } = useAuth()
  const [loops, setLoops] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recencyWeight, setRecencyWeight] = useState(1.0)
  const [diversityWeight, setDiversityWeight] = useState(0.8)
  const [mlMetadata, setMlMetadata] = useState<any>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fetchRecommendations = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const headers: HeadersInit = {}
      if (user?.access_token) {
        headers.Authorization = `Bearer ${user.access_token}`
      }

      const res = await fetch(
        `/api/ml/recommendations?recencyWeight=${recencyWeight}&diversityWeight=${diversityWeight}`,
        { headers }
      )
      const data = await res.json()

      if (data.success && Array.isArray(data.loops)) {
        setLoops(data.loops)
        setMlMetadata(data.ml_metadata || null)
      }
    } catch (err) {
      console.error("Failed to load ML recommendations:", err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchRecommendations()
  }, [user, recencyWeight, diversityWeight])

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <div className="flex flex-1">
        <LeftSidebar />
        <MobileSidebarSheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

        <main className="flex-1 max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Header & ML Engine Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-r from-violet-950/80 via-slate-900 to-indigo-950/80 border border-violet-500/30 p-5 shadow-xl backdrop-blur-md relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <BrainCircuit className="h-48 w-48 text-violet-400" />
            </div>

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-300">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                      For You ML Feed
                      <Badge className="bg-gradient-to-r from-violet-500 to-cyan-500 text-white font-mono text-[10px] px-2">
                        DATABASE ML
                      </Badge>
                    </h1>
                    <p className="text-xs text-slate-300">
                      Real-time database machine learning recommendation model adapted to your interest graph.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={() => fetchRecommendations(true)}
                  disabled={refreshing || loading}
                  size="sm"
                  className="rounded-xl bg-violet-600 hover:bg-violet-500 text-white gap-2 text-xs font-bold shadow-md"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  {refreshing ? "Re-Learning..." : "Tune ML Engine"}
                </Button>
              </div>

              {/* User Database Interest Signals */}
              {mlMetadata?.user_top_interests?.length > 0 && (
                <div className="pt-2 border-t border-violet-500/20 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-violet-300 flex items-center gap-1">
                    <Cpu className="h-3 w-3" /> Learned Interests:
                  </span>
                  {mlMetadata.user_top_interests.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-200 text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Interactive Tuning Sliders */}
          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-primary" />
                Algorithm Hyperparameter Weights
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono">
                Updates database vector rank live
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Recency vs Evergreen Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Recency Weight</span>
                  <span className="font-mono text-primary font-bold">{recencyWeight.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[recencyWeight]}
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  onValueChange={([val]) => setRecencyWeight(val)}
                  className="cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">
                  Higher = prioritize brand new posts. Lower = prioritize top-rated history.
                </p>
              </div>

              {/* Diversity vs Precision Weight */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span>Discovery Diversity Factor</span>
                  <span className="font-mono text-cyan-400 font-bold">{diversityWeight.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[diversityWeight]}
                  min={0.1}
                  max={2.0}
                  step={0.1}
                  onValueChange={([val]) => setDiversityWeight(val)}
                  className="cursor-pointer"
                />
                <p className="text-[10px] text-muted-foreground">
                  Higher = injects unexpected creative loops to expand your database graph.
                </p>
              </div>
            </div>
          </div>

          {/* Recommendations Feed List */}
          <div className="space-y-4">
            {loading ? (
              <div className="py-16 text-center space-y-3">
                <BrainCircuit className="h-10 w-10 text-violet-500 animate-spin mx-auto opacity-70" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Evaluating database vectors & scoring candidate loops...
                </p>
              </div>
            ) : loops.length === 0 ? (
              <div className="py-16 text-center rounded-2xl border border-dashed border-border p-8 space-y-3">
                <Compass className="h-10 w-10 text-muted-foreground mx-auto" />
                <p className="text-sm font-bold">No recommendations generated yet</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Post new loops or engage with posts to train your personalized database ML recommendation vector!
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {loops.map((loop) => (
                  <motion.div
                    key={loop.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-1.5"
                  >
                    {/* ML Explanation Pill */}
                    <div className="flex items-center justify-between px-2 text-xs">
                      <span className="font-semibold text-violet-400 flex items-center gap-1.5 text-[11px]">
                        <Zap className="h-3 w-3 text-amber-400" />
                        {loop.recommendation_reason}
                      </span>
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold">
                        {loop.match_percentage}% Match
                      </Badge>
                    </div>

                    <LoopCard loop={loop} />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

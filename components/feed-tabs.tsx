"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Home, Users, Clock, Flame, LayoutList, LayoutGrid, FileText, Hash, Search, Compass, Bot, Code2 } from "lucide-react"
import { LoopFeed } from "./loop-feed"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

const allTabs = [
  { value: "personalized", label: "For You", icon: Home, hint: "Smart mix of tech trends, code loops, and creator updates", guest: false },
  { value: "following", label: "Following", icon: Users, hint: "Real-time updates from developers you follow", guest: false },
  { value: "trending", label: "Trending", icon: Flame, hint: "Viral code loops & hot discussions catching fire", guest: true },
  { value: "recent", label: "Recent", icon: Clock, hint: "Newest public developer loops & snippets", guest: true },
] as const

const TOPIC_CHIPS = [
  { id: "all", label: "All Topics", icon: Compass },
  { id: "tech", label: "#Tech", icon: Code2 },
  { id: "ai", label: "#AI & LLM", icon: Bot },
  { id: "nextjs", label: "#NextJS", icon: Hash },
  { id: "design", label: "#UI & 3D", icon: Hash },
  { id: "showcase", label: "#Showcase", icon: Hash },
  { id: "devlogs", label: "#DevLogs", icon: Hash },
]

type FeedTabsProps = {
  guestMode?: boolean
}

export function FeedTabs({ guestMode = false }: FeedTabsProps) {
  const tabs = guestMode ? allTabs.filter((t) => t.guest) : [...allTabs]
  const [activeTab, setActiveTab] = useState(guestMode ? "trending" : "personalized")
  const [activeTopic, setActiveTopic] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"stream" | "cards" | "articles">("stream")

  const active = tabs.find((tab) => tab.value === activeTab) || tabs[0]

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
      <div className="sticky top-14 z-30 -mx-2 space-y-3 rounded-2xl border border-border/70 bg-background/95 p-3 shadow-sm backdrop-blur-xl sm:top-16 sm:mx-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList
            className={cn(
              "grid h-auto w-full gap-1 rounded-xl border border-border/60 bg-muted/40 p-1 sm:w-auto",
              guestMode ? "grid-cols-2" : "grid-cols-4"
            )}
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-lg px-1.5 py-1.5 text-[11px] sm:px-3 sm:py-2 sm:text-xs font-semibold text-muted-foreground transition-all data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md truncate"
              >
                <tab.icon className="mr-1 h-3.5 w-3.5 shrink-0 hidden sm:inline-block" />
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* View Mode Toggle: Stream (X-style), Cards, Articles (Dev.to-style) */}
          <div className="flex items-center justify-between sm:justify-end gap-2">
            <div className="relative w-full sm:w-44">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filter feed..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-full border-border/70 bg-muted/30 focus-visible:ring-sky-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-1 shrink-0">
              <button
                type="button"
                title="Stream View (Twitter/X style)"
                onClick={() => setViewMode("stream")}
                className={cn(
                  "p-1.5 rounded-full transition text-xs flex items-center gap-1 px-2",
                  viewMode === "stream" ? "bg-sky-600 text-white font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Stream</span>
              </button>
              <button
                type="button"
                title="Card Grid View"
                onClick={() => setViewMode("cards")}
                className={cn(
                  "p-1.5 rounded-full transition text-xs flex items-center gap-1 px-2",
                  viewMode === "cards" ? "bg-sky-600 text-white font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Cards</span>
              </button>
              <button
                type="button"
                title="Dev.to Tech Article View"
                onClick={() => setViewMode("articles")}
                className={cn(
                  "p-1.5 rounded-full transition text-xs flex items-center gap-1 px-2",
                  viewMode === "articles" ? "bg-sky-600 text-white font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Articles</span>
              </button>
            </div>
          </div>
        </div>

        {/* Topic Filter Chips with Horizontal Scroll & Fade Edges */}
        <div className="relative group">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10" />
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-none scroll-smooth">
            {TOPIC_CHIPS.map((chip) => {
              const Icon = chip.icon
              const isSelected = activeTopic === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveTopic(chip.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition border whitespace-nowrap",
                    isSelected
                      ? "bg-sky-500/15 text-sky-400 border-sky-500/40 shadow-sm"
                      : "bg-muted/30 text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-3 w-3", isSelected ? "text-sky-400" : "text-muted-foreground")} />
                  <span>{chip.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-1 pt-0.5 border-t border-border/40">
          <p>{active.hint}</p>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Loop Stream
            </span>
          </div>
        </div>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
          <LoopFeed
            feedType={tab.value as any}
            guestMode={guestMode}
            topicFilter={activeTopic}
            searchQuery={searchQuery}
            viewMode={viewMode}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}


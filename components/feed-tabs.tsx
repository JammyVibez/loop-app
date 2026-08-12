"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Home,
  Users,
  Clock,
  Flame,
  LayoutList,
  LayoutGrid,
  FileText,
  Hash,
  Search,
  Compass,
  Bot,
  Code2,
  SlidersHorizontal,
} from "lucide-react"
import { LoopFeed } from "./loop-feed"
import { TrendingBoostShelf } from "@/components/boosts/trending-boost-shelf"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const allTabs = [
  { value: "personalized", label: "For You", icon: Home, hint: "Smart mix for you", guest: false },
  { value: "following", label: "Following", icon: Users, hint: "People you follow", guest: false },
  { value: "trending", label: "Trending", icon: Flame, hint: "What's catching fire", guest: true },
  { value: "recent", label: "Recent", icon: Clock, hint: "Newest public loops", guest: true },
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

const VIEW_MODES = [
  { id: "stream" as const, label: "Stream", icon: LayoutList },
  { id: "cards" as const, label: "Cards", icon: LayoutGrid },
  { id: "articles" as const, label: "Articles", icon: FileText },
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
  const [filtersOpen, setFiltersOpen] = useState(false)

  const active = tabs.find((tab) => tab.value === activeTab) || tabs[0]
  const activeTopicLabel = TOPIC_CHIPS.find((t) => t.id === activeTopic)?.label || "All Topics"
  const hasSecondaryFilters = activeTopic !== "all" || searchQuery.trim().length > 0 || viewMode !== "stream"

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-3">
      {/* Non-sticky compact toolbar — scrolls with the feed */}
      <div className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <TabsList
            className={cn(
              "grid h-auto min-w-0 flex-1 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1",
              guestMode ? "grid-cols-2" : "grid-cols-4",
            )}
          >
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-lg px-1 py-1.5 text-[11px] font-semibold text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:px-2.5 sm:text-xs truncate"
              >
                <tab.icon className="mr-1 hidden h-3.5 w-3.5 shrink-0 sm:inline-block" />
                <span className="truncate">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <DropdownMenu open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 shrink-0 gap-1.5 rounded-full px-3",
                  hasSecondaryFilters && "border-primary/40 bg-primary/10 text-primary",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 border-border bg-popover text-foreground">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Search</DropdownMenuLabel>
              <div className="px-2 pb-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Filter feed…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 rounded-full border-border bg-background pl-8 text-xs"
                  />
                </div>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">View</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
                {VIEW_MODES.map((mode) => (
                  <DropdownMenuRadioItem key={mode.id} value={mode.id} className="gap-2 text-sm">
                    <mode.icon className="h-3.5 w-3.5" />
                    {mode.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Topic</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={activeTopic} onValueChange={setActiveTopic}>
                {TOPIC_CHIPS.map((chip) => (
                  <DropdownMenuRadioItem key={chip.id} value={chip.id} className="gap-2 text-sm">
                    <chip.icon className="h-3.5 w-3.5" />
                    {chip.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
          <p className="truncate">{active.hint}</p>
          {hasSecondaryFilters ? (
            <button
              type="button"
              className="shrink-0 font-medium text-primary hover:underline"
              onClick={() => {
                setActiveTopic("all")
                setSearchQuery("")
                setViewMode("stream")
              }}
            >
              Clear · {activeTopicLabel}
              {viewMode !== "stream" ? ` · ${viewMode}` : ""}
            </button>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
          <TrendingBoostShelf limit={6} />
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

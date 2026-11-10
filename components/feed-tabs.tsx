"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Home,
  Users,
  LayoutList,
  LayoutGrid,
  FileText,
  Hash,
  Search,
  Compass,
  Bot,
  Code2,
  SlidersHorizontal,
  Eye,
} from "lucide-react"
import { LoopFeed } from "./loop-feed"
import { TrendingBoostShelf } from "@/components/boosts/trending-boost-shelf"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

const FEED_TABS = [
  { value: "personalized", label: "For You", icon: Home, hint: "A ranked blend of people, trends and fresh finds" },
  { value: "following", label: "Following", icon: Users, hint: "Only people you follow · newest first" },
] as const

const TAB_STORAGE_KEY = "loop:feed:tab"
const SENSITIVE_STORAGE_KEY = "loop:feed:show-sensitive"

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
  const [activeTab, setActiveTab] = useState<"personalized" | "following">("personalized")
  const [activeTopic, setActiveTopic] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"stream" | "cards" | "articles">("stream")
  const [showSensitive, setShowSensitive] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // Restore the last tab, and normalize legacy ?tab=trending / ?tab=recent
  // links to For You without a reload.
  useEffect(() => {
    let next: "personalized" | "following" = "personalized"
    try {
      const params = new URLSearchParams(window.location.search)
      const requested = params.get("tab")
      const saved = window.localStorage.getItem(TAB_STORAGE_KEY)

      if (requested === "trending" || requested === "recent") {
        next = "personalized"
        params.set("tab", "for-you")
        window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`)
        window.localStorage.setItem(TAB_STORAGE_KEY, "personalized")
      } else if (requested === "following") {
        next = "following"
      } else if (requested === "personalized" || requested === "for-you" || requested === "for_you") {
        next = "personalized"
      } else if (saved === "following") {
        next = "following"
      }
      setActiveTab(next)
    } catch {
      setActiveTab("personalized")
    }

    try {
      setShowSensitive(window.localStorage.getItem(SENSITIVE_STORAGE_KEY) === "true")
    } catch {
      setShowSensitive(false)
    }
  }, [])

  const changeTab = (value: string) => {
    const next = value === "following" ? "following" : "personalized"
    setActiveTab(next)
    try {
      window.localStorage.setItem(TAB_STORAGE_KEY, next)
      const url = new URL(window.location.href)
      if (next === "following") url.searchParams.set("tab", "following")
      else url.searchParams.set("tab", "for-you")
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`)
    } catch {
      /* persistence is a progressive enhancement */
    }
  }

  const changeSensitive = (checked: boolean) => {
    setShowSensitive(checked)
    try {
      window.localStorage.setItem(SENSITIVE_STORAGE_KEY, String(checked))
    } catch {
      /* ignore */
    }
  }

  const active = FEED_TABS.find((tab) => tab.value === activeTab) || FEED_TABS[0]
  const activeTopicLabel = TOPIC_CHIPS.find((t) => t.id === activeTopic)?.label || "All Topics"
  const hasSecondaryFilters =
    activeTopic !== "all" || searchQuery.trim().length > 0 || viewMode !== "stream" || showSensitive

  return (
    <Tabs value={activeTab} onValueChange={changeTab} className="w-full space-y-3">
      {/* Non-sticky compact toolbar — scrolls with the feed */}
      <div data-tour="feed-tools" className="space-y-2 rounded-2xl border border-border/70 bg-card/60 p-2.5 sm:p-3">
        <div className="flex items-center gap-2">
          <TabsList className="grid h-auto min-w-0 flex-1 grid-cols-2 gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
            {FEED_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-lg px-1 py-1.5 text-[11px] font-semibold text-muted-foreground transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm sm:px-2.5 sm:text-xs"
              >
                <tab.icon className="mr-1 hidden h-3.5 w-3.5 shrink-0 sm:inline-block" />
                <span>{tab.label}</span>
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

              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={showSensitive}
                onCheckedChange={(checked) => changeSensitive(Boolean(checked))}
                className="gap-2 text-sm"
              >
                <Eye className="h-3.5 w-3.5" />
                Sensitive posts
              </DropdownMenuCheckboxItem>
              <p className="px-2 pb-2 text-[10px] leading-4 text-muted-foreground">
                NSFW and mature posts stay hidden unless you opt in.
              </p>
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
                changeSensitive(false)
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

      {FEED_TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
          <TrendingBoostShelf limit={6} />
          <LoopFeed
            feedType={tab.value}
            guestMode={guestMode}
            topicFilter={activeTopic}
            searchQuery={searchQuery}
            allowSensitive={showSensitive}
            viewMode={viewMode}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}

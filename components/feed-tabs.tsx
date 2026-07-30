"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Home, Users, Clock, Flame } from "lucide-react"
import { LoopFeed } from "./loop-feed"
import { cn } from "@/lib/utils"

const allTabs = [
  { value: "personalized", label: "For You", icon: Home, hint: "Smart mix of interests, following, and discovery", guest: false },
  { value: "following", label: "Following", icon: Users, hint: "Only accounts you follow", guest: false },
  { value: "trending", label: "Trending", icon: Flame, hint: "What’s catching fire right now", guest: true },
  { value: "recent", label: "Recent", icon: Clock, hint: "Newest public loops", guest: true },
] as const

type FeedTabsProps = {
  guestMode?: boolean
}

export function FeedTabs({ guestMode = false }: FeedTabsProps) {
  const tabs = guestMode ? allTabs.filter((t) => t.guest) : [...allTabs]
  const [activeTab, setActiveTab] = useState(guestMode ? "trending" : "personalized")
  const active = tabs.find((tab) => tab.value === activeTab) || tabs[0]

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="sticky top-14 z-30 -mx-2 mb-4 space-y-2 border-b border-border/50 bg-background/90 px-2 pb-3 backdrop-blur-xl sm:top-16 sm:mx-0 sm:px-0">
        <TabsList
          className={cn(
            "grid h-auto w-full gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1",
            guestMode ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4",
          )}
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-xl px-2 py-2.5 text-xs text-muted-foreground data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-md sm:text-sm"
            >
              <tab.icon className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="px-1 text-xs text-muted-foreground">{active.hint}</p>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
          <LoopFeed feedType={tab.value as any} guestMode={guestMode} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

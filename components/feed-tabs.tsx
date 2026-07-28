"use client";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, Users, TrendingUp, Clock, Flame } from "lucide-react";
import { LoopFeed } from "./loop-feed";
import { cn } from "@/lib/utils";

const tabs = [
  { value: "personalized", label: "For You", icon: Home, hint: "You + people you follow" },
  { value: "following", label: "Following", icon: Users, hint: "Only accounts you follow" },
  { value: "trending", label: "Trending", icon: Flame, hint: "Highest engagement right now" },
  { value: "recent", label: "Recent", icon: Clock, hint: "Newest public loops" },
] as const

export function FeedTabs() {
  const [activeTab, setActiveTab] = useState("personalized")
  const active = tabs.find((tab) => tab.value === activeTab) || tabs[0]

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <div className="mb-4 space-y-3">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/50 p-1 sm:grid-cols-4">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "rounded-xl px-2 py-2.5 text-xs text-muted-foreground data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600/90 data-[state=active]:to-cyan-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-600/20 sm:text-sm",
              )}
            >
              <tab.icon className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{tab.label}</span>
              {tab.value === "trending" && (
                <TrendingUp className="ml-1 hidden h-3.5 w-3.5 sm:inline" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <p className="px-1 text-xs text-muted-foreground">{active.hint}</p>
      </div>

      {tabs.map((tab) => (
        <TabsContent key={tab.value} value={tab.value} className="mt-0 focus-visible:outline-none">
          <LoopFeed feedType={tab.value} />
        </TabsContent>
      ))}
    </Tabs>
  )
}

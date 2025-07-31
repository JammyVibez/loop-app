"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { Flame, Users, Clock, TrendingUp } from "lucide-react"

export function FeedTabs() {
  const [activeTab, setActiveTab] = useState("for-you")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4 bg-white dark:bg-gray-800 border">
        <TabsTrigger value="for-you" className="flex items-center space-x-2">
          <Flame className="h-4 w-4" />
          <span className="hidden sm:inline">For You</span>
        </TabsTrigger>
        <TabsTrigger value="following" className="flex items-center space-x-2">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Following</span>
        </TabsTrigger>
        <TabsTrigger value="recent" className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span className="hidden sm:inline">Recent</span>
        </TabsTrigger>
        <TabsTrigger value="trending" className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span className="hidden sm:inline">Trending</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}

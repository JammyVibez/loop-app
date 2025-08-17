"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Home, Users, TrendingUp, Clock } from "lucide-react"
import { LoopFeed } from "./loop-feed"

export function FeedTabs() {
  const [activeTab, setActiveTab] = useState("personalized")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="personalized" className="flex items-center space-x-2">
          <Home className="w-4 h-4" />
          <span>For You</span>
        </TabsTrigger>
        <TabsTrigger value="following" className="flex items-center space-x-2">
          <Users className="w-4 h-4" />
          <span>Following</span>
        </TabsTrigger>
        <TabsTrigger value="trending" className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4" />
          <span>Trending</span>
          <Badge variant="secondary" className="ml-1 text-xs">
            Hot
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="recent" className="flex items-center space-x-2">
          <Clock className="w-4 h-4" />
          <span>Recent</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="personalized" className="mt-6">
        <LoopFeed feedType="personalized" />
      </TabsContent>

      <TabsContent value="following" className="mt-6">
        <LoopFeed feedType="following" />
      </TabsContent>

      <TabsContent value="trending" className="mt-6">
        <LoopFeed feedType="trending" />
      </TabsContent>

      <TabsContent value="recent" className="mt-6">
        <LoopFeed feedType="recent" />
      </TabsContent>
    </Tabs>
  )
}

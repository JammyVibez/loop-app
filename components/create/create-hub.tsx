"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Home, Radio, Video } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateLoopButton } from "@/components/create-loop-button"
import { CreateReelForm } from "@/components/create/create-reel-form"
import { CreateStreamForm } from "@/components/create/create-stream-form"

export type CreateTab = "loop" | "reel" | "live"

export function CreateHub({ defaultTab = "loop" }: { defaultTab?: CreateTab }) {
  const [tab, setTab] = useState<CreateTab>(defaultTab)
  const router = useRouter()

  return (
    <div className="mx-auto max-w-2xl">
      <Tabs value={tab} onValueChange={(v) => setTab(v as CreateTab)}>
        <TabsList className="grid w-full grid-cols-3 rounded-full">
          <TabsTrigger value="loop" className="rounded-full">
            <Home className="mr-1.5 h-4 w-4" /> Loop
          </TabsTrigger>
          <TabsTrigger value="reel" className="rounded-full">
            <Video className="mr-1.5 h-4 w-4" /> Reel
          </TabsTrigger>
          <TabsTrigger value="live" className="rounded-full">
            <Radio className="mr-1.5 h-4 w-4" /> Live
          </TabsTrigger>
        </TabsList>

        <TabsContent value="loop" className="mt-5">
          <CreateLoopButton defaultOpen onLoopCreated={() => router.push("/")} />
        </TabsContent>

        <TabsContent value="reel" className="mt-5">
          <CreateReelForm onReelCreated={(reelId) => router.push(reelId ? `/reels?focus=${reelId}` : "/reels")} />
        </TabsContent>

        <TabsContent value="live" className="mt-5">
          <CreateStreamForm onStreamCreated={(streamId) => router.push(streamId ? `/streams/${streamId}` : "/streams")} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

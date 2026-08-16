"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Home, Radio, Video, Lightbulb, CheckCircle2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateLoopButton } from "@/components/create-loop-button"
import { CreateReelForm } from "@/components/create/create-reel-form"
import { CreateStreamForm } from "@/components/create/create-stream-form"

export type CreateTab = "loop" | "reel" | "live"

const TIPS = [
  {
    title: "Hook in the first line",
    body: "The first 200 characters show in feeds — make them count.",
  },
  {
    title: "Tags help discovery",
    body: "Add 2–4 hashtags so your Loop shows up in Explore and hashtag pages.",
  },
  {
    title: "Collaborate live",
    body: "Start a collab room and co-write with up to 4 people in real time.",
  },
]

const CHECKLIST = [
  "Your draft auto-saves locally",
  "Code loops are forkable by others",
  "Media uploads support images, video, and audio",
  "You can branch any Loop you love",
]

export function CreateHub({ defaultTab = "loop" }: { defaultTab?: CreateTab }) {
  const [tab, setTab] = useState<CreateTab>(defaultTab)
  const router = useRouter()

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
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

      {/* Studio tips sidebar (desktop) */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Lightbulb className="h-4 w-4 text-amber-400" />
              Posting tips
            </p>
            <ul className="mt-3 space-y-3">
              {TIPS.map((tip) => (
                <li key={tip.title}>
                  <p className="text-xs font-semibold text-foreground">{tip.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tip.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/50 p-4">
            <p className="text-sm font-semibold">Good to know</p>
            <ul className="mt-3 space-y-2.5">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}

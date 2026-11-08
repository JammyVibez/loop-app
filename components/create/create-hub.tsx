"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, Lightbulb, PenLine, Radio, Sparkles, Users, Video, Zap } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateLoopButton } from "@/components/create-loop-button"
import { TreeEditor } from "@/components/create/reel-editor"
import { CreateStreamForm } from "@/components/create/create-stream-form"
import { CreateMomentForm } from "@/components/create/create-moment-form"
import { CreateOpenCoLoopForm } from "@/components/create/create-open-coloop-form"
import { cn } from "@/lib/utils"

export type CreateTab = "loop" | "tree" | "live" | "moment" | "coloop"

const TABS: { value: CreateTab; label: string; icon: LucideIcon; hint: string }[] = [
  { value: "loop", label: "Loop", icon: PenLine, hint: "Text, photo, video or code" },
  { value: "tree", label: "Reel", icon: Video, hint: "Vertical video with a cut" },
  { value: "moment", label: "Moment", icon: Zap, hint: "Vanishes in 24–48 hours" },
  { value: "live", label: "Live", icon: Radio, hint: "Open a room and go live" },
  { value: "coloop", label: "Co-Loop", icon: Users, hint: "Build together in real time" },
]

const TIPS = [
  {
    title: "Hook in the first line",
    body: "Only the opening lines show in feeds — make them do the work.",
  },
  {
    title: "Edit media before posting",
    body: "Photos open a crop and colour editor; clips get a trim and mute step.",
  },
  {
    title: "Tags help discovery",
    body: "Add 2–4 hashtags so your post shows up in Explore and on hashtag pages.",
  },
]

const CHECKLIST = [
  "Drafts save locally as you type",
  "Photos, GIFs, video and audio supported",
  "Every upload is previewed before it publishes",
  "Moments disappear on schedule",
]

export function CreateHub({ defaultTab = "loop" }: { defaultTab?: CreateTab }) {
  const [tab, setTab] = useState<CreateTab>(defaultTab)
  const router = useRouter()

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as CreateTab)}>
      <div className="create-hub-grid grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_270px] xl:gap-6">
        {/* Mode rail. A vertical editorial index on desktop, swipeable chips on
            phones — the same five destinations, no truncation. */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20">
            <p className="mb-2 hidden px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground lg:block">
              Choose a format
            </p>
            <TabsList
              className={cn(
                "-mx-3 flex h-auto w-[calc(100%_+_1.5rem)] items-center gap-1 overflow-x-auto rounded-full border border-white/10 bg-card/55 p-1.5 shadow-[0_18px_44px_-34px_rgba(0,0,0,0.8)] backdrop-blur-xl",
                "px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:w-full sm:justify-center sm:px-1.5",
                "lg:flex-col lg:items-stretch lg:justify-start lg:rounded-[22px] lg:p-2",
              )}
            >
              {TABS.map((item) => {
                const Icon = item.icon
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className={cn(
                      "group relative flex min-h-10 min-w-[5.7rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent bg-transparent px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-all",
                      "data-[state=active]:border-violet-300/25 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-400/20 data-[state=active]:to-cyan-300/10 data-[state=active]:text-foreground data-[state=active]:shadow-[0_8px_24px_-16px_rgba(124,92,255,0.9)]",
                      "lg:min-h-[68px] lg:w-full lg:justify-start lg:gap-3 lg:rounded-[16px] lg:border-transparent lg:bg-transparent lg:px-3 lg:py-3 lg:text-left",
                      "lg:data-[state=active]:border-violet-300/15 lg:data-[state=active]:bg-gradient-to-r lg:data-[state=active]:from-violet-400/[0.12] lg:data-[state=active]:to-cyan-300/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors lg:h-9 lg:w-9 lg:rounded-xl lg:border lg:border-border/70 lg:bg-white/[0.025]",
                        "group-data-[state=active]:text-violet-200 lg:group-data-[state=active]:border-violet-300/25 lg:group-data-[state=active]:bg-violet-300/10",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                    </span>
                    <span className="min-w-0 lg:flex lg:flex-col lg:items-start">
                      <span className="truncate lg:text-[13px]">{item.label}</span>
                      <span className="hidden truncate text-[10.5px] font-normal text-muted-foreground lg:block">
                        {item.hint}
                      </span>
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <div className="mt-3 hidden rounded-[18px] border border-emerald-300/15 bg-gradient-to-br from-emerald-300/[0.07] via-white/[0.025] to-transparent p-4 lg:block">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Autosave is on
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                Text and tags are kept on this device until you publish or clear them.
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <TabsContent value="loop" className="mt-0">
            <CreateLoopButton defaultOpen onLoopCreated={() => router.push("/")} />
          </TabsContent>

          <TabsContent value="tree" className="mt-0">
            <TreeEditor onTreeCreated={(treeId) => router.push(treeId ? `/trees?focus=${treeId}` : "/trees")} />
          </TabsContent>

          <TabsContent value="moment" className="mt-0">
            <CreateMomentForm onMomentCreated={() => router.push("/")} />
          </TabsContent>

          <TabsContent value="live" className="mt-0">
            <CreateStreamForm onStreamCreated={(streamId) => router.push(streamId ? `/streams/${streamId}` : "/streams")} />
          </TabsContent>

          <TabsContent value="coloop" className="mt-0">
            <CreateOpenCoLoopForm onCreated={(sessionId) => router.push(`/co-loop/studio?session=${sessionId}`)} />
          </TabsContent>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-20 space-y-3">
            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-card/45 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <div className="flex items-center gap-2 border-b border-white/[0.07] bg-gradient-to-r from-violet-300/[0.09] via-cyan-300/[0.035] to-transparent px-4 py-3.5">
                <Lightbulb className="h-4 w-4 text-amber-300" />
                <p className="text-[12px] font-semibold">Studio notes</p>
              </div>
              <ul className="space-y-3.5 p-4">
                {TIPS.map((tip) => (
                  <li key={tip.title}>
                    <p className="text-[11.5px] font-semibold text-foreground">{tip.title}</p>
                    <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">{tip.body}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-card/45 p-4 shadow-[0_22px_60px_-46px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                Good to know
              </p>
              <ul className="mt-3 space-y-2.5">
                {CHECKLIST.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </Tabs>
  )
}

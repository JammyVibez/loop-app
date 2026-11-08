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
      <div className="grid gap-5 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_286px] xl:gap-6">
        {/* Mode rail. A vertical editorial index on desktop, swipeable chips on
            phones — the same five destinations, no truncation. */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-20">
            <p className="mb-2 hidden px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground lg:block">
              Choose a format
            </p>
            <TabsList
              className={cn(
                "-mx-4 flex h-auto w-[calc(100%_+_2rem)] items-stretch gap-1.5 overflow-x-auto rounded-none border-0 bg-transparent p-0",
                "px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "lg:mx-0 lg:w-full lg:flex-col lg:overflow-visible lg:rounded-2xl lg:border lg:border-border/70 lg:bg-card/60 lg:p-1.5",
              )}
            >
              {TABS.map((item) => {
                const Icon = item.icon
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className={cn(
                      "group relative flex min-w-[6.5rem] shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/70 bg-card/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors",
                      "data-[state=active]:border-amber-300/40 data-[state=active]:bg-amber-300/10 data-[state=active]:text-foreground",
                      "lg:w-full lg:justify-start lg:gap-2.5 lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-2.5 lg:py-2.5 lg:text-left",
                      "lg:data-[state=active]:border-transparent lg:data-[state=active]:bg-white/[0.05]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors lg:h-8 lg:w-8 lg:rounded-lg lg:border lg:border-border/70",
                        "group-data-[state=active]:text-amber-300 lg:group-data-[state=active]:border-amber-300/40 lg:group-data-[state=active]:bg-amber-300/10",
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

            <div className="mt-3 hidden rounded-2xl border border-border/70 bg-gradient-to-b from-white/[0.04] to-transparent p-3.5 lg:block">
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
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
              <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-to-r from-amber-300/[0.09] to-transparent px-4 py-3">
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

            <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
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

"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateLoopButton } from "@/components/create-loop-button"
import { TreeEditor } from "@/components/create/reel-editor"
import { CreateStreamForm } from "@/components/create/create-stream-form"
import { CreateMomentForm } from "@/components/create/create-moment-form"
import { CreateOpenCoLoopForm } from "@/components/create/create-open-coloop-form"
import { cn } from "@/lib/utils"

export type CreateTab = "loop" | "tree" | "live" | "moment" | "coloop"

const TABS: { value: CreateTab; label: string; hint: string }[] = [
  { value: "loop", label: "Loop", hint: "Text, photo, video or code" },
  { value: "tree", label: "Reel", hint: "Vertical video with a cut" },
  { value: "moment", label: "Moment", hint: "Vanishes in 24–48 hours" },
  { value: "live", label: "Live", hint: "Open a room and go live" },
  { value: "coloop", label: "Co-Loop", hint: "Build together in real time" },
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
      <div className="create-hub-grid grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_240px] xl:gap-8">
        {/* Mode rail. A vertical editorial index on desktop, swipeable chips on
            phones — the same five destinations, no truncation. */}
        <div className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
                Format index
              </p>
              <span className="hidden font-mono text-[9px] tracking-[0.08em] text-muted-foreground/45 lg:block">
                01 — 05
              </span>
            </div>
            <TabsList
              className={cn(
                "-mx-4 flex h-auto w-[calc(100%_+_2rem)] items-stretch justify-start gap-6 overflow-x-auto border-b border-border/70 bg-transparent p-0 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "lg:mx-0 lg:w-full lg:flex-col lg:gap-1 lg:overflow-visible lg:border-b-0",
              )}
            >
              {TABS.map((item, index) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className={cn(
                    "group relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-1 text-[12px] font-medium text-muted-foreground shadow-none transition-colors",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none",
                    "lg:min-h-0 lg:w-full lg:items-start lg:gap-3.5 lg:rounded-lg lg:border-b-0 lg:border-l-2 lg:border-l-transparent lg:px-3 lg:pb-3 lg:pl-4 lg:pt-3 lg:text-left",
                    "lg:data-[state=active]:border-primary",
                  )}
                >
                  <span className="font-mono text-[9px] tracking-[0.08em] text-muted-foreground/55 transition-colors group-data-[state=active]:text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="truncate text-[12.5px] font-medium tracking-[-0.01em]">{item.label}</span>
                    <span className="hidden truncate text-[10px] font-normal leading-4 text-muted-foreground/70 lg:block">
                      {item.hint}
                    </span>
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-4 hidden items-start gap-2.5 lg:flex">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.75)]" />
              <p className="text-[10.5px] leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">Autosave is on.</span> Text and tags stay on this
                device until you publish or clear them.
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
          <div className="sticky top-24">
            <p className="border-b border-white/[0.09] pb-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
              Studio notes
            </p>
            <ol>
              {TIPS.map((tip, index) => (
                <li key={tip.title} className="grid grid-cols-[20px_1fr] gap-2.5 border-b border-white/[0.07] py-4">
                  <span className="pt-0.5 font-mono text-[9px] text-lime-300/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-[11px] font-medium text-foreground">{tip.title}</p>
                    <p className="mt-1 text-[10.5px] leading-5 text-muted-foreground">{tip.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/75">
              Good to know
            </p>
            <ul className="mt-3 space-y-2.5">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[10.5px] leading-5 text-muted-foreground">
                  <span className="mt-2 h-px w-3 shrink-0 bg-lime-300/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Tabs>
  )
}

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

export type CreateTab = "loop" | "tree" | "live" | "moment" | "coloop"

const TABS: { value: CreateTab; label: string; icon: LucideIcon }[] = [
  { value: "loop", label: "Loop", icon: PenLine },
  { value: "tree", label: "Reel", icon: Video },
  { value: "moment", label: "Moment", icon: Zap },
  { value: "live", label: "Live", icon: Radio },
  { value: "coloop", label: "Co-Loop", icon: Users },
]

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
    title: "Moment for the fleeting",
    body: "Moments vanish after 24–48 hours — perfect for quick updates and behind-the-scenes.",
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
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_304px] xl:gap-6">
      <div className="min-w-0">
        <Tabs value={tab} onValueChange={(v) => setTab(v as CreateTab)}>
          {/* Scrolls instead of squeezing five destinations into equal columns,
              which used to truncate labels on narrow laptops. */}
          <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="flex h-auto w-full min-w-max items-stretch gap-1 rounded-2xl border border-border/70 bg-muted/50 p-1.5 sm:min-w-0">
              {TABS.map((item) => {
                const Icon = item.icon
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    className="flex min-w-[6.5rem] flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm sm:text-[13px]"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>

          <TabsContent value="loop" className="mt-4">
            <CreateLoopButton defaultOpen onLoopCreated={() => router.push("/")} />
          </TabsContent>

          <TabsContent value="tree" className="mt-4">
            <TreeEditor onTreeCreated={(treeId) => router.push(treeId ? `/trees?focus=${treeId}` : "/trees")} />
          </TabsContent>

          <TabsContent value="moment" className="mt-4">
            <CreateMomentForm onMomentCreated={() => router.push("/")} />
          </TabsContent>

          <TabsContent value="live" className="mt-4">
            <CreateStreamForm onStreamCreated={(streamId) => router.push(streamId ? `/streams/${streamId}` : "/streams")} />
          </TabsContent>

          <TabsContent value="coloop" className="mt-4">
            <CreateOpenCoLoopForm onCreated={(sessionId) => router.push(`/co-loop/studio?session=${sessionId}`)} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Studio tips sidebar (desktop) */}
      <aside className="hidden xl:block">
        <div className="sticky top-24 space-y-4">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
            <div className="flex items-center gap-2 border-b border-border/70 bg-gradient-to-r from-violet-500/10 to-cyan-500/10 px-4 py-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-[13px] font-semibold">Posting tips</p>
            </div>
            <ul className="space-y-3.5 p-4">
              {TIPS.map((tip) => (
                <li key={tip.title}>
                  <p className="text-xs font-semibold text-foreground">{tip.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{tip.body}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/60 p-4">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Good to know
            </p>
            <ul className="mt-3 space-y-2.5">
              {CHECKLIST.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
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

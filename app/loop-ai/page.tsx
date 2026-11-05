import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { LoopAiChat } from "@/components/loop-ai/loop-ai-chat"
import { LoopAiMark } from "@/components/loop-ai/loop-ai-mark"

export const metadata: Metadata = {
  title: "Loop AI",
  description: "Draft, plan and think out loud with the assistant inside LOOP.",
}

export default function LoopAiPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-6xl px-3 pb-8 pt-4 sm:px-5 sm:pt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to the feed
            </Link>
            <h1 className="mt-3 flex items-center gap-2.5 text-2xl font-black tracking-tight sm:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 text-cyan-300 ring-1 ring-cyan-400/25">
                <LoopAiMark className="h-5 w-5" glow />
              </span>
              Loop AI
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Draft with it, argue with it, then post what you actually mean.
            </p>
          </div>
        </div>

        <LoopAiChat />
      </main>
    </div>
  )
}

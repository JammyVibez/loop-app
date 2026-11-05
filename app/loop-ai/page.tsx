import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { LoopAiChat } from "@/components/loop-ai/loop-ai-chat"

export const metadata: Metadata = {
  title: "Loop AI",
  description: "Draft, plan and think out loud with the assistant inside LOOP.",
}

export default function LoopAiPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-3xl px-3 pb-24 pt-5 sm:px-5 sm:pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the feed
        </Link>

        <div className="mb-4 mt-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              Loop <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">AI</span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">Your writing and planning partner inside LOOP.</p>
          </div>
        </div>

        <LoopAiChat />
      </main>
    </div>
  )
}

import type { Metadata } from "next"
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
      <main className="mx-auto w-full max-w-4xl px-0 pb-2 sm:px-4">
        <LoopAiChat />
      </main>
    </div>
  )
}

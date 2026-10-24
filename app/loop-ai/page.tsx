import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Bot, Sparkles } from "lucide-react"
import { Header } from "@/components/header"

export const metadata: Metadata = {
  title: "Loop AI — coming soon",
  description: "The assistant that knows your loops, your worlds and your people. In the works.",
}

/**
 * Loop AI placeholder. It sits in the navigation next to real destinations so
 * the shape of the app is visible, and says plainly that it is not live yet
 * rather than pretending to be a chat box that answers nothing.
 */
export default function LoopAiPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto flex max-w-3xl flex-col items-start px-5 pb-24 pt-10 sm:pt-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the feed
        </Link>

        <div className="mt-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-cyan-400/30">
          <Bot className="h-7 w-7 text-cyan-400" />
        </div>

        <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">Loop AI</h1>
        <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-cyan-400">Coming soon</p>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          An assistant that already knows the room: your loops, the worlds you run, the people who
          answer you. Ask it to draft a thread from a branch, find the conversation you half
          remember, or tell you what your community argued about last week.
        </p>

        <ul className="mt-8 grid w-full gap-3 sm:grid-cols-3">
          {[
            { title: "Ask your library", body: "Loops, branches and quotes, answered with sources." },
            { title: "Draft with context", body: "Threads and replies written in your voice." },
            { title: "Read the room", body: "What your community is talking about, summarised." },
          ].map((card) => (
            <li key={card.title} className="rounded-2xl border border-border bg-card p-4">
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <p className="mt-2 text-sm font-bold">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.body}</p>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}

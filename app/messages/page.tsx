"use client"

import { Suspense } from "react"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { MessagesWorkspace } from "@/components/messages/messages-workspace"

export default function MessagesPage() {
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <Header />
      <main className="container mx-auto max-w-6xl px-3 py-4 sm:px-4">
        <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading messages…</div>}>
          <MessagesWorkspace />
        </Suspense>
      </main>
      <MobileBottomNav />
    </div>
  )
}

"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/header"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { MessagesWorkspace } from "@/components/messages/messages-workspace"

function MessagesShell() {
  const searchParams = useSearchParams()
  const inChat = Boolean(searchParams.get("c"))

  return (
    <div
      className={`fixed inset-0 z-40 flex h-app-dvh flex-col overflow-hidden overscroll-none bg-background text-foreground ${
        inChat ? "pb-0" : "pb-[calc(4.25rem+env(safe-area-inset-bottom))]"
      } lg:static lg:inset-auto lg:pb-0`}
    >
      <div className={inChat ? "hidden" : "hidden lg:block"}>
        <Header />
      </div>
      <main className="chat-workspace mx-auto w-full max-w-6xl min-h-0 flex-1 overflow-hidden px-0 lg:px-4 lg:py-4">
        <MessagesWorkspace />
      </main>
      {!inChat && (
        <div className="lg:hidden">
          <MobileBottomNav />
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="flex h-app-dvh items-center justify-center bg-background text-muted-foreground">Loading messages…</div>}>
      <MessagesShell />
    </Suspense>
  )
}

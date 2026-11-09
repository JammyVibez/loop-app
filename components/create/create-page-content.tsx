"use client"

import { Header } from "@/components/header"
import { CreateHub, type CreateTab } from "@/components/create/create-hub"
import { useAuth } from "@/hooks/use-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Sparkles } from "lucide-react"

export function CreatePageContent({ defaultTab = "loop" }: { defaultTab?: CreateTab }) {
  const { user, loading, authResolved } = useAuth()
  const router = useRouter()

  // Only bounce to sign-in once the session check has actually *concluded*
  // that nobody is signed in. Firing on `!user` alone redirected signed-in
  // users to /login whenever their session lookup was still in flight or had
  // failed transiently — which is exactly what a page refresh used to do.
  useEffect(() => {
    if (!loading && authResolved && !user) {
      // Preserve where they were headed so signing in lands them back here.
      router.replace("/login?redirect=/create")
    }
  }, [user, loading, authResolved, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="bg-background text-foreground">
      <Header />
      <main className="create-studio relative mx-auto w-full max-w-[1480px] px-4 pb-24 pt-3 sm:px-6 sm:pb-16 sm:pt-5 lg:px-10">
        <header className="relative flex flex-col gap-4 border-b border-border/70 pb-5 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Create
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              Make something worth sharing.
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
              Start with a post, a moment, a live room, or an idea to build together.
            </p>
          </div>

            <dl className="grid w-full max-w-sm shrink-0 grid-cols-3 gap-4 border-t border-border/70 pt-3 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Drafts</dt>
                <dd className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-foreground">Autosaved</dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Formats</dt>
                <dd className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-foreground">Five ways in</dd>
              </div>
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">Files</dt>
                <dd className="mt-1 text-[14px] font-medium tracking-[-0.01em] text-primary">
                  {user.is_premium ? "10 max" : user.is_verified ? "4 max" : "1 max"}
                </dd>
              </div>
            </dl>
        </header>

        <div className="relative mt-5 sm:mt-6">
          <CreateHub defaultTab={defaultTab} />
        </div>
      </main>
    </div>
  )
}

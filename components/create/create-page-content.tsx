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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(52rem_22rem_at_18%_-12%,rgba(190,242,100,0.10),transparent_65%),radial-gradient(38rem_20rem_at_86%_0%,rgba(103,232,249,0.06),transparent_68%)]"
        />

        <header className="relative border-b border-white/[0.09] pb-7 pt-2 sm:pb-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
            <div className="max-w-[780px] min-w-0">
              <p className="flex items-center gap-2.5 text-[9.5px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-lime-200 via-lime-300 to-emerald-300 text-[#15200b] shadow-[0_10px_24px_-14px_rgba(190,242,100,0.8)]">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                Loop <span className="text-white/25">/</span> Creator atelier
              </p>

              <h1 className="mt-5 font-serif text-[clamp(2.45rem,5.2vw,4.5rem)] leading-[0.94] tracking-[-0.035em] text-foreground">
                Give the story{" "}
                <em className="bg-gradient-to-r from-lime-200 via-emerald-200 to-cyan-200 bg-clip-text font-normal italic text-transparent">
                  some room.
                </em>
              </h1>

              <p className="mt-4 max-w-[560px] text-[13px] leading-7 text-muted-foreground sm:text-[13.5px]">
                A quieter canvas for ideas worth sharing. Choose a format when it helps, add texture when it matters,
                and let the writing take the lead.
              </p>
            </div>

            <dl className="grid w-full max-w-md shrink-0 grid-cols-3 gap-5 border-t border-white/10 pt-4 sm:border-t-0 sm:border-l sm:pl-7 sm:pt-1">
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
                <dd className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-lime-200">
                  {user.is_premium ? "10 max" : user.is_verified ? "4 max" : "1 max"}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <div className="relative mt-6 sm:mt-8">
          <CreateHub defaultTab={defaultTab} />
        </div>
      </main>
    </div>
  )
}

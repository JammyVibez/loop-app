"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import { createClient } from "@supabase/supabase-js"

type MomentItem = {
  id: string
  type: "loop" | "reel"
  media_url: string
  media_type: string
  href: string
  created_at: string
}

type MomentGroup = {
  user: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    is_verified?: boolean
  }
  items: MomentItem[]
  is_self: boolean
  has_unseen?: boolean
}

export function MomentsStrip() {
  const { user, getAuthHeader } = useAuth()
  const [moments, setMoments] = useState<MomentGroup[]>([])
  const [active, setActive] = useState<MomentGroup | null>(null)
  const [index, setIndex] = useState(0)

  const fetchMoments = async () => {
    try {
      const res = await fetch("/api/loops/moments", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await res.json()
      if (res.ok) setMoments(data.moments || [])
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (!user) return
    fetchMoments()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )

    const channel = supabase
      .channel("realtime_moments_engine")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "loops" },
        () => {
          fetchMoments()
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "moments" },
        () => {
          fetchMoments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  if (!user) return null

  const openMoment = (group: MomentGroup) => {
    if (group.is_self && group.items.length === 0) {
      window.location.href = "/create"
      return
    }
    if (!group.items.length) return
    setActive(group)
    setIndex(0)
  }

  const current = active?.items[index]

  return (
    <>
      <div className="rounded-2xl border border-border/70 bg-card/40 px-3 py-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-sm font-semibold tracking-tight">Moments</p>
          <Link href="/reels" className="text-xs text-sky-500 hover:underline">
            Watch all
          </Link>
        </div>
        <div className="scrollbar-none flex gap-3 overflow-x-auto pb-1">
          {moments.map((group) => {
            const name = group.is_self ? "Your moment" : group.user.username || group.user.display_name || "user"
            const ring = group.is_self
              ? group.items.length
                ? "bg-gradient-to-tr from-sky-400 to-fuchsia-500"
                : "bg-border"
              : group.has_unseen
                ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600"
                : "bg-border"
            return (
              <button
                key={group.user.id}
                type="button"
                onClick={() => openMoment(group)}
                className="flex w-[72px] shrink-0 flex-col items-center gap-1.5"
              >
                <span className={cn("rounded-full p-[2px]", ring)}>
                  <span className="relative block rounded-full bg-background p-[2px]">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={group.user.avatar_url} />
                      <AvatarFallback>{(group.user.display_name || group.user.username || "?").charAt(0)}</AvatarFallback>
                    </Avatar>
                    {group.is_self && group.items.length === 0 && (
                      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-white ring-2 ring-background">
                        <Plus className="h-3 w-3" />
                      </span>
                    )}
                  </span>
                </span>
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{name}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Dialog open={Boolean(active && current)} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-w-md border-0 bg-black p-0 text-white sm:rounded-2xl overflow-hidden">
          {active && current && (
            <div className="relative aspect-[9/16] max-h-[80vh] w-full bg-black">
              <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
                {active.items.map((_, i) => (
                  <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
                    <div className={cn("h-full bg-white transition-all", i <= index ? "w-full" : "w-0")} />
                  </div>
                ))}
              </div>
              <div className="absolute left-3 top-6 z-20 flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={active.user.avatar_url} />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">@{active.user.username}</span>
              </div>
              {current.media_type === "video" ? (
                <video src={current.media_url} className="h-full w-full object-contain" autoPlay controls playsInline />
              ) : (
                <img src={current.media_url} alt="" className="h-full w-full object-contain" />
              )}
              <button
                type="button"
                className="absolute inset-y-0 left-0 w-1/3"
                aria-label="Previous"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 w-1/3"
                aria-label="Next"
                onClick={() => {
                  if (index >= (active.items.length - 1)) setActive(null)
                  else setIndex((i) => i + 1)
                }}
              />
              <Link
                href={current.href}
                className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white/15 px-4 py-1.5 text-xs backdrop-blur hover:bg-white/25"
              >
                Open full post
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

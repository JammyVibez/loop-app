"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/skeletons"
import { ArrowRight, Compass, Plus, Users } from "@/components/icons/lucide-compat"

type Circle = {
  id: string | number
  name: string
  description?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  category?: string | null
  member_count?: number
  user_role?: string
}

export function MyCommunities() {
  const { user, loading: authLoading, getAuthHeader } = useAuth()
  const userId = user?.id
  const [circles, setCircles] = useState<Circle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    if (!userId) {
      setCircles([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/circles?joined=true&limit=100", {
        headers: { ...getAuthHeader() },
        cache: "no-store",
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load your Circles")
      setCircles((data.circles || []).filter((circle: any) => circle.is_member === true || ["active", "approved"].includes(circle.membership_status)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your Circles")
    } finally {
      setLoading(false)
    }
  }, [userId, getAuthHeader])

  useEffect(() => {
    void load()
    const refresh = () => void load()
    window.addEventListener("loop:circles-changed", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener("loop:circles-changed", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [load])

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-500">Your communities</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">My Circles</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pick up where your people are already gathering.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-full"><Link href="/communities/discover"><Compass className="mr-2 h-4 w-4" />Discover Circles</Link></Button>
          <Button asChild className="rounded-full"><Link href="/communities/create"><Plus className="mr-2 h-4 w-4" />Create a Circle</Link></Button>
        </div>
      </div>
      {authLoading || loading ? (
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-border/70 bg-card/50">
          <Spinner className="h-5 w-5 text-muted-foreground" />
        </div>
      ) : !user ? (
        <div className="rounded-2xl border border-border/70 bg-card/50 px-6 py-12 text-center">
          <Users className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-3 font-semibold">Sign in to see your Circles</p>
          <Button asChild className="mt-4 rounded-full"><Link href="/auth?returnTo=%2Fcommunities">Sign in</Link></Button>
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
          {error}<button type="button" onClick={() => void load()} className="ml-2 font-semibold underline">Try again</button>
        </div>
      ) : circles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-14 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500"><Users className="h-6 w-6" /></div>
          <h3 className="mt-4 text-lg font-semibold">Your Circle list starts here</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Join a Circle to build a familiar space for conversations, projects, and shared interests.</p>
          <Button asChild className="mt-5 rounded-full"><Link href="/communities/discover"><Compass className="mr-2 h-4 w-4" />Discover Circles</Link></Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {circles.map((circle) => (
            <Link key={circle.id} href={`/communities/${circle.id}`} className="group overflow-hidden rounded-2xl border border-border/70 bg-card transition hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5">
              <div className="relative h-24 bg-gradient-to-br from-amber-500/20 via-card to-card">
                {circle.banner_url ? <Image src={circle.banner_url} alt="" fill unoptimized className="object-cover opacity-80" /> : null}
                <div className="absolute inset-0 bg-gradient-to-t from-card/90 to-transparent" />
              </div>
              <div className="relative flex items-start gap-3 px-4 pb-4">
                <Avatar className="-mt-7 h-14 w-14 rounded-2xl border-2 border-card shadow-md">
                  <AvatarImage src={circle.avatar_url || undefined} alt={circle.name} />
                  <AvatarFallback className="rounded-2xl bg-amber-500/15 text-lg font-bold text-amber-500">{circle.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 pt-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate font-semibold group-hover:text-amber-500">{circle.name}</h3>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-amber-500" />
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{circle.description || "A place to share and build together."}</p>
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{Number(circle.member_count || 0).toLocaleString()}</span>
                    {circle.category ? <span className="capitalize">{circle.category}</span> : null}
                    {circle.user_role && circle.user_role !== "member" ? <span className="capitalize text-amber-500">{circle.user_role}</span> : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

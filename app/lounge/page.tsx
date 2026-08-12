"use client"

import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DiscordInviteWidget } from "@/components/lounge/discord-invite-widget"
import { Lock, Sparkles, Users, Vote } from "lucide-react"

export default function LoungePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user?.is_premium) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600">
            <Lock className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold">The Pro Lounge is Pro-only</h1>
          <p className="mt-2 text-muted-foreground">
            Upgrade to Loop Pro to unlock the Lounge, the private Discord invite, and every other Pro perk.
          </p>
          <Button asChild className="mt-6 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">
            <Link href="/premium">
              <Sparkles className="mr-2 h-4 w-4" /> Get Loop Pro
            </Link>
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="space-y-2 text-center">
          <Badge className="rounded-full bg-indigo-500/15 text-indigo-500">Invite Only</Badge>
          <h1 className="text-3xl font-bold tracking-tight">The Pro Lounge</h1>
          <p className="text-muted-foreground">
            A private space for Loop Pro members and the dev team.
          </p>
        </div>

        <DiscordInviteWidget />

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Founder Q&As</p>
                <p className="text-sm text-muted-foreground">
                  Monthly live sessions with the Loop team — ask anything about the roadmap.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-start gap-3 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Vote className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold">Priority feature voting</p>
                <p className="text-sm text-muted-foreground">
                  Pro members get a bigger say in what Loop builds next.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/premium">View all Pro perks</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}

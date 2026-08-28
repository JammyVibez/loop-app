"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { CreatorRevenueDashboard } from "@/components/creator/creator-revenue-dashboard"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Coins, TrendingUp } from "lucide-react"
import { PageLoading } from "@/components/loading-states"

export default function CreatorRevenuePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?returnTo=/creator/revenue")
    }
  }, [user, loading, router])

  if (loading) return <PageLoading message="Loading revenue data..." />
  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Creator Revenue</h1>
            <p className="text-sm text-muted-foreground">Track your earnings and payouts</p>
          </div>
        </div>

        {/* Revenue Dashboard */}
        <CreatorRevenueDashboard />

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link
            href="/earnings"
            className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Coins className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">Earnings History</p>
              <p className="text-[10px] text-muted-foreground">View all transactions</p>
            </div>
          </Link>
          <Link
            href="/wallet"
            className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card p-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
              <TrendingUp className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <p className="text-xs font-semibold">Wallet</p>
              <p className="text-[10px] text-muted-foreground">Manage coins</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

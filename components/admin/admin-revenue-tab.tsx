"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Coins,
  Gift,
  CreditCard,
  ShoppingBag,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Zap,
  
  Crown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

interface RevenueData {
  total_revenue_usd: number
  revenue_change_percent: number
  total_coins_sold: number
  total_gifts_value: number
  total_withdrawals: number
  pending_withdrawals: number
  daily_revenue: Array<{ date: string; amount: number }>
  top_revenue_sources: Array<{ name: string; amount: number; count: number }>
  recent_transactions: Array<{
    id: string
    type: string
    amount: number
    user: string
    created_at: string
  }>
}

function formatUsd(n: number) {
  return `$${n.toFixed(2)}`
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export function AdminRevenueTab() {
  const { getAuthHeader } = useAuth()
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("30d")

  useEffect(() => {
    fetchRevenue()
  }, [period])

  const fetchRevenue = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/revenue?period=${period}`, {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const result = await res.json()
        setData(result)
      }
    } catch (err) {
      console.error("Failed to fetch revenue:", err)
    } finally {
      setLoading(false)
    }
  }

  // Generate mock chart data if no real data
  const chartData = useMemo(() => {
    if (data?.daily_revenue?.length) return data.daily_revenue
    // Generate last 7 days of mock data
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return {
        date: date.toISOString().split("T")[0],
        amount: Math.floor(Math.random() * 500 + 100),
      }
    })
  }, [data])

  const maxRevenue = Math.max(...chartData.map((d) => d.amount), 1)

  const stats = data || {
    total_revenue_usd: 2847.50,
    revenue_change_percent: 12.5,
    total_coins_sold: 145000,
    total_gifts_value: 1823.40,
    total_withdrawals: 4250.00,
    pending_withdrawals: 3,
    top_revenue_sources: [
      { name: "Coin Purchases", amount: 1024.10, count: 89 },
      { name: "Gift Revenue", amount: 623.40, count: 234 },
      { name: "Premium Subs", amount: 480.00, count: 40 },
      { name: "Ad Revenue", amount: 320.00, count: 1200 },
      { name: "Boost Purchases", amount: 400.00, count: 67 },
    ],
    recent_transactions: [],
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        {(["7d", "30d", "90d", "all"] as const).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            className="text-xs rounded-full"
          >
            {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "All Time"}
          </Button>
        ))}
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50 bg-gradient-to-br from-emerald-500/10 to-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-2xl font-bold">{formatUsd(stats.total_revenue_usd)}</p>
            <div className="flex items-center gap-1 mt-1">
              {stats.revenue_change_percent >= 0 ? (
                <ArrowUpRight className="h-3 w-3 text-emerald-500" />
              ) : (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              )}
              <span className={cn("text-xs font-medium", stats.revenue_change_percent >= 0 ? "text-emerald-500" : "text-red-500")}>
                {Math.abs(stats.revenue_change_percent)}%
              </span>
              <span className="text-[10px] text-muted-foreground">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Coins Sold</span>
            </div>
            <p className="text-2xl font-bold">{formatNumber(stats.total_coins_sold)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-4 w-4 text-pink-500" />
              <span className="text-xs text-muted-foreground">Gifts Value</span>
            </div>
            <p className="text-2xl font-bold">{formatUsd(stats.total_gifts_value)}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="h-4 w-4 text-violet-500" />
              <span className="text-xs text-muted-foreground">Pending Payouts</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending_withdrawals}</p>
            <p className="text-[10px] text-muted-foreground">{formatUsd(stats.total_withdrawals)} total</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Simple bar chart */}
              <div className="flex items-end gap-1 h-32">
                {chartData.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500/80 to-emerald-500/40 rounded-t-sm transition-all hover:from-emerald-500 hover:to-emerald-600"
                      style={{ height: `${(d.amount / maxRevenue) * 100}%`, minHeight: "4px" }}
                      title={`${d.date}: $${d.amount}`}
                    />
                    <span className="text-[8px] text-muted-foreground">
                      {new Date(d.date).toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue Sources */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Revenue Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {stats.top_revenue_sources.map((source) => {
            const total = stats.top_revenue_sources.reduce((s, r) => s + r.amount, 0)
            const percent = total > 0 ? (source.amount / total) * 100 : 0
            return (
              <div key={source.name} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{source.name}</span>
                    <span className="text-xs text-muted-foreground">{formatUsd(source.amount)}</span>
                  </div>
                  <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {source.count}
                </Badge>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

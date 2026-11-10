"use client"

import { useEffect, useState } from "react"
import { RotateCcw, RefreshCw, Check, X } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/skeletons"

interface RefundRequest {
  id: string
  user_id: string
  wallet_tx_id: string
  amount_usd: number
  coins_amount: number
  tx_type: string
  reason: string | null
  status: "pending" | "approved" | "rejected"
  admin_note: string | null
  created_at: string
  reviewed_at: string | null
  user?: {
    username: string
    display_name: string
    avatar_url?: string
    loop_coins?: number
  }
  wallet_transactions?: {
    description?: string
    created_at?: string
    status?: string
  }
}

const STATUS_FILTERS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
]

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30",
  rejected: "bg-rose-500/10 text-rose-500 border border-rose-500/30",
}

export function RefundsControl() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending")
  const [updating, setUpdating] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = filter === "all" ? "" : `?status=${filter}`
      const res = await fetch(`/api/admin/refunds${params}`, { headers: { ...getAuthHeader() } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load refund requests")
      setRequests(data.requests || [])
    } catch (error: any) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const decide = async (id: string, action: "approve" | "reject") => {
    setUpdating(id)
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update refund request")
      toast({
        title: action === "approve" ? "Refund processed 💸" : "Refund rejected",
        description: data.message,
      })
      await load()
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-amber-500" />
          Refund Requests
        </CardTitle>
        <CardDescription>
          Users request refunds for Stripe purchases (coin packs, Pro, shop items). Approving issues a real
          Stripe refund and reverses the grant (coins deducted / item removed / Pro revoked).
        </CardDescription>
        <div className="flex items-center justify-between gap-3 pt-1">
          <Tabs value={filter} onValueChange={setFilter} className="w-auto">
            <TabsList className="h-8">
              {STATUS_FILTERS.map((f) => (
                <TabsTrigger key={f.id} value={f.id} className="px-3 text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="sm" onClick={() => void load()} className="text-muted-foreground">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Spinner className="mr-2 h-5 w-5" /> Loading refund requests…
          </div>
        ) : requests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No {filter === "all" ? "" : `${filter} `}refund requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/70 bg-card/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">
                        @{r.user?.username || r.user?.display_name || "user"}
                      </p>
                      <Badge className={statusStyle[r.status]}>{r.status}</Badge>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {r.tx_type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ${Number(r.amount_usd || 0).toFixed(2)}
                      {r.coins_amount > 0 ? ` · ${r.coins_amount.toLocaleString()} coins` : ""}
                      {r.wallet_transactions?.description ? ` · ${r.wallet_transactions.description}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Requested {new Date(r.created_at).toLocaleString()}
                      {r.wallet_transactions?.created_at
                        ? ` · purchased ${new Date(r.wallet_transactions.created_at).toLocaleDateString()}`
                        : ""}
                    </p>
                    {r.reason && (
                      <p className="mt-2 rounded-lg bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                        “{r.reason}”
                      </p>
                    )}
                    {r.admin_note && (
                      <p className="mt-1.5 text-[11px] italic text-muted-foreground">Note: {r.admin_note}</p>
                    )}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        disabled={updating === r.id}
                        onClick={() => void decide(r.id, "approve")}
                        className="rounded-full bg-emerald-600 text-white hover:bg-emerald-500"
                      >
                        {updating === r.id ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                        Refund
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating === r.id}
                        onClick={() => void decide(r.id, "reject")}
                        className="rounded-full text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

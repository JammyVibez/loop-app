"use client"

import { useEffect, useState } from "react"
import { DollarSign, RefreshCw, Check, X, CircleDollarSign } from "@/components/icons/lucide-compat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Spinner } from "@/components/ui/skeletons"

interface WithdrawalRequest {
  id: string
  user_id: string
  username: string
  coins_amount: number
  estimated_usd: number
  payout_method: string
  payout_details: string
  status: string
  created_at: string
}

const STATUS_FILTERS = [
  { id: "pending_review", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
]

export function WithdrawalsControl() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<WithdrawalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending_review")
  const [updating, setUpdating] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params = filter === "all" ? "" : `?status=${filter}`
      const res = await fetch(`/api/admin/withdrawals${params}`, { headers: { ...getAuthHeader() } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load payout requests")
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

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id)
    try {
      const res = await fetch("/api/admin/withdrawals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update request")
      toast({ title: "Updated", description: `Request marked as ${status.replace(/_/g, " ")}.` })
      await load()
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setUpdating(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              Creator Payout Requests
            </CardTitle>
            <CardDescription>Review and manually process withdrawal requests.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <Tabs value={filter} onValueChange={setFilter} className="mt-3">
          <TabsList>
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" /> Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No requests in this view.</div>
        ) : (
          <div className="divide-y divide-border/40">
            {requests.map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-500">
                    <CircleDollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      @{req.username} — {req.coins_amount.toLocaleString()} coins (${req.estimated_usd})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {req.payout_method.toUpperCase()} • {req.payout_details} •{" "}
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {req.status.replace(/_/g, " ")}
                  </Badge>
                  {req.status === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating === req.id}
                        onClick={() => updateStatus(req.id, "approved")}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        disabled={updating === req.id}
                        onClick={() => updateStatus(req.id, "rejected")}
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Reject
                      </Button>
                    </>
                  )}
                  {req.status === "approved" && (
                    <Button size="sm" disabled={updating === req.id} onClick={() => updateStatus(req.id, "paid")}>
                      Mark Paid
                    </Button>
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

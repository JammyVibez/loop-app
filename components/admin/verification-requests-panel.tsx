"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import {
  BadgeCheck,
  Check,
  ExternalLink,
  Eye,
  Link2,
  RefreshCw,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface VerifRequest {
  id: string
  user_id: string
  real_name: string | null
  username: string | null
  social_links: string | null
  reason: string | null
  verification_type: string | null
  documents_url: string | null
  status: "pending" | "approved" | "rejected" | "cancelled"
  admin_notes: string | null
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
  user?: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    is_verified: boolean | null
  } | null
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-600 border-red-500/30" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border" },
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function VerificationRequestsPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [requests, setRequests] = useState<VerifRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending")
  const [actingId, setActingId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<VerifRequest | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [viewTarget, setViewTarget] = useState<VerifRequest | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/verification", { headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load requests")
      setRequests(data.requests || [])
    } catch (err: any) {
      toast({ title: "Load failed", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, toast])

  useEffect(() => {
    load()
  }, [load])

  const review = async (request: VerifRequest, action: "approved" | "rejected", notes?: string) => {
    setActingId(request.id)
    try {
      const res = await fetch("/api/admin/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ requestId: request.id, action, adminNotes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      toast({
        title: action === "approved" ? "Request approved" : "Request rejected",
        description:
          action === "approved"
            ? `${request.user?.username || request.username || "User"} is now verified.`
            : "The user will see your reason in their notification.",
      })
      setRejectTarget(null)
      setRejectReason("")
      await load()
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" })
    } finally {
      setActingId(null)
    }
  }

  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }
  const filtered = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter)

  return (
    <div className="space-y-4">
      {/* Filter chips + refresh */}
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
              statusFilter === s
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {s}
            {s !== "all" && counts[s] > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{counts[s]}</span>
            )}
          </button>
        ))}
        <Button variant="outline" size="icon" className="ml-auto h-8 w-8" onClick={load} aria-label="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <BadgeCheck className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium">No {statusFilter === "all" ? "" : statusFilter} requests</p>
            <p className="text-xs text-muted-foreground">
              Verification requests users submit from Settings will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const name = req.user?.display_name || req.real_name || req.user?.username || req.username || "Unknown"
            const handle = req.user?.username || req.username
            const status = STATUS_META[req.status] || STATUS_META.pending
            const isPending = req.status === "pending"
            return (
              <Card key={req.id} className="border-border/50 transition-colors hover:border-border">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {/* Avatar */}
                    {req.user?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={req.user.avatar_url}
                        alt={name}
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">{name}</span>
                        {handle && <span className="truncate text-xs text-muted-foreground">@{handle}</span>}
                        <Badge variant="outline" className={cn("rounded-full text-[10px]", status.cls)}>
                          {status.label}
                        </Badge>
                        {req.verification_type && (
                          <Badge variant="outline" className="rounded-full text-[10px] capitalize">
                            {req.verification_type.replace(/_/g, " ")}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {req.reason || "No reason provided"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        Submitted {timeAgo(req.created_at)}
                        {req.reviewed_at && ` · Reviewed ${timeAgo(req.reviewed_at)}`}
                        {req.rejection_reason && ` · Reason: ${req.rejection_reason}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setViewTarget(req)}
                        aria-label="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isPending ? (
                        <>
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 rounded-full"
                            disabled={actingId === req.id}
                            onClick={() => review(req, "approved")}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 rounded-full border-red-500/30 text-red-600 hover:bg-red-500/10"
                            disabled={actingId === req.id}
                            onClick={() => {
                              setRejectTarget(req)
                              setRejectReason("")
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => review(req, req.status === "approved" ? "rejected" : "approved", req.admin_notes || undefined)}
                          disabled={actingId === req.id}
                        >
                          Re-review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Details dialog */}
      <Dialog open={Boolean(viewTarget)} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {viewTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-primary" />
                  Verification request
                </DialogTitle>
                <DialogDescription>
                  {viewTarget.user?.display_name || viewTarget.real_name || "Unknown"} · submitted{" "}
                  {timeAgo(viewTarget.created_at)}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Real name</p>
                    <p className="font-medium">{viewTarget.real_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="font-medium capitalize">{(viewTarget.verification_type || "—").replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Username</p>
                    <p className="font-medium">{viewTarget.user?.username || viewTarget.username || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{viewTarget.status}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                  <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">
                    {viewTarget.reason || "No reason provided"}
                  </p>
                </div>
                {viewTarget.social_links && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Social links</p>
                    <div className="mt-1 space-y-1">
                      {viewTarget.social_links
                        .split(/[\n,]+/)
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((link, i) => (
                          <a
                            key={i}
                            href={link.startsWith("http") ? link : `https://${link}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 truncate text-xs text-primary hover:underline"
                          >
                            <Link2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{link}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </a>
                        ))}
                    </div>
                  </div>
                )}
                {viewTarget.documents_url && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Documents</p>
                    <a
                      href={viewTarget.documents_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open submitted document
                    </a>
                  </div>
                )}
                {viewTarget.admin_notes && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Admin notes</p>
                    <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs">{viewTarget.admin_notes}</p>
                  </div>
                )}
              </div>
              {viewTarget.status === "pending" && (
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRejectTarget(viewTarget)
                      setViewTarget(null)
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => {
                      const r = viewTarget
                      setViewTarget(null)
                      review(r, "approved")
                    }}
                  >
                    Approve
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog — requires a reason */}
      <Dialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectReason("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject verification request</DialogTitle>
            <DialogDescription>
              The reason is shown to{" "}
              {rejectTarget?.user?.display_name || rejectTarget?.real_name || "the user"} in their notification.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. We couldn't verify your identity from the links provided. Please resubmit with a government ID or official website."
            rows={4}
          />
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setRejectTarget(null)
                setRejectReason("")
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim() || actingId === rejectTarget?.id}
              onClick={() => rejectTarget && review(rejectTarget, "rejected", rejectReason.trim())}
            >
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

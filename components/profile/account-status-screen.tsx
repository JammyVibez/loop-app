"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Ban, ShieldAlert, Trash2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/skeletons"

interface AppealStatus {
  status: "pending" | "approved" | "denied"
  reason?: string
  admin_notes?: string
  created_at?: string
  reviewed_at?: string
}

interface Props {
  status: "deleted" | "suspended"
  username?: string
  isSelf: boolean
  banReason?: string | null
}

export function AccountStatusScreen({ status, username, isSelf, banReason }: Props) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [appeal, setAppeal] = useState<AppealStatus | null>(null)
  const [appealText, setAppealText] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const isDeleted = status === "deleted"

  useEffect(() => {
    if (!isDeleted && isSelf && user) {
      void (async () => {
        try {
          const response = await fetch("/api/users/ban-appeal", { headers: getAuthHeader() })
          const data = await response.json()
          if (data.success && data.appeal) setAppeal(data.appeal)
        } catch {
          /* non-blocking */
        }
      })()
    }
  }, [isDeleted, isSelf, user, getAuthHeader])

  const submitAppeal = async () => {
    if (!appealText.trim()) {
      toast({ title: "Tell us why", description: "Explain your side so we can review your appeal.", variant: "destructive" })
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch("/api/users/ban-appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ reason: appealText.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to submit appeal")
      setAppeal(data.appeal)
      toast({ title: "Appeal submitted", description: "Our team will review it and get back to you." })
    } catch (error: any) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <div className="relative">
        <Avatar className="h-24 w-24 border-2 border-border">
          <AvatarFallback className="bg-muted text-3xl font-bold text-muted-foreground">
            {isDeleted ? <Trash2 className="h-10 w-10" /> : <Ban className="h-10 w-10" />}
          </AvatarFallback>
        </Avatar>
        <Badge
          variant="secondary"
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 gap-1 rounded-full whitespace-nowrap"
        >
          {isDeleted ? <Trash2 className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
          {isDeleted ? "Deleted account" : "Suspended account"}
        </Badge>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {isDeleted ? "This account has been deleted" : "This account has been suspended"}
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {isDeleted
            ? `@${username || "this user"} no longer exists on Loop. Their posts and profile are no longer visible.`
            : `@${username || "this user"} is temporarily suspended${
                banReason ? ` (${banReason})` : ""
              }. Their content is hidden while the account is under review.`}
        </p>
      </div>

      {!isDeleted && isSelf && user && (
        <Card className="w-full border-border/80">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Appeal your suspension
            </CardTitle>
            <CardDescription>
              {appeal
                ? appeal.status === "pending"
                  ? "Your appeal is under review. We'll update you as soon as it's decided."
                  : appeal.status === "approved"
                    ? "Your appeal was approved — your account is active again."
                    : "Your appeal was denied. You can contact support for further help."
                : "If you believe this was a mistake, submit an appeal and our team will review it."}
            </CardDescription>
          </CardHeader>
          {!appeal ? (
            <CardContent className="space-y-3">
              <Textarea
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                placeholder="Explain what happened and why you should be let back in…"
                className="min-h-[110px]"
                maxLength={2000}
              />
              <Button className="w-full" onClick={submitAppeal} disabled={submitting || loading}>
                {submitting ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Submit appeal
              </Button>
            </CardContent>
          ) : (
            <CardContent className="space-y-3 text-sm">
              {appeal.reason && (
                <p className="rounded-lg bg-muted p-3 text-muted-foreground">
                  <span className="font-semibold text-foreground">Your appeal: </span>
                  {appeal.reason}
                </p>
              )}
              {appeal.admin_notes && appeal.status === "denied" && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                  <span className="font-semibold">Response: </span>
                  {appeal.admin_notes}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    appeal.status === "approved" ? "default" : appeal.status === "denied" ? "destructive" : "secondary"
                  }
                  className="rounded-full"
                >
                  {appeal.status}
                </Badge>
                {appeal.reviewed_at && (
                  <span className="text-xs text-muted-foreground">
                    Reviewed {new Date(appeal.reviewed_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Button asChild variant="outline" className="rounded-full">
        <Link href="/">Back to Loop</Link>
      </Button>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Lock, Mail, ShieldCheck, KeyRound, CheckCircle2, AlertCircle, ExternalLink, Trash2 } from "lucide-react"
import { TwoFactorSettings } from "@/components/settings/two-factor-settings"

export function SecuritySettings() {
  const { user, refreshUser, getAuthHeader } = useAuth()
  const { toast } = useToast()

  const [emailForm, setEmailForm] = useState({ email: "", password: "" })
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailDone, setEmailDone] = useState(false)

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })
  const [pwBusy, setPwBusy] = useState(false)
  const [pwDone, setPwDone] = useState(false)

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [deleting, setDeleting] = useState(false)
  const [deletionScheduled, setDeletionScheduled] = useState(false)
  const [deletionExecuteAfter, setDeletionExecuteAfter] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    fetch("/api/users/delete-account", { headers: { ...getAuthHeader() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.scheduled) {
          setDeletionScheduled(true)
          setDeletionExecuteAfter(data.execute_after || null)
        }
      })
      .catch(() => {})
  }, [])

  const passwordHint = (pw: string) => {
    const checks = [
      [pw.length >= 8, "8+ characters"],
      [/[A-Z]/.test(pw), "uppercase"],
      [/[a-z]/.test(pw), "lowercase"],
      [/\d/.test(pw), "number"],
      [/[!@#$%^&*]/.test(pw), "special character"],
    ] as const
    return checks
  }

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (emailBusy) return
    setEmailBusy(true)
    setEmailDone(false)
    try {
      const res = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailForm.email, password: emailForm.password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not update email")
      setEmailDone(true)
      setEmailForm({ email: "", password: "" })
      void refreshUser()
      toast({ title: "Email updated", description: data.message })
    } catch (err: any) {
      toast({ title: "Couldn't update email", description: err.message, variant: "destructive" })
    } finally {
      setEmailBusy(false)
    }
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwBusy) return
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" })
      return
    }
    setPwBusy(true)
    setPwDone(false)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not change password")
      setPwDone(true)
      setPwForm({ current: "", next: "", confirm: "" })
      toast({ title: "Password updated", description: data.message })
    } catch (err: any) {
      toast({ title: "Couldn't change password", description: err.message, variant: "destructive" })
    } finally {
      setPwBusy(false)
    }
  }

  const signInMethods = [
    { label: "Email & password", active: true },
    { label: "Google", active: Boolean(user?.email && user?.user_metadata?.avatar_url) },
  ]

  const handleDeleteAccount = () => {
    setDeleteDialogOpen(true)
    setDeleteConfirmText("")
  }

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return
    setDeleting(true)
    try {
      const res = await fetch("/api/users/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete account")
      setDeleteDialogOpen(false)
      setDeletionScheduled(true)
      setDeletionExecuteAfter(data.execute_after || null)
      toast({
        title: "Account deletion scheduled",
        description: "Your account will be deleted in 3 days. You can cancel anytime before then.",
      })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const cancelDeletion = async () => {
    setCancelling(true)
    try {
      const res = await fetch("/api/users/delete-account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error("Failed to cancel deletion")
      setDeletionScheduled(false)
      setDeletionExecuteAfter(null)
      toast({ title: "Deletion cancelled", description: "Your account is safe." })
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Account overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5" /> Account
          </CardTitle>
          <CardDescription>Your sign-in email, linked providers, and security options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign-in email</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
                <Mail className="h-3.5 w-3.5 text-primary" /> {user?.email || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sign-in methods</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {signInMethods.map((m) => (
                  <Badge key={m.label} variant={m.active ? "default" : "outline"} className="gap-1 rounded-full">
                    {m.active ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {m.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
            Forgot your password?{" "}
            <Link href="/reset-password" className="font-medium text-primary underline underline-offset-4">
              Reset it here
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Change email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5" /> Change email
          </CardTitle>
          <CardDescription>Update the email used to sign in. Confirm with your current password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changeEmail} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-email">New email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-password">Current password</Label>
                <Input
                  id="email-password"
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Confirm to continue"
                  required
                />
              </div>
            </div>
            {emailDone && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Email updated successfully.
              </p>
            )}
            <Button type="submit" disabled={emailBusy || !emailForm.email || !emailForm.password} className="rounded-full">
              {emailBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Update email
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5" /> Change password
          </CardTitle>
          <CardDescription>Pick a strong password you don't use anywhere else.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current password</Label>
              <Input
                id="current-pw"
                type="password"
                value={pwForm.current}
                onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                placeholder="Your current password"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                  placeholder="At least 8 characters"
                  required
                />
                <ul className="mt-1.5 space-y-1">
                  {passwordHint(pwForm.next).map(([ok, label]) => (
                    <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                      {ok ? <CheckCircle2 className="h-3 w-3" /> : <span className="inline-block h-3 w-3 rounded-full border" />}
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm new password</Label>
                <Input
                  id="confirm-pw"
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password"
                  required
                />
                {pwForm.confirm && pwForm.next !== pwForm.confirm && (
                  <p className="mt-1.5 text-xs text-red-500">Passwords don't match</p>
                )}
              </div>
            </div>
            {pwDone && (
              <p className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Password changed. Other sessions were signed out.
              </p>
            )}
            <Button
              type="submit"
              disabled={pwBusy || !pwForm.current || !pwForm.next || pwForm.next !== pwForm.confirm}
              className="rounded-full"
            >
              {pwBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5" />
            <span>Danger Zone</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-red-600 dark:text-red-400">Delete Account</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Permanently delete your account and all data. You have 3 days to cancel.
              </p>
            </div>
            {deletionScheduled ? (
              <div className="space-y-2">
                <Badge variant="destructive" className="text-xs">
                  Deletion scheduled for {deletionExecuteAfter ? new Date(deletionExecuteAfter).toLocaleDateString() : "soon"}
                </Badge>
                <Button variant="outline" size="sm" onClick={cancelDeletion} disabled={cancelling} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                  {cancelling ? "Cancelling..." : "Cancel Deletion"}
                </Button>
              </div>
            ) : (
              <Button variant="destructive" size="sm" onClick={handleDeleteAccount}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete Account Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-rose-400">Delete Account</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Your account will be deactivated immediately and permanently deleted after 3 days.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Your posts remain visible but show &quot;Deleted Account&quot;</li>
              <li>Your profile becomes inaccessible</li>
              <li>You cannot log in during the 3-day grace period</li>
              <li>After 3 days, all data is permanently deleted</li>
            </ul>
            <div className="space-y-2">
              <Label>Type DELETE to confirm</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAccount}
              disabled={deleteConfirmText !== "DELETE" || deleting}
            >
              {deleting ? "Scheduling..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-Factor Authentication */}
      <TwoFactorSettings />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Key,
  Copy,
  Check,
  AlertTriangle,
  Download,
  
  Smartphone,
  Lock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

export function TwoFactorSettings() {
  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()

  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [setupStep, setSetupStep] = useState<"idle" | "qr" | "verify" | "backup" | "done">("idle")
  const [qrData, setQrData] = useState<{ secret: string; uri: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState("")
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [showDisableDialog, setShowDisableDialog] = useState(false)
  const [disablePassword, setDisablePassword] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/auth/2fa/status", {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setEnabled(data.enabled)
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
      })
      if (!res.ok) throw new Error("Failed to start 2FA setup")
      const data = await res.json()
      setQrData({ secret: data.secret, uri: data.uri })
      setSetupStep("qr")
    } catch (err: any) {
      toast({ title: "Setup failed", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      toast({ title: "Enter a 6-digit code", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch("/api/auth/2fa/verify-enable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ code: verifyCode }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Invalid code")
      }
      const data = await res.json()
      setBackupCodes(data.backupCodes || [])
      setSetupStep("backup")
      setEnabled(true)
      toast({ title: "2FA enabled successfully!" })
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const handleDisable = async () => {
    if (!disablePassword) return
    setBusy(true)
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ password: disablePassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to disable 2FA")
      }
      setEnabled(false)
      setShowDisableDialog(false)
      setDisablePassword("")
      toast({ title: "2FA disabled" })
    } catch (err: any) {
      toast({ title: "Failed to disable", description: err.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const copyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const downloadBackupCodes = () => {
    const content = backupCodes.join("\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "loop-backup-codes.txt"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Spinner className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          ) : (
            <Shield className="h-4 w-4 text-muted-foreground" />
          )}
          Two-Factor Authentication
        </CardTitle>
        <CardDescription className="text-xs">
          Add an extra layer of security with an authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3">
              <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-500">2FA is enabled</p>
                <p className="text-xs text-muted-foreground">
                  Your account is protected with an authenticator app
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setShowDisableDialog(true)}
            >
              <ShieldOff className="h-4 w-4 mr-2" />
              Disable 2FA
            </Button>
          </div>
        ) : setupStep === "qr" && qrData ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-3">
                Scan this QR code with your authenticator app
              </p>
              {/* QR Code placeholder - in production, use a QR code library */}
              <div className="mx-auto h-48 w-48 rounded-xl border border-border bg-white p-2 flex items-center justify-center">
                <div className="text-center space-y-2">
                  <Smartphone className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-[10px] text-muted-foreground">QR Code</p>
                  <p className="text-[9px] text-muted-foreground font-mono break-all">{qrData.secret}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Or enter this key manually:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono text-center">
                  {qrData.secret}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0 h-8 w-8"
                  onClick={() => {
                    navigator.clipboard.writeText(qrData.secret)
                    toast({ title: "Secret copied" })
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <Button onClick={() => setSetupStep("verify")} className="w-full">
              I&apos;ve scanned the code
            </Button>
          </div>
        ) : setupStep === "verify" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Enter the 6-digit code from your authenticator app
            </p>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-[0.5em] font-mono"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSetupStep("qr")} className="flex-1">
                Back
              </Button>
              <Button onClick={handleVerify} disabled={busy || verifyCode.length !== 6} className="flex-1">
                {busy ? <Spinner className="h-4 w-4 mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                Verify & Enable
              </Button>
            </div>
          </div>
        ) : setupStep === "backup" && backupCodes.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Save your backup codes</p>
                <p className="text-xs text-muted-foreground">
                  Store these codes somewhere safe. Each code can only be used once if you lose access to your authenticator.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {backupCodes.map((code, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5">
                  <code className="text-xs font-mono">{code}</code>
                  <button
                    onClick={() => copyCode(code, i)}
                    className="ml-1"
                  >
                    {copiedIndex === i ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadBackupCodes} className="flex-1 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
              <Button onClick={() => { setSetupStep("idle"); setVerifyCode("") }} className="flex-1">
                I&apos;ve saved them
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Authenticator App</p>
                  <p className="text-xs text-muted-foreground">
                    Use Google Authenticator, Authy, 1Password, or any TOTP-compatible app
                  </p>
                </div>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                Protect against password theft
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                Required for withdrawals and sensitive actions
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                Backup codes for recovery
              </li>
            </ul>
            <Button onClick={handleSetup} disabled={busy} className="w-full gap-2">
              {busy ? <Spinner className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
              Enable Two-Factor Authentication
            </Button>
          </div>
        )}

        {/* Disable Dialog */}
        <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <ShieldOff className="h-5 w-5" />
                Disable 2FA?
              </DialogTitle>
              <DialogDescription>
                Your account will be less secure. You&apos;ll only need your password to sign in.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              placeholder="Enter your password to confirm"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDisableDialog(false); setDisablePassword("") }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!disablePassword || busy}
                onClick={handleDisable}
              >
                {busy ? <Spinner className="h-4 w-4 mr-2" /> : null}
                Disable 2FA
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

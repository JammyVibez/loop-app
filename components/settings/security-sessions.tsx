"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Monitor,
  Smartphone,
  Globe,
  Shield,
  Trash2,
  Download,
  LogOut,
  AlertTriangle,
  Check,
  Clock,
  MapPin,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Session {
  id: string
  device: string
  browser: string
  os: string
  ip: string
  location?: string
  created_at: string
  last_active: string
  is_current: boolean
}

interface SecuritySessionsProps {
  activeTab?: string
}

export function SecuritySessions({ activeTab }: SecuritySessionsProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/auth/sessions", {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch {
      // Fallback: show at least current session
      setSessions([
        {
          id: "current",
          device: "Current Device",
          browser: "This browser",
          os: navigator.platform || "Unknown",
          ip: "Current IP",
          created_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
          is_current: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = async () => {
    setExporting(true)
    try {
      const res = await fetch("/api/users/export-data", {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `loopapp-data-export-${new Date().toISOString().split("T")[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast({ title: "Data exported successfully" })
      } else {
        toast({ title: "Export failed", variant: "destructive" })
      }
    } catch {
      toast({ title: "Export failed", variant: "destructive" })
    } finally {
      setExporting(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        toast({ title: "Session revoked" })
      }
    } catch {
      toast({ title: "Failed to revoke session", variant: "destructive" })
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.username) return
    setDeleting(true)
    try {
      const res = await fetch("/api/users/delete-account", {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      if (res.ok) {
        toast({ title: "Account deleted" })
        window.location.href = "/"
      } else {
        toast({ title: "Failed to delete account", variant: "destructive" })
      }
    } catch {
      toast({ title: "Failed to delete account", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const getDeviceIcon = (session: Session) => {
    const ua = (session.device + session.browser + session.os).toLowerCase()
    if (ua.includes("iphone") || ua.includes("android") || ua.includes("mobile")) {
      return Smartphone
    }
    if (ua.includes("chrome") || ua.includes("firefox") || ua.includes("safari") || ua.includes("edge")) {
      return Monitor
    }
    return Globe
  }

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-4">
      {/* Active Sessions */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Active Sessions
          </CardTitle>
          <CardDescription className="text-xs">
            Manage devices that are signed into your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No active sessions</p>
          ) : (
            sessions.map((session) => {
              const DeviceIcon = getDeviceIcon(session)
              return (
                <div
                  key={session.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3 transition-colors",
                    session.is_current
                      ? "bg-primary/5 border border-primary/20"
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
                    session.is_current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <DeviceIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {session.browser || "Unknown Browser"}
                      </p>
                      {session.is_current && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.os || "Unknown OS"}
                      {session.location ? ` · ${session.location}` : ""}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        Active {getTimeAgo(session.last_active)}
                      </span>
                    </div>
                  </div>
                  {!session.is_current && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              )
            })
          )}
          {sessions.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-destructive hover:text-destructive mt-2"
              onClick={async () => {
                const otherSessions = sessions.filter((s) => !s.is_current)
                for (const s of otherSessions) {
                  await handleRevokeSession(s.id)
                }
              }}
            >
              <LogOut className="h-3.5 w-3.5 mr-1.5" />
              Sign out all other devices
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export Your Data
          </CardTitle>
          <CardDescription className="text-xs">
            Download a copy of all your posts, comments, messages, and profile data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={handleExportData}
            disabled={exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Exporting..." : "Download My Data"}
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </CardTitle>
          <CardDescription className="text-xs">
            Permanently delete your account and all associated data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data including posts, comments,
              messages, coins, and followers will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{user?.username}</span> to confirm:
            </p>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="Type your username"
              className="border-destructive/50 focus-visible:ring-destructive"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== user?.username || deleting}
              onClick={handleDeleteAccount}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

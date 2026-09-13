"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Shield,
  Search,
  RefreshCw,
  Filter,
  Clock,
  User,
  Globe,
  AlertTriangle,
  CheckCircle,
  LogIn,
  LogOut,
  Key,
  Ban,
  CreditCard,
  MessageSquare,
  ChevronDown,
  Download,
  
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"

interface AuditLogEntry {
  id: string
  user_id: string | null
  action: string
  details: any
  ip_address: string | null
  user_agent: string | null
  created_at: string
  username?: string
  display_name?: string
  avatar_url?: string
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  login_success: { label: "Login Success", color: "text-emerald-500 bg-emerald-500/10", icon: LogIn },
  login_failed: { label: "Login Failed", color: "text-red-500 bg-red-500/10", icon: AlertTriangle },
  logout: { label: "Logout", color: "text-muted-foreground bg-muted/50", icon: LogOut },
  signup: { label: "Signup", color: "text-blue-500 bg-blue-500/10", icon: User },
  password_changed: { label: "Password Changed", color: "text-amber-500 bg-amber-500/10", icon: Key },
  password_reset_requested: { label: "Password Reset", color: "text-orange-500 bg-orange-500/10", icon: Key },
  password_reset_completed: { label: "Reset Completed", color: "text-emerald-500 bg-emerald-500/10", icon: CheckCircle },
  "2fa_enabled": { label: "2FA Enabled", color: "text-emerald-500 bg-emerald-500/10", icon: Shield },
  "2fa_disabled": { label: "2FA Disabled", color: "text-red-500 bg-red-500/10", icon: Shield },
  "2fa_backup_code_used": { label: "Backup Code Used", color: "text-amber-500 bg-amber-500/10", icon: Key },
  "2fa_code_failed": { label: "2FA Code Failed", color: "text-red-500 bg-red-500/10", icon: AlertTriangle },
  email_changed: { label: "Email Changed", color: "text-blue-500 bg-blue-500/10", icon: MessageSquare },
  account_deleted: { label: "Account Deleted", color: "text-red-500 bg-red-500/10", icon: Ban },
  session_revoked: { label: "Session Revoked", color: "text-amber-500 bg-amber-500/10", icon: LogOut },
  all_sessions_revoked: { label: "All Sessions Revoked", color: "text-red-500 bg-red-500/10", icon: LogOut },
  rate_limit_exceeded: { label: "Rate Limited", color: "text-red-500 bg-red-500/10", icon: AlertTriangle },
  sql_injection_attempt: { label: "SQL Injection Attempt", color: "text-red-500 bg-red-500/10", icon: Ban },
  xss_attempt: { label: "XSS Attempt", color: "text-red-500 bg-red-500/10", icon: Ban },
  unauthorized_access_attempt: { label: "Unauthorized Access", color: "text-red-500 bg-red-500/10", icon: Ban },
  coins_purchased: { label: "Coins Purchased", color: "text-emerald-500 bg-emerald-500/10", icon: CreditCard },
  coins_gifted: { label: "Coins Gifted", color: "text-pink-500 bg-pink-500/10", icon: CreditCard },
  withdrawal_requested: { label: "Withdrawal Requested", color: "text-amber-500 bg-amber-500/10", icon: CreditCard },
  content_reported: { label: "Content Reported", color: "text-orange-500 bg-orange-500/10", icon: AlertTriangle },
}

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { label: action, color: "text-muted-foreground bg-muted/50", icon: Shield }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function AuditLogPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [timeFilter, setTimeFilter] = useState("24h")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: "100",
        timeRange: timeFilter,
      })
      if (actionFilter !== "all") params.set("action", actionFilter)

      const res = await fetch(`/api/admin/audit-log?${params}`, {
        headers: getAuthHeader(),
      })
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs || [])
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader, timeFilter, actionFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const filteredLogs = logs.filter((log) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      log.action.toLowerCase().includes(q) ||
      log.username?.toLowerCase().includes(q) ||
      log.ip_address?.toLowerCase().includes(q) ||
      JSON.stringify(log.details).toLowerCase().includes(q)
    )
  })

  // Count by action type
  const actionCounts = logs.reduce((acc, log) => {
    acc[log.action] = (acc[log.action] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Security alerts
  const securityAlerts = logs.filter((l) =>
    ["sql_injection_attempt", "xss_attempt", "unauthorized_access_attempt", "rate_limit_exceeded", "login_failed"].includes(l.action)
  )

  const exportLogs = () => {
    const csv = [
      "Timestamp,Action,User,IP,Details",
      ...filteredLogs.map((log) =>
        `"${log.created_at}","${log.action}","${log.username || log.user_id || "N/A"}","${log.ip_address || "N/A"}","${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
      ),
    ].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Security Alert Banner */}
      {securityAlerts.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-500">
                  {securityAlerts.length} Security Alert{securityAlerts.length !== 1 ? "s" : ""} in selected period
                </p>
                <p className="text-xs text-muted-foreground">
                  {securityAlerts.filter((l) => l.action === "login_failed").length} failed logins, {" "}
                  {securityAlerts.filter((l) => ["sql_injection_attempt", "xss_attempt"].includes(l.action)).length} injection attempts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Total Events</p>
            <p className="text-lg font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Logins</p>
            <p className="text-lg font-bold text-emerald-500">
              {actionCounts["login_success"] || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Failed Logins</p>
            <p className="text-lg font-bold text-red-500">
              {actionCounts["login_failed"] || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Security Events</p>
            <p className="text-lg font-bold text-amber-500">
              {securityAlerts.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-[120px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="login_success">Login Success</SelectItem>
            <SelectItem value="login_failed">Login Failed</SelectItem>
            <SelectItem value="2fa_enabled">2FA Enabled</SelectItem>
            <SelectItem value="password_changed">Password Changed</SelectItem>
            <SelectItem value="sql_injection_attempt">SQL Injection</SelectItem>
            <SelectItem value="xss_attempt">XSS Attempt</SelectItem>
            <SelectItem value="rate_limit_exceeded">Rate Limited</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={exportLogs} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button variant="ghost" size="icon" onClick={fetchLogs} className="h-9 w-9">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Log List */}
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-6 w-6 text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No logs found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredLogs.slice(0, 50).map((log) => {
                const config = getActionConfig(log.action)
                const Icon = config.icon
                const isExpanded = expandedId === log.id
                const isSecurity = ["sql_injection_attempt", "xss_attempt", "unauthorized_access_attempt", "rate_limit_exceeded"].includes(log.action)

                return (
                  <div
                    key={log.id}
                    className={cn(
                      "px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer",
                      isSecurity && "bg-red-500/5"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{config.label}</span>
                          {log.username && (
                            <span className="text-xs text-muted-foreground">@{log.username}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {timeAgo(log.created_at)}
                          {log.ip_address && (
                            <>
                              <span>·</span>
                              <Globe className="h-3 w-3" />
                              {log.ip_address}
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs space-y-1.5">
                        {log.user_id && (
                          <p><span className="text-muted-foreground">User ID:</span> <span className="font-mono">{log.user_id}</span></p>
                        )}
                        {log.ip_address && (
                          <p><span className="text-muted-foreground">IP:</span> {log.ip_address}</p>
                        )}
                        {log.user_agent && (
                          <p><span className="text-muted-foreground">User Agent:</span> <span className="break-all">{log.user_agent}</span></p>
                        )}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <p><span className="text-muted-foreground">Details:</span> <pre className="mt-1 whitespace-pre-wrap break-all">{JSON.stringify(log.details, null, 2)}</pre></p>
                        )}
                        <p><span className="text-muted-foreground">Time:</span> {new Date(log.created_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

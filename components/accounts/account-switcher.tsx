"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Users,
  Plus,
  Trash2,
  ChevronDown,
  Check,
  RefreshCw,
  Crown,
  LogOut,
  AlertCircle,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface LinkedAccount {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  video_avatar_url?: string | null
  is_premium: boolean
  is_verified: boolean
  is_primary: boolean
  link_id: string | null
}

interface AccountSwitcherProps {
  variant?: "dropdown" | "settings"
}

export function AccountSwitcher({ variant = "dropdown" }: AccountSwitcherProps) {
  const { user, getAuthHeader, signOut } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [accounts, setAccounts] = useState<LinkedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [switchDialogOpen, setSwitchDialogOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<LinkedAccount | null>(null)
  const [switchPassword, setSwitchPassword] = useState("")
  const [switching, setSwitching] = useState(false)
  const [adding, setAdding] = useState(false)
  const [maxAccounts, setMaxAccounts] = useState(2)

  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")

  const fetchAccounts = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch("/api/accounts", { headers: getAuthHeader() })
      const data = await res.json()
      if (data.success) {
        setAccounts(data.accounts || [])
        setMaxAccounts(data.max_accounts || 2)
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err)
    } finally {
      setLoading(false)
    }
  }, [user, getAuthHeader])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const handleAddAccount = async () => {
    if (!newEmail || !newPassword) {
      toast({ title: "Missing fields", description: "Enter email and password", variant: "destructive" })
      return
    }
    setAdding(true)
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ email: newEmail, password: newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Account linked!", description: `${data.account.display_name || data.account.username} has been added` })
        setAddDialogOpen(false)
        setNewEmail("")
        setNewPassword("")
        await fetchAccounts()
      } else {
        toast({ title: "Failed", description: data.error || "Could not link account", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" })
    } finally {
      setAdding(false)
    }
  }

  const handleSwitchAccount = async () => {
    if (!switchTarget || !switchPassword) {
      toast({ title: "Password required", description: "Enter the password for this account", variant: "destructive" })
      return
    }
    setSwitching(true)
    try {
      const res = await fetch("/api/accounts/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: switchTarget.id, password: switchPassword }),
      })
      const data = await res.json()
      if (data.success && data.session) {
        // Store the new session and refresh the page to re-authenticate
        // Use the auth client to set the new session
        const { authClient } = await import("@/lib/auth-client")
        await authClient.signIn.email({
          email: switchTarget.username ? `${switchTarget.username}@loop.link` : "",
          password: switchPassword,
        }).catch(async () => {
          // Fallback: use the raw session tokens
          if (typeof window !== "undefined") {
            localStorage.setItem("loop-switch-session", JSON.stringify(data.session))
          }
        })

        toast({ title: "Switched!", description: `Now using ${switchTarget.display_name || switchTarget.username}` })
        setSwitchDialogOpen(false)
        setSwitchPassword("")
        setSwitchTarget(null)
        window.location.reload()
      } else {
        toast({ title: "Switch failed", description: data.error || "Invalid password", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" })
    } finally {
      setSwitching(false)
    }
  }

  const handleRemoveAccount = async (account: LinkedAccount) => {
    if (!confirm(`Remove ${account.display_name || account.username}?`)) return
    try {
      const res = await fetch("/api/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ linked_user_id: account.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Unlinked", description: "Account has been removed" })
        await fetchAccounts()
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove account", variant: "destructive" })
    }
  }

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  // Settings variant — full inline section
  if (variant === "settings") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Accounts
            </h3>
            <p className="text-sm text-muted-foreground">
              Manage and switch between your accounts
              {user?.is_premium && (
                <Badge variant="secondary" className="ml-2">
                  <Crown className="h-3 w-3 mr-1" /> Pro: Up to 10
                </Badge>
              )}
            </p>
          </div>
          {accounts.length < maxAccounts && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Account
            </Button>
          )}
        </div>

        {/* Account list */}
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading accounts...
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No accounts found</div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  account.is_primary
                    ? "border-primary/50 bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <VideoAvatar
                  src={account.avatar_url}
                  videoSrc={account.video_avatar_url}
                  isPremium={account.is_premium}
                  fallback={getInitials(account.display_name || account.username || "?")}
                  alt={account.display_name || account.username}
                  size="md"
                  className="h-10 w-10 rounded-full"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{account.display_name || account.username}</span>
                    {account.is_verified && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        ✓
                      </Badge>
                    )}
                    {account.is_primary && (
                      <Badge variant="default" className="text-xs">Primary</Badge>
                    )}
                    {!account.is_primary && !account.is_primary && (
                      <Badge variant="outline" className="text-xs">Linked</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">@{account.username}</span>
                </div>
                {!account.is_primary && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveAccount(account)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {!loading && accounts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {accounts.length}/{maxAccounts} accounts used
          </p>
        )}

        {/* Add Account Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
              <DialogDescription>
                Link another Loop account. Enter the account&apos;s email and password.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="add-email">Email</Label>
                <Input
                  id="add-email"
                  type="email"
                  placeholder="account@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="add-password">Password</Label>
                <Input
                  id="add-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddAccount} disabled={adding}>
                  {adding ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                  {adding ? "Linking..." : "Link Account"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Switch Account Dialog */}
        <Dialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Switch Account</DialogTitle>
              <DialogDescription>
                Enter the password for {switchTarget?.display_name || switchTarget?.username} to switch.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="switch-password">Password</Label>
                <Input
                  id="switch-password"
                  type="password"
                  placeholder="••••••••"
                  value={switchPassword}
                  onChange={(e) => setSwitchPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSwitchAccount()}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setSwitchDialogOpen(false); setSwitchPassword("") }}>
                  Cancel
                </Button>
                <Button onClick={handleSwitchAccount} disabled={switching}>
                  {switching ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />}
                  {switching ? "Switching..." : "Switch"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Dropdown variant — compact for header
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2">
            <Users className="h-4 w-4" />
            <span className="text-xs hidden sm:inline">Accounts</span>
            {accounts.length > 1 && (
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {accounts.length}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Switch Account
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {loading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <RefreshCw className="h-3 w-3 animate-spin" /> Loading...
            </div>
          ) : (
            accounts.map((account) => (
              <DropdownMenuItem
                key={account.id}
                className="flex items-center gap-3 cursor-pointer py-2"
                onClick={() => {
                  if (account.is_primary) return
                  setSwitchTarget(account)
                  setSwitchDialogOpen(true)
                }}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={account.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {getInitials(account.display_name || account.username || "?")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{account.display_name || account.username}</div>
                  <div className="text-xs text-muted-foreground">@{account.username}</div>
                </div>
                {account.is_primary && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setAddDialogOpen(true)}
            disabled={accounts.length >= maxAccounts}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Account</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {accounts.length}/{maxAccounts}
            </span>
          </DropdownMenuItem>
          {accounts.length >= maxAccounts && !user?.is_premium && (
            <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-primary" onClick={() => router.push("/settings")}>
              <Crown className="h-4 w-4" />
              <span className="text-sm">Upgrade for more</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add Account Dialog (reused) */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>
              Link another Loop account. Enter the account&apos;s email and password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="add-email-dd">Email</Label>
              <Input
                id="add-email-dd"
                type="email"
                placeholder="account@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-password-dd">Password</Label>
              <Input
                id="add-password-dd"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAccount} disabled={adding}>
                {adding ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                {adding ? "Linking..." : "Link Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Switch Account Dialog (reused) */}
      <Dialog open={switchDialogOpen} onOpenChange={setSwitchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch Account</DialogTitle>
            <DialogDescription>
              Enter the password for <strong>{switchTarget?.display_name || switchTarget?.username}</strong> to switch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="switch-password-dd">Password</Label>
              <Input
                id="switch-password-dd"
                type="password"
                placeholder="••••••••"
                value={switchPassword}
                onChange={(e) => setSwitchPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSwitchAccount()}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setSwitchDialogOpen(false); setSwitchPassword("") }}>
                Cancel
              </Button>
              <Button onClick={handleSwitchAccount} disabled={switching}>
                {switching ? <RefreshCw className="h-4 w-4 animate-spin mr-1" /> : <Users className="h-4 w-4 mr-1" />}
                {switching ? "Switching..." : "Switch"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/skeletons"
import { ProxyImg } from "@/components/ui/proxy-img"
import {
  Coins,
  Crown,
  History,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Pencil,
  Save,
  CreditCard,
  ScrollText,
  DollarSign,
  RefreshCw,
  X,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface PricingTier {
  id: string
  name: string
  description: string | null
  price_usd: number | null
  item_data: { coins_amount?: number; bonus?: number } | null
  rarity: string
  is_active: boolean
  purchase_count: number
  sort_order: number | null
}

interface PricingChange {
  id: string
  tier_name: string | null
  old_price: number
  new_price: number
  reason: string | null
  created_at: string
}

interface CoinTx {
  id: string
  amount: number
  transaction_type: string
  description: string | null
  created_at: string
}

interface CoinUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  loop_coins: number
  is_banned?: boolean
  is_premium?: boolean
}

interface WalletTx {
  id: string
  amount_usd: number | null
  coins_amount: number | null
  type: string
  description: string | null
  payment_method: string | null
  created_at: string
}

interface SubProfile {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_premium: boolean
  premium_expires_at: string | null
  premium_source: string | null
}

interface SubRow {
  id: string
  plan_type: string
  status: string
  source: string | null
  amount: number
  current_period_end: string
  created_at: string
}

interface AuditEntry {
  id: string
  action: string
  reason: string | null
  details: any
  created_at: string
  admin: { username: string; display_name: string; avatar_url?: string } | null
  target: { username: string; display_name: string; avatar_url?: string } | null
}

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  coin_pricing_create: { label: "Pricing created", className: "bg-emerald-500/10 text-emerald-500" },
  coin_pricing_update: { label: "Pricing updated", className: "bg-amber-500/10 text-amber-500" },
  coin_pricing_delete: { label: "Pricing deleted", className: "bg-red-500/10 text-red-500" },
  coin_pricing_deactivate: { label: "Pricing deactivated", className: "bg-orange-500/10 text-orange-500" },
  coin_adjust: { label: "Coins adjusted", className: "bg-yellow-500/10 text-yellow-600" },
  coin_tx_edit: { label: "Transaction edited", className: "bg-blue-500/10 text-blue-500" },
  coin_tx_delete: { label: "Transaction deleted", className: "bg-red-500/10 text-red-500" },
  premium_grant: { label: "Pro granted", className: "bg-violet-500/10 text-violet-500" },
  premium_revoke: { label: "Pro revoked", className: "bg-red-500/10 text-red-500" },
  premium_edit: { label: "Pro edited", className: "bg-blue-500/10 text-blue-500" },
  audit_entry_delete: { label: "Audit entry removed", className: "bg-muted text-muted-foreground" },
}

const rarityStyles: Record<string, string> = {
  common: "border-slate-400/40",
  rare: "border-blue-500/40",
  epic: "border-purple-500/40",
  legendary: "border-amber-500/40",
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtCoins(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString()
}

/* ------------------------------------------------------------------ */
/* Panel                                                               */
/* ------------------------------------------------------------------ */

export function AdminMonetizationPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-violet-500/20 text-amber-500">
          <Coins className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold">Monetization Management</h3>
          <p className="text-xs text-muted-foreground">
            Coin pricing, user balances, Pro subscriptions, and the full audit trail. Every action here is logged.
          </p>
        </div>
      </div>

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          <TabsTrigger value="pricing" className="gap-1.5 rounded-lg text-xs">
            <DollarSign className="h-3.5 w-3.5" /> Pricing
          </TabsTrigger>
          <TabsTrigger value="coins" className="gap-1.5 rounded-lg text-xs">
            <Coins className="h-3.5 w-3.5" /> User coins
          </TabsTrigger>
          <TabsTrigger value="subs" className="gap-1.5 rounded-lg text-xs">
            <Crown className="h-3.5 w-3.5" /> Pro / Premium
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 rounded-lg text-xs">
            <ScrollText className="h-3.5 w-3.5" /> Audit log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-4">
          <PricingTab getAuthHeader={getAuthHeader} toast={toast} />
        </TabsContent>
        <TabsContent value="coins" className="mt-4">
          <CoinsTab getAuthHeader={getAuthHeader} toast={toast} />
        </TabsContent>
        <TabsContent value="subs" className="mt-4">
          <SubscriptionsTab getAuthHeader={getAuthHeader} toast={toast} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab getAuthHeader={getAuthHeader} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Pricing tab                                                         */
/* ------------------------------------------------------------------ */

type AuthHeaderFn = () => Record<string, string>
type ToastFn = ReturnType<typeof useToast>["toast"]

function PricingTab({ getAuthHeader, toast }: { getAuthHeader: AuthHeaderFn; toast: ToastFn }) {
  const [tiers, setTiers] = useState<PricingTier[]>([])
  const [history, setHistory] = useState<PricingChange[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PricingTier | null>(null)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<PricingTier | null>(null)
  const [deleteReason, setDeleteReason] = useState("")

  // form state
  const [name, setName] = useState("")
  const [coinsAmount, setCoinsAmount] = useState("1000")
  const [bonus, setBonus] = useState("0")
  const [priceUsd, setPriceUsd] = useState("4.99")
  const [rarity, setRarity] = useState("common")
  const [isActive, setIsActive] = useState(true)
  const [reason, setReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/monetization/pricing", { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setTiers(data.tiers || [])
        setHistory(data.history || [])
      } else {
        throw new Error(data.error || "Failed to load pricing")
      }
    } catch (e: any) {
      toast({ title: "Load failed", description: e.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setName("")
    setCoinsAmount("1000")
    setBonus("0")
    setPriceUsd("4.99")
    setRarity("common")
    setIsActive(true)
    setReason("")
    setCreating(true)
  }

  const openEdit = (t: PricingTier) => {
    setEditing(t)
    setName(t.name)
    setCoinsAmount(String(t.item_data?.coins_amount ?? 0))
    setBonus(String(t.item_data?.bonus ?? 0))
    setPriceUsd(String(t.price_usd ?? ""))
    setRarity(t.rarity || "common")
    setIsActive(t.is_active !== false)
    setReason("")
    setCreating(true)
  }

  const handleSave = async () => {
    const payload = {
      id: editing?.id,
      name,
      coins_amount: Number(coinsAmount),
      bonus: Number(bonus || 0),
      price_usd: Number(priceUsd),
      rarity,
      is_active: isActive,
      reason,
    }
    if (!payload.name.trim()) return toast({ title: "Name required", variant: "destructive" })
    if (!payload.coins_amount || payload.coins_amount <= 0)
      return toast({ title: "Coins amount must be positive", variant: "destructive" })
    if (!payload.price_usd || payload.price_usd < 0.5)
      return toast({ title: "Price must be at least $0.50", variant: "destructive" })

    setSaving(true)
    try {
      const res = await fetch("/api/admin/monetization/pricing", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({
        title: editing ? "Package updated" : "Package created",
        description: `${payload.name} — $${payload.price_usd.toFixed(2)}. Purchases now charge the new price immediately.`,
      })
      setCreating(false)
      void load()
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      const res = await fetch(
        `/api/admin/monetization/pricing?id=${deleting.id}&reason=${encodeURIComponent(deleteReason || "No reason given")}`,
        { method: "DELETE", headers: getAuthHeader() },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast({
        title: data.soft_deleted ? "Package deactivated" : "Package deleted",
        description: data.soft_deleted ? "It had purchase history, so it was hidden instead." : undefined,
      })
      setDeleting(null)
      setDeleteReason("")
      void load()
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          These tiers drive the actual Stripe checkout amount — edits take effect immediately, no deploy needed.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} className="rounded-xl text-xs">
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={openCreate} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-xs text-white">
            <Plus className="mr-1 h-3.5 w-3.5" /> New package
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-10 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Loading packages…
        </div>
      ) : (
        <div className="grid gap-2">
          {tiers.map((t) => {
            const total = (t.item_data?.coins_amount ?? 0) + (t.item_data?.bonus ?? 0)
            return (
              <div
                key={t.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3",
                  rarityStyles[t.rarity] || "border-border/60",
                  !t.is_active && "opacity-50",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 text-lg">
                  {(t.item_data?.coins_amount ?? 0) >= 10000 ? "👑" : (t.item_data?.coins_amount ?? 0) >= 1000 ? "💎" : "🪙"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{t.name}</p>
                    {!t.is_active && <Badge variant="secondary" className="text-[9px]">Inactive</Badge>}
                    {t.purchase_count > 0 && (
                      <Badge variant="secondary" className="text-[9px]">{t.purchase_count} sold</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtCoins(total)} coins
                    {(t.item_data?.bonus ?? 0) > 0 && <> (incl. +{fmtCoins(t.item_data?.bonus)} bonus)</>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-black text-emerald-500">${Number(t.price_usd ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => openEdit(t)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" title="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDeleting(t); setDeleteReason("") }}
                    className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
          {tiers.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No coin packages yet — create the first one.
            </div>
          )}
        </div>
      )}

      {/* Price change history */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold">
          <History className="h-4 w-4 text-muted-foreground" /> Price change history
        </h4>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">No price changes recorded yet.</p>
        ) : (
          <div className="space-y-1.5">
            {history.slice(0, 12).map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="font-semibold">{h.tier_name || "Package"}</span>
                <span className="text-muted-foreground line-through">${Number(h.old_price).toFixed(2)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-emerald-500">${Number(h.new_price).toFixed(2)}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{fmtDate(h.created_at)}</span>
                {h.reason && <span className="w-full text-[10px] italic text-muted-foreground">Reason: {h.reason}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / edit dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "New coin package"}</DialogTitle>
            <DialogDescription>
              Saving a price change updates the live Stripe checkout amount instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold">Package name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mega Pack" className="mt-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Coins</Label>
                <Input
                  type="number"
                  min={1}
                  value={coinsAmount}
                  onChange={(e) => setCoinsAmount(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Bonus coins</Label>
                <Input type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} className="mt-1 rounded-xl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Price (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0.5}
                  value={priceUsd}
                  onChange={(e) => setPriceUsd(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Rarity</Label>
                <select
                  value={rarity}
                  onChange={(e) => setRarity(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-sm"
                >
                  <option value="common">Common</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
              <p className="text-xs font-semibold">Active (visible in shop)</p>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Reason for this change (logged)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="e.g. Adjusted margins for Q4 promo"
                className="mt-1 resize-none rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreating(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
              {editing ? "Save changes" : "Create package"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>
              {Number(deleting?.purchase_count ?? 0) > 0
                ? "This package has purchase history — it will be deactivated (hidden) instead of deleted so past receipts stay valid."
                : "This package has no purchases and will be permanently removed."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            rows={2}
            placeholder="Reason (required, audit-logged)"
            className="resize-none rounded-xl"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleting(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleDelete} variant="destructive" className="rounded-xl">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Coins tab                                                           */
/* ------------------------------------------------------------------ */

function CoinsTab({ getAuthHeader, toast }: { getAuthHeader: AuthHeaderFn; toast: ToastFn }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CoinUser[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<CoinUser | null>(null)
  const [txs, setTxs] = useState<CoinTx[]>([])
  const [walletTxs, setWalletTxs] = useState<WalletTx[]>([])
  const [loadingTxs, setLoadingTxs] = useState(false)

  // adjust state
  const [adjustAmount, setAdjustAmount] = useState("")
  const [adjustReason, setAdjustReason] = useState("")
  const [adjusting, setAdjusting] = useState(false)

  // edit state
  const [editTx, setEditTx] = useState<CoinTx | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [editReason, setEditReason] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  // delete state
  const [deleteTx, setDeleteTx] = useState<CoinTx | null>(null)
  const [deleteReason, setDeleteReason] = useState("")
  const [deletingTx, setDeletingTx] = useState(false)

  const searchTimer = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), [])

  const searchUsers = useCallback(
    (q: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(async () => {
        if (!q.trim()) return setResults([])
        setSearching(true)
        try {
          const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&limit=8`, { headers: getAuthHeader() })
          const data = await res.json().catch(() => ({}))
          setResults(data.users || [])
        } catch {
          setResults([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const loadUser = useCallback(
    async (u: CoinUser) => {
      setSelected(u)
      setLoadingTxs(true)
      setTxs([])
      setWalletTxs([])
      try {
        const res = await fetch(`/api/admin/monetization/coins?user_id=${u.id}`, { headers: getAuthHeader() })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load")
        setTxs(data.transactions || [])
        setWalletTxs(data.wallet_transactions || [])
        setSelected(data.profile)
      } catch (e: any) {
        toast({ title: "Load failed", description: e.message, variant: "destructive" })
      } finally {
        setLoadingTxs(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const handleAdjust = async () => {
    if (!selected) return
    const amount = Number(adjustAmount)
    if (!amount || Number.isNaN(amount)) return toast({ title: "Enter an amount (negative to deduct)", variant: "destructive" })
    if (!adjustReason.trim()) return toast({ title: "A reason is required", variant: "destructive" })
    setAdjusting(true)
    try {
      const res = await fetch("/api/admin/monetization/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: selected.id, amount: Math.floor(amount), reason: adjustReason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Adjust failed")
      toast({ title: `Balance updated`, description: `New balance: ${fmtCoins(data.new_balance)} coins` })
      setAdjustAmount("")
      setAdjustReason("")
      await loadUser(selected)
    } catch (e: any) {
      toast({ title: "Adjust failed", description: e.message, variant: "destructive" })
    } finally {
      setAdjusting(false)
    }
  }

  const openEditTx = (tx: CoinTx) => {
    setEditTx(tx)
    setEditAmount(String(tx.amount))
    setEditDesc(tx.description || "")
    setEditReason("")
  }

  const handleEditTx = async () => {
    if (!editTx) return
    if (!editReason.trim()) return toast({ title: "A reason is required", variant: "destructive" })
    setSavingEdit(true)
    try {
      const res = await fetch("/api/admin/monetization/coins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          transaction_id: editTx.id,
          amount: Number(editAmount),
          description: editDesc,
          reason: editReason,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Edit failed")
      toast({ title: "Transaction corrected", description: "The user's balance was adjusted to match." })
      setEditTx(null)
      if (selected) await loadUser(selected)
    } catch (e: any) {
      toast({ title: "Edit failed", description: e.message, variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteTx = async () => {
    if (!deleteTx) return
    if (!deleteReason.trim()) return toast({ title: "A reason is required", variant: "destructive" })
    setDeletingTx(true)
    try {
      const res = await fetch(
        `/api/admin/monetization/coins?transaction_id=${deleteTx.id}&reason=${encodeURIComponent(deleteReason)}`,
        { method: "DELETE", headers: getAuthHeader() },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      toast({ title: "Transaction deleted", description: `Balance reversal applied — new balance ${fmtCoins(data.new_balance)}.` })
      setDeleteTx(null)
      if (selected) await loadUser(selected)
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" })
    } finally {
      setDeletingTx(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            searchUsers(e.target.value)
          }}
          placeholder="Search users by name, @username, or email…"
          className="rounded-xl pl-9"
        />
        {searching && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
      </div>

      {results.length > 0 && !selected && (
        <div className="space-y-1.5">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => void loadUser(u)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5 text-left hover:bg-muted/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                {u.avatar_url ? <ProxyImg src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.display_name || u.username || "U").charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{u.display_name || u.username}</span>
                <span className="block truncate text-[10px] text-muted-foreground">@{u.username}</span>
              </span>
              <span className="shrink-0 text-xs font-bold text-yellow-500">{fmtCoins(u.loop_coins)} 🪙</span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          {/* User header */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card p-4">
            <button type="button" onClick={() => { setSelected(null); setTxs([]); setWalletTxs([]) }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" title="Back to search">
              <X className="h-4 w-4" />
            </button>
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold">
              {selected.avatar_url ? <ProxyImg src={selected.avatar_url} alt="" className="h-full w-full object-cover" /> : (selected.display_name || selected.username || "U").charAt(0)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{selected.display_name || selected.username}</p>
              <p className="text-[11px] text-muted-foreground">@{selected.username}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-yellow-500">{fmtCoins(selected.loop_coins)}</p>
              <p className="text-[10px] text-muted-foreground">current balance</p>
            </div>
          </div>

          {/* Manual adjust */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="mb-2 text-sm font-bold">Manually adjust balance</h4>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Amount (+/−)"
                className="rounded-xl"
              />
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Reason (required, audit-logged)"
                className="rounded-xl"
              />
              <Button onClick={handleAdjust} disabled={adjusting} className="rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 text-white">
                {adjusting ? <Spinner className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
              </Button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Use a negative amount to deduct. Deductions can't take the balance below zero.</p>
          </div>

          {/* Transaction history */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold">
              <History className="h-4 w-4 text-muted-foreground" /> Coin transaction history
            </h4>
            {loadingTxs ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading…
              </div>
            ) : txs.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No coin transactions recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {txs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                    <span className={cn("w-16 shrink-0 text-right font-bold", tx.amount >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {tx.amount >= 0 ? "+" : ""}{fmtCoins(tx.amount)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{tx.description || tx.transaction_type}</span>
                      <span className="block text-[10px] text-muted-foreground">{tx.transaction_type} · {fmtDate(tx.created_at)}</span>
                    </span>
                    <button type="button" onClick={() => openEditTx(tx)} className="rounded p-1.5 text-muted-foreground hover:bg-muted" title="Edit">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => { setDeleteTx(tx); setDeleteReason("") }} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stripe wallet history (read-only) */}
          {walletTxs.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <CreditCard className="h-4 w-4 text-muted-foreground" /> Stripe purchases (read-only)
              </h4>
              <div className="space-y-1.5">
                {walletTxs.map((w) => (
                  <div key={w.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                    <span className="w-16 shrink-0 text-right font-bold text-emerald-500">{w.coins_amount ? `+${fmtCoins(w.coins_amount)}` : "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{w.description || w.type}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        ${Number(w.amount_usd || 0).toFixed(2)} via {w.payment_method || "stripe"} · {fmtDate(w.created_at)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!selected && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Search for a user to view their balance and transaction history.
        </div>
      )}

      {/* Edit tx dialog */}
      <Dialog open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Correct transaction</DialogTitle>
            <DialogDescription>
              Changing the amount adjusts the user's balance by the difference so the ledger stays accurate.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold">Amount (signed)</Label>
              <Input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Description</Label>
              <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Reason (required, audit-logged)</Label>
              <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2} className="mt-1 resize-none rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditTx(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleEditTx} disabled={savingEdit} className="rounded-xl">
              {savingEdit ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete tx dialog */}
      <Dialog open={!!deleteTx} onOpenChange={(o) => !o && setDeleteTx(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete transaction?</DialogTitle>
            <DialogDescription>
              The user's balance will be reversed by {deleteTx ? fmtCoins(deleteTx.amount) : ""} coins to keep the ledger consistent. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} rows={2} placeholder="Reason (required, audit-logged)" className="resize-none rounded-xl" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTx(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleDeleteTx} disabled={deletingTx} variant="destructive" className="rounded-xl">
              {deletingTx ? <Spinner className="mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Subscriptions tab                                                   */
/* ------------------------------------------------------------------ */

function SubscriptionsTab({ getAuthHeader, toast }: { getAuthHeader: AuthHeaderFn; toast: ToastFn }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CoinUser[]>([])
  const [searching, setSearching] = useState(false)
  const [profile, setProfile] = useState<SubProfile | null>(null)
  const [subs, setSubs] = useState<SubRow[]>([])
  const [loading, setLoading] = useState(false)

  // grant state
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantPlan, setGrantPlan] = useState("monthly")
  const [grantMonths, setGrantMonths] = useState("1")
  const [grantReason, setGrantReason] = useState("")
  const [granting, setGranting] = useState(false)

  // edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editDate, setEditDate] = useState("")
  const [editReason, setEditReason] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)

  // revoke state
  const [revokeOpen, setRevokeOpen] = useState(false)
  const [revokeReason, setRevokeReason] = useState("")
  const [revoking, setRevoking] = useState(false)

  const searchTimer = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), [])

  const searchUsers = useCallback(
    (q: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
      searchTimer.current = setTimeout(async () => {
        if (!q.trim()) return setResults([])
        setSearching(true)
        try {
          const res = await fetch(`/api/admin/users?search=${encodeURIComponent(q)}&limit=8`, { headers: getAuthHeader() })
          const data = await res.json().catch(() => ({}))
          setResults(data.users || [])
        } catch {
          setResults([])
        } finally {
          setSearching(false)
        }
      }, 300)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const loadUser = useCallback(
    async (u: CoinUser) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/monetization/subscriptions?user_id=${u.id}`, { headers: getAuthHeader() })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || "Failed to load")
        setProfile(data.profile)
        setSubs(data.subscriptions || [])
        setResults([])
        setQuery("")
      } catch (e: any) {
        toast({ title: "Load failed", description: e.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const handleGrant = async () => {
    if (!profile) return
    if (!grantReason.trim()) return toast({ title: "A reason is required", variant: "destructive" })
    setGranting(true)
    try {
      const res = await fetch("/api/admin/monetization/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          user_id: profile.id,
          action: "grant",
          plan_type: grantPlan,
          months: Number(grantMonths) || 1,
          reason: grantReason,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Grant failed")
      toast({ title: "Pro granted 🎉", description: `Active until ${fmtDate(data.expires_at)} — marked as admin-granted.` })
      setGrantOpen(false)
      setGrantReason("")
      await loadUser({ ...profile, loop_coins: 0 })
    } catch (e: any) {
      toast({ title: "Grant failed", description: e.message, variant: "destructive" })
    } finally {
      setGranting(false)
    }
  }

  const handleEdit = async () => {
    if (!profile) return
    if (!editReason.trim()) return toast({ title: "A reason is required", variant: "destructive" })
    setSavingEdit(true)
    try {
      const res = await fetch("/api/admin/monetization/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: profile.id, expires_at: new Date(editDate).toISOString(), reason: editReason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Edit failed")
      toast({ title: "Expiry updated", description: `Now active until ${fmtDate(data.expires_at)}` })
      setEditOpen(false)
      setEditReason("")
      await loadUser({ ...profile, loop_coins: 0 })
    } catch (e: any) {
      toast({ title: "Edit failed", description: e.message, variant: "destructive" })
    } finally {
      setSavingEdit(false)
    }
  }

  const handleRevoke = async () => {
    if (!profile) return
    if (!revokeReason.trim()) return toast({ title: "A reason is required", variant: "destructive" })
    setRevoking(true)
    try {
      const res = await fetch("/api/admin/monetization/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ user_id: profile.id, action: "revoke", reason: revokeReason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Revoke failed")
      toast({ title: "Pro revoked" })
      setRevokeOpen(false)
      setRevokeReason("")
      await loadUser({ ...profile, loop_coins: 0 })
    } catch (e: any) {
      toast({ title: "Revoke failed", description: e.message, variant: "destructive" })
    } finally {
      setRevoking(false)
    }
  }

  const isStripePaid = profile?.premium_source !== "admin" && profile?.is_premium
  const isExpired = profile?.is_premium && profile?.premium_expires_at ? new Date(profile.premium_expires_at) <= new Date() : false

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            searchUsers(e.target.value)
          }}
          placeholder="Search users to view or manage their Pro status…"
          className="rounded-xl pl-9"
        />
        {searching && <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />}
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => void loadUser(u)}
              className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-card p-2.5 text-left hover:bg-muted/50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold">
                {u.avatar_url ? <ProxyImg src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : (u.display_name || u.username || "U").charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{u.display_name || u.username}</span>
                <span className="block truncate text-[10px] text-muted-foreground">@{u.username}</span>
              </span>
              {u.is_premium && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
            </button>
          ))}
        </div>
      )}

      {loading && !profile && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Loading…
        </div>
      )}

      {profile && (
        <div className="space-y-4">
          {/* Status card */}
          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold">
                {profile.avatar_url ? <ProxyImg src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.display_name || profile.username || "U").charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{profile.display_name || profile.username}</p>
                <p className="text-[11px] text-muted-foreground">@{profile.username}</p>
              </div>
              {profile.is_premium && !isExpired ? (
                <Badge className={cn("gap-1 border font-bold", isStripePaid ? "border-amber-500/40 bg-amber-500/10 text-amber-500" : "border-violet-500/40 bg-violet-500/10 text-violet-500")}>
                  {isStripePaid ? <><CreditCard className="h-3 w-3" /> Stripe-paid Pro</> : <><ShieldCheck className="h-3 w-3" /> Admin-granted Pro</>}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">No active Pro</Badge>
              )}
              {isExpired && <Badge variant="secondary" className="bg-red-500/10 text-red-500 text-xs">Expired</Badge>}
            </div>
            {profile.is_premium && (
              <div className="mt-3 grid gap-1 rounded-xl bg-muted/40 px-3 py-2 text-xs sm:grid-cols-2">
                <p><span className="text-muted-foreground">Renews / expires:</span> <span className="font-semibold">{fmtDate(profile.premium_expires_at)}</span></p>
                <p><span className="text-muted-foreground">Source:</span> <span className="font-semibold">{profile.premium_source === "admin" ? "Admin grant" : "Stripe billing"}</span></p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => { setGrantPlan("monthly"); setGrantMonths("1"); setGrantReason(""); setGrantOpen(true) }} className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-xs text-white">
                <Crown className="mr-1.5 h-3.5 w-3.5" /> {profile.is_premium ? "Extend Pro" : "Grant Pro"}
              </Button>
              {profile.is_premium && profile.premium_source === "admin" && (
                <Button size="sm" variant="outline" onClick={() => { setEditDate(profile.premium_expires_at ? new Date(profile.premium_expires_at).toISOString().slice(0, 16) : ""); setEditReason(""); setEditOpen(true) }} className="rounded-xl text-xs">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit expiry
                </Button>
              )}
              {profile.is_premium && (
                <Button size="sm" variant="outline" onClick={() => { setRevokeReason(""); setRevokeOpen(true) }} className="rounded-xl text-xs text-destructive hover:bg-destructive/10">
                  <X className="mr-1.5 h-3.5 w-3.5" /> Revoke
                </Button>
              )}
            </div>
            {isStripePaid && profile.is_premium && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Stripe-paid Pro can be extended (adds time on top) but not edited or revoked here — cancel via Stripe to stop billing first.
              </p>
            )}
          </div>

          {/* Subscription history */}
          {subs.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <h4 className="mb-2 flex items-center gap-2 text-sm font-bold">
                <History className="h-4 w-4 text-muted-foreground" /> Subscription history
              </h4>
              <div className="space-y-1.5">
                {subs.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs">
                    <Badge variant="secondary" className="text-[9px] uppercase">{s.source === "admin" ? "admin grant" : "stripe"}</Badge>
                    <span className="font-semibold">{s.plan_type}</span>
                    <span className={cn("font-medium", s.status === "active" ? "text-emerald-500" : "text-muted-foreground")}>{s.status}</span>
                    <span className="text-muted-foreground">until {fmtDate(s.current_period_end)}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{fmtDate(s.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!profile && results.length === 0 && !loading && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Search for a user to view their Pro status, source, and renewal date.
        </div>
      )}

      {/* Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{profile?.is_premium ? "Extend Pro" : "Grant Pro"}</DialogTitle>
            <DialogDescription>
              {profile?.is_premium
                ? "Time is added on top of the current expiry. This marks the membership as admin-granted."
                : "Grants Pro independent of Stripe billing. The user sees 'Pro' everywhere in the app."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold">Plan</Label>
              <select value={grantPlan} onChange={(e) => setGrantPlan(e.target.value)} className="mt-1 h-9 w-full rounded-xl border border-border bg-background px-2 text-sm">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual (1 year)</option>
              </select>
            </div>
            {grantPlan === "monthly" && (
              <div>
                <Label className="text-xs font-semibold">Months</Label>
                <Input type="number" min={1} max={36} value={grantMonths} onChange={(e) => setGrantMonths(e.target.value)} className="mt-1 rounded-xl" />
              </div>
            )}
            <div>
              <Label className="text-xs font-semibold">Reason (required, audit-logged)</Label>
              <Textarea value={grantReason} onChange={(e) => setGrantReason(e.target.value)} rows={2} placeholder="e.g. Creator program reward" className="mt-1 resize-none rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setGrantOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleGrant} disabled={granting} className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white">
              {granting ? <Spinner className="mr-2 h-4 w-4" /> : <Crown className="mr-2 h-4 w-4" />} {profile?.is_premium ? "Extend" : "Grant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit expiry dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Pro expiry</DialogTitle>
            <DialogDescription>Extend or shorten the manually-granted Pro period.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold">New expiry date</Label>
              <Input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Reason (required, audit-logged)</Label>
              <Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={2} className="mt-1 resize-none rounded-xl" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleEdit} disabled={savingEdit} className="rounded-xl">
              {savingEdit ? <Spinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke dialog */}
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Revoke Pro?</DialogTitle>
            <DialogDescription>
              {isStripePaid
                ? "This removes Pro access immediately. Stripe billing continues — cancel the subscription in Stripe to stop charges."
                : "The user loses Pro access immediately. This is audit-logged with your reason."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={revokeReason} onChange={(e) => setRevokeReason(e.target.value)} rows={2} placeholder="Reason (required, audit-logged)" className="resize-none rounded-xl" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevokeOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleRevoke} disabled={revoking} variant="destructive" className="rounded-xl">
              {revoking ? <Spinner className="mr-2 h-4 w-4" /> : <X className="mr-2 h-4 w-4" />} Revoke Pro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Audit tab                                                           */
/* ------------------------------------------------------------------ */

function AuditTab({ getAuthHeader }: { getAuthHeader: AuthHeaderFn }) {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/monetization/audit?limit=150", { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      setLogs(data.logs || [])
    } catch {
      setLogs([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Every coin, pricing, and Pro action with admin identity, timestamp, and reason.</p>
        <Button variant="outline" size="sm" onClick={() => void load()} className="rounded-xl text-xs">
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-10 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" /> Loading audit trail…
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No monetization actions logged yet.
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((l) => {
            const cfg = ACTION_LABELS[l.action] || { label: l.action, className: "bg-muted text-muted-foreground" }
            return (
              <div key={l.id} className="rounded-xl border border-border/60 bg-card p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className={cn("text-[9px] font-bold", cfg.className)}>{cfg.label}</Badge>
                  <span className="font-semibold">{l.admin?.display_name || l.admin?.username || "Admin"}</span>
                  {l.target && (
                    <>
                      <span className="text-muted-foreground">→</span>
                      <span>{l.target.display_name || l.target.username}</span>
                    </>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">{fmtDate(l.created_at)}</span>
                </div>
                {l.reason && <p className="mt-1 italic text-muted-foreground">Reason: {l.reason}</p>}
                {l.details && (typeof l.details === "object" ? Object.keys(l.details).length > 0 : !!l.details) && (
                  <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">{JSON.stringify(l.details)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

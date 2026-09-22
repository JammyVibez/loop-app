"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { DeviceMediaPicker, type PickedMedia } from "@/components/communities/device-media-picker"
import { timeAgo } from "@/lib/community-engine"
import { Spinner } from "@/components/ui/skeletons"
import {
  Bot,
  BotMessageSquare,
  
  Plus,
  Store,
  Activity,
  Settings2,
  Trash2,
  Copy,
  Check,
  Zap,
  KeyRound,
  ExternalLink,
  ShieldCheck,
  Globe2,
  Send,
  X,
  ArrowUpRight,
} from "lucide-react"

const CATEGORY_META: Record<string, { label: string; color: string; chip: string }> = {
  moderation: { label: "Moderation", color: "text-rose-500", chip: "bg-rose-500/10 border-rose-500/25" },
  welcome: { label: "Welcome", color: "text-emerald-500", chip: "bg-emerald-500/10 border-emerald-500/25" },
  notification: { label: "Notifications", color: "text-amber-500", chip: "bg-amber-500/10 border-amber-500/25" },
  ecommerce: { label: "Store", color: "text-orange-500", chip: "bg-orange-500/10 border-orange-500/25" },
  utility: { label: "Utility", color: "text-sky-500", chip: "bg-sky-500/10 border-sky-500/25" },
  ai: { label: "AI", color: "text-violet-500", chip: "bg-violet-500/10 border-violet-500/25" },
  games: { label: "Games", color: "text-fuchsia-500", chip: "bg-fuchsia-500/10 border-fuchsia-500/25" },
  custom: { label: "Custom", color: "text-slate-400", chip: "bg-slate-400/10 border-slate-400/25" },
}

interface BotOwner {
  id: string
  username: string
  display_name?: string
  avatar_url?: string | null
  is_verified?: boolean
}

interface Bot {
  id: string
  community_id: string
  owner_id: string
  name: string
  slug?: string | null
  description?: string | null
  avatar_url?: string | null
  category: string
  status: string
  deployment_type: string
  webhook_url?: string | null
  invite_link?: string | null
  source_url?: string | null
  auto_reply?: string | null
  commands: string[]
  secret_token?: string | null
  is_listed: boolean
  price_coins: number
  allows_hosted: boolean
  allows_source: boolean
  rating_sum: number
  rating_count: number
  purchase_count: number
  last_active_at?: string | null
  created_at: string
  owner?: BotOwner | null
  activity_count?: number
  chat_count?: number
}

interface ActivityRow {
  id: string
  type: string
  title: string
  message?: string | null
  created_at: string
  actor?: { id: string; username: string; display_name?: string; avatar_url?: string | null } | null
}

interface ChatMessage {
  id: string
  bot_id: string
  user_id?: string | null
  role: "user" | "bot"
  content: string
  created_at: string
  sender?: { id: string; username: string; display_name?: string; avatar_url?: string | null } | null
}

function BotAvatar({ bot, size = "md" }: { bot: Pick<Bot, "name" | "avatar_url">; size?: "sm" | "md" | "lg" }) {
  const px = size === "lg" ? "h-14 w-14 text-lg" : size === "md" ? "h-11 w-11 text-base" : "h-8 w-8 text-xs"
  return (
    <div className={cn("relative shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/20 flex items-center justify-center font-extrabold text-white", px)}>
      {bot.avatar_url ? (
        <Image src={bot.avatar_url} alt="" fill unoptimized className="object-cover" />
      ) : (
        <Bot className="h-1/2 w-1/2" />
      )}
    </div>
  )
}

function StatusDot({ status, online }: { status: string; online?: boolean }) {
  const isOnline = online ?? status === "online"
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {isOnline && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
      )}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-slate-600")} />
    </span>
  )
}

export function WorldBots({ communityId, isMember }: { communityId: string; isMember: boolean }) {
  const { user } = useAuth()
  const [bots, setBots] = useState<Bot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [category, setCategory] = useState("all")
  const [addOpen, setAddOpen] = useState(false)
  const [manageBot, setManageBot] = useState<Bot | null>(null)
  const [chatBot, setChatBot] = useState<Bot | null>(null)
  const [fabOpen, setFabOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/bots`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load bots")
      setBots(data.bots || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [communityId])

  useEffect(() => {
    load()
  }, [load])

  const categories = ["all", ...new Set(bots.map((b) => b.category))]
  const visible = category === "all" ? bots : bots.filter((b) => b.category === category)
  const owned = bots.filter((b) => b.owner_id === user?.id)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-card to-fuchsia-950/30 p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/30">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Bots</h2>
            <p className="text-xs text-muted-foreground">
              {bots.length} active {bots.length === 1 ? "bot" : "bots"} in this community
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full h-9">
            <Link href="/marketplace/bots">
              <Store className="h-3.5 w-3.5 mr-1.5" /> Bot Marketplace
            </Link>
          </Button>
          {isMember && (
            <Button size="sm" className="rounded-full h-9 bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:from-indigo-400 hover:to-fuchsia-400" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Bot
            </Button>
          )}
        </div>
      </div>

      {/* Category filters */}
      {categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                category === c
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "all" ? "All" : CATEGORY_META[c]?.label || c}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2.5 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card/40 p-10 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 border border-indigo-500/20">
            <Bot className="h-7 w-7 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-bold">No bots here yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Deploy a moderation helper, a welcome greeter, an AI companion or your own custom logic — then list it in the
              Marketplace to earn Loop Coins.
            </p>
          </div>
          {isMember && (
            <Button className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Deploy your first bot
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((bot) => {
            const meta = CATEGORY_META[bot.category] || CATEGORY_META.custom
            const isOwner = bot.owner_id === user?.id
            return (
              <div
                key={bot.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/10"
              >
                {bot.is_listed && (
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                    <Store className="h-2.5 w-2.5" /> {bot.price_coins} coins
                  </span>
                )}
                <div className="flex items-start gap-3">
                  <BotAvatar bot={bot} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold">{bot.name}</p>
                      <StatusDot status={bot.status} />
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {bot.description || "No description yet"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.chip, meta.color)}>
                    {meta.label}
                  </span>
                  <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                    {bot.deployment_type === "source" ? "Self-hostable" : "Hosted"}
                  </span>
                  {bot.commands.length > 0 && (
                    <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      {bot.commands.length} command{bot.commands.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {bot.owner && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      by @{bot.owner.username}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    className="h-8 flex-1 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white hover:from-indigo-400 hover:to-fuchsia-400 text-xs"
                    onClick={() => setChatBot(bot)}
                  >
                    <BotMessageSquare className="h-3.5 w-3.5 mr-1.5" /> Use Bot
                  </Button>
                  {isOwner && (
                    <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setManageBot(bot)}>
                      <Settings2 className="h-3.5 w-3.5 mr-1" /> Manage
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Activity strip — recent bot actions across the community */}
      {bots.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3.5 w-3.5 text-indigo-400" /> Recent bot activity
          </p>
          <div className="space-y-2">
            {bots.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center gap-2.5 text-xs">
                <StatusDot status={b.status} />
                <span className="font-semibold text-foreground">{b.name}</span>
                <span className="truncate text-muted-foreground">
                  {b.status === "online" ? "listening for commands" : "offline"}
                  {typeof b.activity_count === "number" && b.activity_count > 0 && ` · ${b.activity_count} actions`}
                  {typeof b.chat_count === "number" && b.chat_count > 0 && ` · ${b.chat_count} chats`}
                </span>
                {b.last_active_at && <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(b.last_active_at)}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating action button */}
      {isMember && (
        <div className="fixed bottom-24 right-4 z-40 sm:bottom-8 sm:right-8">
          {fabOpen && (
            <div className="mb-2 flex flex-col items-end gap-2">
              <Button
                size="sm"
                className="h-10 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-xl shadow-indigo-500/30"
                onClick={() => { setFabOpen(false); setAddOpen(true) }}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add Bot
              </Button>
              {owned.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 rounded-full bg-background/90 backdrop-blur"
                  onClick={() => { setFabOpen(false); setManageBot(owned[0]) }}
                >
                  <Store className="h-4 w-4 mr-1.5 text-amber-500" /> Sell Bot
                </Button>
              )}
            </div>
          )}
          <button
            onClick={() => setFabOpen((v) => !v)}
            aria-label="Bot actions"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 via-fuchsia-500 to-cyan-400 text-white shadow-2xl shadow-indigo-500/40 transition-transform hover:scale-105 active:scale-95"
          >
            {fabOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
          </button>
        </div>
      )}

      {/* Add / Manage dialogs */}
      {addOpen && (
        <BotFormDialog
          communityId={communityId}
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); load() }}
        />
      )}
      {manageBot && (
        <BotManageDialog bot={manageBot} onClose={() => setManageBot(null)} onSaved={() => { setManageBot(null); load() }} />
      )}
      {chatBot && (
        <BotChatDialog bot={chatBot} onClose={() => setChatBot(null)} isMember={isMember} />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Add Bot dialog                                                      */
/* ------------------------------------------------------------------ */

function BotFormDialog({ communityId, onClose, onSaved }: { communityId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("utility")
  const [deploymentType, setDeploymentType] = useState<"hosted" | "source">("hosted")
  const [webhookUrl, setWebhookUrl] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [autoReply, setAutoReply] = useState("")
  const [commands, setCommands] = useState("")
  const [avatarItems, setAvatarItems] = useState<PickedMedia[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const submit = async () => {
    if (!name.trim()) return setError("Name is required")
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description,
          category,
          deployment_type: deploymentType,
          webhook_url: webhookUrl.trim() || undefined,
          invite_link: inviteLink.trim() || undefined,
          source_url: sourceUrl.trim() || undefined,
          auto_reply: autoReply.trim() || undefined,
          commands: commands.split(",").map((c) => c.trim().replace(/^\/?/, "/")).filter(Boolean).slice(0, 50),
          avatar_url: avatarItems[0]?.url || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create bot")
      setSecret(data.secret_token)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (secret) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" /> Bot deployed!
            </DialogTitle>
            <DialogDescription>
              Copy this secret token now — it&apos;s the only key that can manage your bot. It won&apos;t be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <KeyRound className="h-4 w-4 shrink-0 text-amber-500" />
              <code className="min-w-0 flex-1 break-all font-mono text-xs">{secret}</code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => { navigator.clipboard.writeText(secret); setCopied(true) }}
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {webhookUrl.trim() && (
              <p className="text-[11px] text-muted-foreground">
                Point your bot&apos;s runtime at{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/bots/` : "/api/bots/"}
                  {"<botId>"}/webhook
                </code>{" "}
                and send <code className="font-mono">x-bot-secret</code> with every request.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => { onSaved(); onClose() }} className="rounded-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" /> Add a bot
          </DialogTitle>
          <DialogDescription>Deploy a live bot or drop in code buyers can self-host.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <DeviceMediaPicker items={avatarItems} onChange={setAvatarItems} maxItems={1} accept="image/*" compact folder="bot-avatars" />
            <div className="flex-1 space-y-1.5">
              <Label>Bot name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nova Guard" className="h-10 rounded-xl" maxLength={60} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this bot do?" className="mt-1 rounded-xl min-h-[70px] text-sm" maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {Object.entries(CATEGORY_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Deployment</Label>
              <select value={deploymentType} onChange={(e) => setDeploymentType(e.target.value as "hosted" | "source")} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="hosted">Hosted (live now)</option>
                <option value="source">Source (self-hostable)</option>
              </select>
            </div>
          </div>
          {deploymentType === "hosted" ? (
            <div className="space-y-2">
              <div>
                <Label>Webhook URL (your bot&apos;s endpoint)</Label>
                <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-host.com/loop-bot (optional)" className="mt-1 h-10 rounded-xl" />
              </div>
              <div>
                <Label>Invite link</Label>
                <Input value={inviteLink} onChange={(e) => setInviteLink(e.target.value)} placeholder="https://… invite or access link (optional)" className="mt-1 h-10 rounded-xl" />
              </div>
            </div>
          ) : (
            <div>
              <Label>Source repository / download URL *</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://github.com/you/my-bot" className="mt-1 h-10 rounded-xl" />
            </div>
          )}
          <div>
            <Label>Built-in auto reply (when no webhook is set)</Label>
            <Input value={autoReply} onChange={(e) => setAutoReply(e.target.value)} placeholder="e.g. Hey! I'm Nova — type /help to see what I can do." className="mt-1 h-10 rounded-xl" />
          </div>
          <div>
            <Label>Commands (comma separated)</Label>
            <Input value={commands} onChange={(e) => setCommands(e.target.value)} placeholder="/welcome, /rules, /giveaway" className="mt-1 h-10 rounded-xl" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button className="rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white" onClick={submit} disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4 mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />} Deploy bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Manage dialog (owner only)                                          */
/* ------------------------------------------------------------------ */

function BotManageDialog({ bot, onClose, onSaved }: { bot: Bot; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(bot.name)
  const [description, setDescription] = useState(bot.description || "")
  const [category, setCategory] = useState(bot.category)
  const [webhookUrl, setWebhookUrl] = useState(bot.webhook_url || "")
  const [inviteLink, setInviteLink] = useState(bot.invite_link || "")
  const [sourceUrl, setSourceUrl] = useState(bot.source_url || "")
  const [autoReply, setAutoReply] = useState(bot.auto_reply || "")
  const [commands, setCommands] = useState((bot.commands || []).join(", "))
  const [status, setStatus] = useState(bot.status)
  const [deploymentType, setDeploymentType] = useState<"hosted" | "source">(bot.deployment_type as "hosted" | "source" || "hosted")
  const [listed, setListed] = useState(bot.is_listed)
  const [price, setPrice] = useState(String(bot.price_coins || ""))
  const [allowsHosted, setAllowsHosted] = useState(bot.allows_hosted)
  const [allowsSource, setAllowsSource] = useState(bot.allows_source)
  const [avatarItems, setAvatarItems] = useState<PickedMedia[]>(bot.avatar_url ? [{ url: bot.avatar_url, kind: "image" }] : [])
  const [secretInput, setSecretInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [activity, setActivity] = useState<ActivityRow[]>([])

  const loadActivity = useCallback(async () => {
    const res = await fetch(`/api/bots/${bot.id}`, { cache: "no-store" })
    if (res.ok) {
      const data = await res.json()
      setActivity(data.activity || [])
    }
  }, [bot.id])

  useEffect(() => {
    loadActivity()
  }, [loadActivity])

  const save = async (extra?: Record<string, any>) => {
    if (!secretInput) return setError("Enter your bot secret token to save changes")
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/bots/${bot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_token: secretInput,
          name,
          description,
          category,
          webhook_url: webhookUrl.trim() || undefined,
          invite_link: inviteLink.trim() || undefined,
          source_url: sourceUrl.trim() || undefined,
          auto_reply: autoReply.trim() || undefined,
          commands: commands.split(",").map((c) => c.trim().replace(/^\/?/, "/")).filter(Boolean).slice(0, 50),
          status,
          deployment_type: deploymentType,
          avatar_url: avatarItems[0]?.url || null,
          ...extra,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      if (data.secret_token) setSecretInput(data.secret_token)
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const saveListing = async () => {
    if (!secretInput) return setError("Enter your bot secret token to save changes")
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/bots/${bot.id}/marketplace`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret_token: secretInput,
          is_listed: listed,
          price_coins: Number(price) || 0,
          allows_hosted: allowsHosted,
          allows_source: allowsSource,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update listing")
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const remove = async () => {
    if (!secretInput) return setError("Enter your bot secret token to delete")
    const res = await fetch(`/api/bots/${bot.id}?secret=${encodeURIComponent(secretInput)}`, { method: "DELETE" })
    if (res.ok) onSaved()
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed to delete")
    }
  }

  const meta = CATEGORY_META[bot.category] || CATEGORY_META.custom

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-500" /> Manage {bot.name}
          </DialogTitle>
          <DialogDescription>Ownership stays with you — the secret token is required for every change.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Actions", value: bot.activity_count ?? 0 },
              { label: "Chats", value: bot.chat_count ?? 0 },
              { label: "Sales", value: bot.purchase_count ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-muted/30 p-2.5 text-center">
                <p className="text-lg font-extrabold">{s.value}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Secret */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <Label className="flex items-center gap-1.5 text-[11px]">
              <KeyRound className="h-3.5 w-3.5 text-amber-500" /> Bot secret token (owner only)
            </Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input type="password" value={secretInput} onChange={(e) => setSecretInput(e.target.value)} placeholder="Paste your secret to make changes" className="h-9 flex-1 rounded-lg font-mono text-xs" />
              {bot.secret_token && (
                <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { navigator.clipboard.writeText(bot.secret_token!); setCopied(true) }}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 h-10 rounded-xl" maxLength={60} />
            </div>
            <div>
              <Label>Status</Label>
              <div className="mt-1 flex items-center gap-2">
                <button
                  onClick={() => setStatus(status === "online" ? "offline" : "online")}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
                    status === "online" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  <StatusDot status={status} />
                  {status === "online" ? "Online" : "Offline"}
                </button>
              </div>
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl min-h-[60px] text-sm" maxLength={500} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                {Object.entries(CATEGORY_META).map(([key, m]) => (
                  <option key={key} value={key}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Deployment</Label>
              <select value={deploymentType} onChange={(e) => setDeploymentType(e.target.value as "hosted" | "source")} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="hosted">Hosted</option>
                <option value="source">Source</option>
              </select>
            </div>
          </div>
          <div>
            <Label>Avatar</Label>
            <div className="mt-1">
              <DeviceMediaPicker items={avatarItems} onChange={setAvatarItems} maxItems={1} accept="image/*" compact folder="bot-avatars" />
            </div>
          </div>
          <div className="space-y-2">
            <div>
              <Label>Webhook URL</Label>
              <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://your-host.com/loop-bot" className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Invite link</Label>
              <Input value={inviteLink} onChange={(e) => setInviteLink(e.target.value)} placeholder="https://… access link" className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Source URL</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://github.com/you/my-bot" className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Auto reply</Label>
              <Input value={autoReply} onChange={(e) => setAutoReply(e.target.value)} placeholder="Built-in reply when no webhook is set" className="mt-1 h-10 rounded-xl" />
            </div>
            <div>
              <Label>Commands</Label>
              <Input value={commands} onChange={(e) => setCommands(e.target.value)} placeholder="/welcome, /rules" className="mt-1 h-10 rounded-xl" />
            </div>
          </div>

          <Button className="w-full rounded-full" onClick={() => save()} disabled={submitting}>
            {submitting ? <Spinner className="h-4 w-4 mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />} Save changes
          </Button>

          {/* Marketplace */}
          <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 to-card p-4 space-y-3">
            <p className="flex items-center gap-1.5 text-sm font-bold">
              <Store className="h-4 w-4 text-amber-500" /> Bot Marketplace
            </p>
            <div className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold">List this bot for sale</p>
                <p className="text-[10px] text-muted-foreground">Buyers get usage/source rights — you keep ownership.</p>
              </div>
              <Switch checked={listed} onCheckedChange={setListed} />
            </div>
            {listed && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Price (Loop Coins)</Label>
                    <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 h-10 rounded-xl" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2">
                    <span className="text-xs font-medium">Sell Hosted Access</span>
                    <Switch checked={allowsHosted} onCheckedChange={setAllowsHosted} />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-border bg-background/50 px-3 py-2">
                    <span className="text-xs font-medium">Sell Source Code</span>
                    <Switch checked={allowsSource} onCheckedChange={setAllowsSource} />
                  </label>
                </div>
                <Button variant="outline" className="w-full rounded-full" onClick={saveListing} disabled={submitting}>
                  {listed ? <Check className="h-4 w-4 mr-1.5 text-emerald-500" /> : null} Save listing
                </Button>
              </>
            )}
          </div>

          {/* Activity */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Activity
            </p>
            <div className="space-y-1.5">
              {activity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet — interactions will show up here.</p>
              ) : (
                activity.slice(0, 8).map((a) => (
                  <div key={a.id} className="flex items-start gap-2 rounded-xl border border-border bg-muted/20 p-2.5 text-xs">
                    <span className={cn("mt-0.5 shrink-0 font-bold uppercase tracking-wide", meta.color)}>{a.type}</span>
                    <div className="min-w-0">
                      <p className="font-semibold">{a.title}</p>
                      {a.message && <p className="truncate text-muted-foreground">{a.message}</p>}
                    </div>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{timeAgo(a.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-red-500/20 p-3">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="destructive" className="rounded-full text-xs" onClick={remove}>Confirm delete</Button>
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="rounded-full text-xs text-red-400 hover:text-red-300" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete bot
              </Button>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/* Chat dialog                                                         */
/* ------------------------------------------------------------------ */

function BotChatDialog({ bot, onClose, isMember }: { bot: Bot; onClose: () => void; isMember: boolean }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bots/${bot.id}/chat?limit=60`, { cache: "no-store" })
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } catch { /* keep what we have */ } finally {
      setLoading(false)
    }
  }, [bot.id])

  useEffect(() => {
    load()
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length])

  const send = async () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    setNotice("")
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      bot_id: bot.id,
      user_id: user?.id,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput("")
    try {
      const res = await fetch(`/api/bots/${bot.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setNotice(data.error || "Failed to send")
        return
      }
      if (data.reply) {
        const reply: ChatMessage = {
          id: `bot-${Date.now()}`,
          bot_id: bot.id,
          user_id: null,
          role: "bot",
          content: data.reply,
          created_at: new Date().toISOString(),
        }
        setMessages((prev) => [...prev, reply])
      } else if (!data.delivered && !bot.webhook_url) {
        setNotice("This bot has no reply configured yet.")
      }
    } catch {
      setNotice("Network error — try again")
    } finally {
      setSending(false)
    }
  }

  const meta = CATEGORY_META[bot.category] || CATEGORY_META.custom

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] flex flex-col gap-0 p-0 max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-indigo-950/60 to-fuchsia-950/40 p-4">
          <div className="relative">
            <BotAvatar bot={bot} size="md" />
            <span className="absolute -bottom-0.5 -right-0.5">
              <StatusDot status={bot.status} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{bot.name}</p>
            <p className={cn("text-[11px] font-medium", bot.status === "online" ? "text-emerald-400" : "text-muted-foreground")}>
              {bot.status === "online" ? "Online · replying live" : "Offline"}
              {bot.commands.length > 0 && ` · ${bot.commands.length} commands`}
            </p>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", meta.chip, meta.color)}>
            {meta.label}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto p-4 min-h-[260px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center space-y-1.5">
              <BotMessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-semibold">Start the conversation</p>
              <p className="text-[11px] text-muted-foreground">
                {bot.commands.length > 0 ? (
                  <>
                    Try: {bot.commands.slice(0, 4).map((c) => <code key={c} className="mx-0.5 rounded bg-muted px-1 py-0.5 font-mono text-[10px]">{c}</code>)}
                  </>
                ) : (
                  "Say hi or send a command."
                )}
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const isBot = m.role === "bot"
              return (
                <div key={m.id} className={cn("flex", isBot ? "justify-start" : "justify-end")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed break-words",
                      isBot
                        ? "rounded-bl-sm border border-indigo-500/25 bg-indigo-500/10 text-foreground"
                        : "rounded-br-sm bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white",
                    )}
                  >
                    {isBot && (
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-bold text-indigo-400">
                        <Bot className="h-3 w-3" /> {bot.name}
                      </p>
                    )}
                    {m.content}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {notice && <p className="px-4 pb-1 text-[11px] text-amber-500">{notice}</p>}
        {!isMember && (
          <p className="flex items-center gap-1.5 px-4 pb-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Join the community to chat with {bot.name}.
          </p>
        )}

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-border bg-card/60 p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={isMember ? `Message ${bot.name}…` : "Members only"}
            disabled={!isMember || sending}
            className="h-10 rounded-full text-sm"
            maxLength={1000}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white"
            onClick={send}
            disabled={!isMember || sending || !input.trim()}
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
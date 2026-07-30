"use client"

import { useEffect, useState } from "react"
import { ROLE_PERMISSIONS } from "@/lib/circle-permissions"
import { Bot, Boxes, Palette, Trophy, Video, Wand2, Shield, Layout, Sparkles, Check, Type, Sliders, Layers, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface CommunityAdvancedPanelProps {
  circleId: string
  canManage: boolean
}

export function CommunityAdvancedPanel({ circleId, canManage }: CommunityAdvancedPanelProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [bots, setBots] = useState<any[]>([])
  const [challenges, setChallenges] = useState<any[]>([])
  const [studio, setStudio] = useState<any>({})
  const [challengeDraft, setChallengeDraft] = useState({ title: "", description: "", reward_coins: 100 })

  const loadAdvancedFeatures = async () => {
    const headers = user ? getAuthHeader() : undefined
    const [botsResponse, challengesResponse, studioResponse] = await Promise.all([
      fetch(`/api/circles/${circleId}/bots`, { headers }),
      fetch(`/api/circles/${circleId}/challenges`, { headers }),
      fetch(`/api/circles/${circleId}/studio`, { headers }),
    ])

    if (botsResponse.ok) setBots((await botsResponse.json()).bots || [])
    if (challengesResponse.ok) setChallenges((await challengesResponse.json()).challenges || [])
    if (studioResponse.ok) setStudio((await studioResponse.json()).studio || {})
  }

  useEffect(() => {
    loadAdvancedFeatures()
  }, [circleId, user?.id])

  const upsertBot = async (bot: any) => {
    if (!user) return
    const response = await fetch(`/api/circles/${circleId}/bots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(bot),
    })
    const data = await response.json()
    if (!response.ok) {
      toast({ title: "Bot update failed", description: data.error, variant: "destructive" })
      return
    }
    setBots((prev) => {
      const without = prev.filter((item) => item.id !== data.bot.id)
      return [...without, data.bot]
    })
    toast({ description: "Bot settings saved." })
  }

  const saveStudio = async (nextStudio: any) => {
    if (!user) return
    const response = await fetch(`/api/circles/${circleId}/studio`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify({ studio: nextStudio }),
    })
    const data = await response.json()
    if (!response.ok) {
      toast({ title: "Studio update failed", description: data.error, variant: "destructive" })
      return
    }
    setStudio(data.studio || nextStudio)
    toast({ description: "Community studio saved." })
  }

  const createChallenge = async () => {
    if (!user || !challengeDraft.title.trim()) return
    const response = await fetch(`/api/circles/${circleId}/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
      body: JSON.stringify(challengeDraft),
    })
    const data = await response.json()
    if (!response.ok) {
      toast({ title: "Challenge creation failed", description: data.error, variant: "destructive" })
      return
    }
    setChallenges((prev) => [data.challenge, ...prev])
    setChallengeDraft({ title: "", description: "", reward_coins: 100 })
    toast({ description: "Challenge created." })
  }

  const welcomeBot = bots.find((bot) => bot.bot_type === "welcome")
  const moderationBot = bots.find((bot) => bot.bot_type === "moderation")

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-cyan-300" />
            AI community bots
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Welcome bot", bot: welcomeBot, type: "welcome", description: "Greets new members and explains the rules." },
            { label: "Moderation bot", bot: moderationBot, type: "moderation", description: "Flags spam and unsafe posts for review." },
          ].map(({ label, bot, type, description }) => (
            <div key={type} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#030712]/40 p-3">
              <div>
                <p className="font-medium text-white">{label}</p>
                <p className="text-sm text-slate-400">{description}</p>
              </div>
              <Switch
                checked={Boolean(bot?.enabled)}
                disabled={!canManage}
                onCheckedChange={(enabled) => upsertBot({ id: bot?.id, bot_type: type, name: label, enabled })}
              />
            </div>
          ))}
          {!canManage && <p className="text-xs text-slate-500">Only owners and moderators can change bot settings.</p>}
          <Button asChild variant="outline" className="w-full rounded-full border-white/15 bg-white/5">
            <a href="/marketplace">Browse bot & design marketplace</a>
          </Button>
        </CardContent>
      </Card>

      {/* Community Theme / Studio Card */}
      <Card className="border-white/10 bg-white/[0.04] lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Palette className="h-5 w-5 text-violet-400" />
              Community Studio & Theme Customization
            </CardTitle>
            <Badge className="border-violet-500/30 bg-violet-500/10 text-violet-300">
              Per-Circle Layout & Marketplace Packs
            </Badge>
          </div>
          <CardDescription className="text-slate-400 text-xs">
            Customize header styles, sidebar layouts, chat density, forum post designs, and apply marketplace theme packs to this Circle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Marketplace Packs & Community Layout Preset Applied to Individual Circle */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#030712]/50 p-4">
            <h4 className="font-semibold text-white text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-cyan-400" />
                Community Design Layout & Platform Theme Packs
              </span>
              <a href="/marketplace" className="text-xs text-cyan-400 hover:underline">
                Marketplace →
              </a>
            </h4>
            <p className="text-xs text-slate-400">
              Transform this community's visual layout and experience. Select a pre-designed developer layout or apply an installed marketplace theme.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { id: "telegram", name: "Telegram Channel Layout", accent: "#24A1DE", layout: "telegram", desc: "Left channel bar, center message bubbles, right room panel" },
                { id: "discord", name: "Discord Server Layout", accent: "#5865F2", layout: "discord", desc: "Dark server icon bar, role tags, channel hierarchy & roster" },
                { id: "reddit", name: "Reddit Subreddit Layout", accent: "#FF4500", layout: "reddit", desc: "Karma counter, upvote controls, Hot/Top post sorting & rules wiki" },
                { id: "devto", name: "Dev.to Tech Blog Layout", accent: "#0A0A0A", layout: "devto", desc: "Developer article card feed, read-time chips & code syntax" },
                { id: "forum", name: "Classic Bulletin Forum", accent: "#10B981", layout: "forum", desc: "Tabular thread categories, topic counts & last post activity" },
                { id: "cyberpunk", name: "Cyberpunk 3D Matrix", accent: "#EC4899", layout: "cyberpunk", desc: "Glowing neon borders, 3D ambient canvas & futuristic HUD" }
              ].map((pack) => (
                <button
                  key={pack.id}
                  type="button"
                  disabled={!canManage}
                  onClick={() =>
                    setStudio((prev: any) => ({
                      ...prev,
                      layout: pack.layout,
                      theme_pack: pack.name,
                      accent: pack.accent,
                    }))
                  }
                  className={`relative rounded-xl border p-3 text-left transition ${
                    studio.layout === pack.layout || studio.theme_pack === pack.name
                      ? "border-cyan-400 bg-cyan-500/10 shadow-md shadow-cyan-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  } disabled:opacity-50`}
                >
                  <span className="mb-2 block h-2 rounded-full" style={{ background: pack.accent }} />
                  <p className="font-semibold text-white text-xs">{pack.name}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{pack.desc}</p>
                  {(studio.layout === pack.layout || studio.theme_pack === pack.name) && (
                    <Badge className="absolute top-2 right-2 bg-cyan-500 text-black text-[10px] p-0.5 px-1.5 font-bold">
                      Active
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Per-Circle Layout Customization */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs text-slate-300 mb-1.5 block">Header Style</Label>
              <Select
                disabled={!canManage}
                value={studio.header_style || "glass-gradient"}
                onValueChange={(val) => setStudio((prev: any) => ({ ...prev, header_style: val }))}
              >
                <SelectTrigger className="bg-[#030712] border-white/10 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="glass-gradient">Glassmorphic Gradient</SelectItem>
                  <SelectItem value="banner-hero">Banner Hero Focus</SelectItem>
                  <SelectItem value="neon-border">Neon Border Glow</SelectItem>
                  <SelectItem value="minimal-clean">Minimalist Flat</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-300 mb-1.5 block">Sidebar Layout</Label>
              <Select
                disabled={!canManage}
                value={studio.sidebar_layout || "full-nav"}
                onValueChange={(val) => setStudio((prev: any) => ({ ...prev, sidebar_layout: val }))}
              >
                <SelectTrigger className="bg-[#030712] border-white/10 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-nav">Full Navigation Panel</SelectItem>
                  <SelectItem value="compact-dock">Compact Icon Dock</SelectItem>
                  <SelectItem value="hidden">Hidden Floating Drawer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-300 mb-1.5 block">Chat Density</Label>
              <Select
                disabled={!canManage}
                value={studio.chat_density || "spacious-bubbles"}
                onValueChange={(val) => setStudio((prev: any) => ({ ...prev, chat_density: val }))}
              >
                <SelectTrigger className="bg-[#030712] border-white/10 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spacious-bubbles">Spacious Avatars & Bubbles</SelectItem>
                  <SelectItem value="compact-rows">Compact Line Messages</SelectItem>
                  <SelectItem value="terminal-dark">Developer Terminal Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-slate-300 mb-1.5 block">Forum Layout</Label>
              <Select
                disabled={!canManage}
                value={studio.forum_layout || "3d-cards"}
                onValueChange={(val) => setStudio((prev: any) => ({ ...prev, forum_layout: val }))}
              >
                <SelectTrigger className="bg-[#030712] border-white/10 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3d-cards">Interactive 3D Cards</SelectItem>
                  <SelectItem value="bento-grid">Bento Grid Layout</SelectItem>
                  <SelectItem value="minimal-list">Minimal Thread List</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Header/Sidebar/Chat/Forum Styling Controls */}
          <div className="grid gap-4 sm:grid-cols-3 rounded-2xl border border-white/10 bg-[#030712]/40 p-4">
            <div>
              <Label className="text-xs text-slate-300">Accent Color</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  type="color"
                  value={studio.accent || "#22d3ee"}
                  disabled={!canManage}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, accent: e.target.value }))}
                  className="h-9 w-12 rounded border-none bg-transparent cursor-pointer p-0"
                />
                <Input
                  value={studio.accent || "#22d3ee"}
                  disabled={!canManage}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, accent: e.target.value }))}
                  className="bg-[#030712] border-white/10 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-slate-300">Header Background Tint</Label>
              <Input
                placeholder="#06182c"
                value={studio.header_bg || "#06182c"}
                disabled={!canManage}
                onChange={(e) => setStudio((prev: any) => ({ ...prev, header_bg: e.target.value }))}
                className="mt-1 bg-[#030712] border-white/10 text-xs text-white"
              />
            </div>

            <div>
              <Label className="text-xs text-slate-300">Font Family</Label>
              <Select
                disabled={!canManage}
                value={studio.font_family || "Plus Jakarta Sans"}
                onValueChange={(val) => setStudio((prev: any) => ({ ...prev, font_family: val }))}
              >
                <SelectTrigger className="mt-1 bg-[#030712] border-white/10 text-xs text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Plus Jakarta Sans">Plus Jakarta Sans</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Space Grotesk">Space Grotesk (Tech)</SelectItem>
                  <SelectItem value="Cinematic Display">Cinematic Display</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Live Styling Preview Box */}
          <div
            className="rounded-2xl border p-4 transition-all"
            style={{
              borderColor: `${studio.accent || "#22d3ee"}55`,
              background: `linear-gradient(135deg, ${studio.header_bg || "#06182c"} 0%, #030712 100%)`
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white" style={{ fontFamily: studio.font_family }}>
                Preview Circle Theme: {studio.theme_pack || "Custom Studio"}
              </span>
              <Badge style={{ background: studio.accent || "#22d3ee", color: "#000" }} className="font-bold text-[10px]">
                {studio.header_style || "glass-gradient"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              Header tint: <span style={{ color: studio.accent || "#22d3ee" }}>{studio.header_bg || "#06182c"}</span> • Layout: {studio.forum_layout || "3d-cards"}
            </p>
          </div>

          <Button
            disabled={!canManage}
            onClick={() => saveStudio(studio)}
            className="w-full rounded-full bg-gradient-to-r from-violet-600 via-cyan-500 to-blue-600 text-white font-semibold py-2.5 shadow-lg shadow-cyan-500/20"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Apply Studio & Circle Layout Theme
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-300" />
            Challenges & contests
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canManage && (
            <div className="space-y-2 rounded-2xl border border-white/10 bg-[#030712]/40 p-3">
              <Input
                placeholder="Challenge title"
                value={challengeDraft.title}
                onChange={(event) => setChallengeDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <Textarea
                placeholder="What should members create or do?"
                value={challengeDraft.description}
                onChange={(event) => setChallengeDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
              <Input
                type="number"
                min={0}
                value={challengeDraft.reward_coins}
                onChange={(event) => setChallengeDraft((prev) => ({ ...prev, reward_coins: Number(event.target.value) }))}
              />
              <Button onClick={createChallenge} className="rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                Create challenge
              </Button>
            </div>
          )}
          <div className="space-y-2">
            {challenges.length === 0 ? (
              <p className="text-sm text-slate-400">No active challenges yet.</p>
            ) : (
              challenges.slice(0, 5).map((challenge) => (
                <div key={challenge.id} className="rounded-2xl border border-white/10 bg-[#030712]/40 p-3">
                  <p className="font-medium text-white">{challenge.title}</p>
                  <p className="text-sm text-slate-400">{challenge.description}</p>
                  <p className="mt-1 text-xs text-amber-200">{challenge.reward_coins || 0} Loop Coins reward</p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5 text-emerald-300" />
            Voice/video rooms
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-[#030712]/40 p-3">
            Rooms can now track live presence through the room presence API. Voice/video provider wiring is ready for LiveKit, Agora, Daily, or Twilio.
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Boxes className="h-4 w-4" />
            Provider adapter needed for real audio/video streams.
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.04] lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-sky-300" />
            Role permissions
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_PERMISSIONS.map((item) => (
            <div key={item.role} className="rounded-2xl border border-white/10 bg-[#030712]/40 p-3">
              <p className="mb-2 font-medium text-white">{item.label}</p>
              <ul className="space-y-1 text-xs text-slate-400">
                {item.abilities.map((ability) => (
                  <li key={ability}>• {ability}</li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

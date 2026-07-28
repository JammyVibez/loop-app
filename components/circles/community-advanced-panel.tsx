"use client"

import { useEffect, useState } from "react"
import { ROLE_PERMISSIONS } from "@/lib/circle-permissions"
import { Bot, Boxes, Palette, Trophy, Video, Wand2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
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

      <Card className="border-white/10 bg-white/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-violet-300" />
            Community studio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>Theme preset</Label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "cinematic", accent: "#22d3ee", label: "Cinematic Cyan" },
              { id: "ember", accent: "#f97316", label: "Ember Orange" },
              { id: "violet", accent: "#8b5cf6", label: "Violet Pulse" },
              { id: "forest", accent: "#34d399", label: "Forest Mint" },
            ].map((theme) => (
              <button
                key={theme.id}
                type="button"
                disabled={!canManage}
                onClick={() => setStudio((prev: any) => ({ ...prev, layout: theme.id, accent: theme.accent, theme: theme.id }))}
                className="rounded-xl border border-white/10 bg-[#030712]/50 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/5 disabled:opacity-50"
              >
                <span className="mb-1 block h-2 rounded-full" style={{ background: theme.accent }} />
                {theme.label}
              </button>
            ))}
          </div>
          <Label>Accent color</Label>
          <Input
            value={studio.accent || "#22d3ee"}
            disabled={!canManage}
            onChange={(event) => setStudio((prev: any) => ({ ...prev, accent: event.target.value }))}
          />
          <Label>Layout style</Label>
          <Input
            value={studio.layout || "cinematic"}
            disabled={!canManage}
            onChange={(event) => setStudio((prev: any) => ({ ...prev, layout: event.target.value }))}
          />
          <div
            className="rounded-xl border border-white/10 p-3 text-xs text-slate-300"
            style={{ boxShadow: `inset 0 0 0 1px ${studio.accent || "#22d3ee"}33` }}
          >
            Preview accent: <span style={{ color: studio.accent || "#22d3ee" }}>{studio.accent || "#22d3ee"}</span>
          </div>
          <Button disabled={!canManage} onClick={() => saveStudio(studio)} className="rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white">
            <Wand2 className="mr-2 h-4 w-4" />
            Save studio
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

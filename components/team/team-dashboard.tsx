"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  Shield, Image, Megaphone, Calendar, Headphones, BarChart3,
  Coins, Crown, Building2, Star, Radio, BadgeCheck, Trophy,
  Users, UserCog, Activity, RefreshCw, Lock, ExternalLink,
} from "@/components/icons/lucide-compat"
import Link from "next/link"

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Shield, Image, Megaphone, Calendar, Headphones, BarChart3,
  Coins, Crown, Building2, Star, Radio, BadgeCheck, Trophy,
  Users, UserCog, Activity,
}

interface Section {
  key: string
  label: string
  description: string
  icon: string
  granted: boolean
}

// Section panel components
function ModerationPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-rose-500/10 flex items-center justify-center"><Shield className="h-5 w-5 text-rose-500" /></div>
              <div><p className="font-medium text-sm">Reported Content</p><p className="text-xs text-muted-foreground">Review flagged posts and comments</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><UserCog className="h-5 w-5 text-amber-500" /></div>
              <div><p className="font-medium text-sm">User Reports</p><p className="text-xs text-muted-foreground">Manage user complaints and appeals</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function GifEmojiPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center"><Image className="h-5 w-5 text-violet-500" /></div>
              <div><p className="font-medium text-sm">GIF Library</p><p className="text-xs text-muted-foreground">Upload and manage curated GIFs</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-pink-500/10 flex items-center justify-center"><Star className="h-5 w-5 text-pink-500" /></div>
              <div><p className="font-medium text-sm">Custom Emojis</p><p className="text-xs text-muted-foreground">Manage custom emoji and sticker packs</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AnalyticsPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active Users", value: "—", color: "text-cyan-500" },
          { label: "Posts Today", value: "—", color: "text-violet-500" },
          { label: "New Signups", value: "—", color: "text-emerald-500" },
          { label: "Engagement", value: "—", color: "text-amber-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Full analytics dashboard coming soon — data will populate automatically.
        </CardContent>
      </Card>
    </div>
  )
}

function EconomyPanel() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center"><Coins className="h-5 w-5 text-amber-500" /></div>
              <div><p className="font-medium text-sm">Coin Economy</p><p className="text-xs text-muted-foreground">Monitor loop coins, withdrawals, rewards</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-primary/30 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center"><Activity className="h-5 w-5 text-emerald-500" /></div>
              <div><p className="font-medium text-sm">Transactions</p><p className="text-xs text-muted-foreground">View gift and withdrawal history</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SupportPanel() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Headphones className="h-8 w-8 mx-auto mb-2 opacity-50" />
          Support ticket management — no pending tickets.
        </CardContent>
      </Card>
    </div>
  )
}

function GenericPanel({ title, icon: Icon }: { title: string; icon: React.ComponentType<any> }) {
  return (
    <Card>
      <CardContent className="p-6 text-center text-sm text-muted-foreground">
        <Icon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        {title} panel — tools will appear here when configured.
      </CardContent>
    </Card>
  )
}

const PANEL_MAP: Record<string, React.ComponentType<any>> = {
  moderation: ModerationPanel,
  gifs_emojis: GifEmojiPanel,
  analytics: AnalyticsPanel,
  economy: EconomyPanel,
  support: SupportPanel,
  ads: GenericPanel,
  events: GenericPanel,
  pro_lounge: GenericPanel,
  organizations: GenericPanel,
  featured: GenericPanel,
  broadcast: GenericPanel,
  verification: GenericPanel,
  awards: GenericPanel,
  coloop_sessions: GenericPanel,
  account_management: GenericPanel,
  health: GenericPanel,
}

export function TeamDashboard() {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState("")
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/team/dashboard", {
        headers: { ...getAuthHeader() },
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: "Access denied", description: data.error, variant: "destructive" })
        return
      }
      setSections(data.sections || [])
      setIsAdmin(data.is_admin || false)
      setUserName(data.user?.display_name || data.user?.username || "")
      // Set first section as active
      const granted = (data.sections || []).filter((s: Section) => s.granted)
      if (granted.length > 0 && !activeTab) {
        setActiveTab(granted[0].key)
      }
    } catch (err: any) {
      toast({ title: "Failed to load dashboard", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const grantedSections = sections.filter(s => s.granted)

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isAdmin ? "Admin Dashboard" : "Team Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? "Full admin access — all sections available"
              : `Welcome back, ${userName}. Here are your assigned sections.`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboard}>
          <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-cyan-500">{grantedSections.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sections Accessible</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-500">
              {isAdmin ? "All" : grantedSections.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Permissions</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border-emerald-500/20">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-500">
              {isAdmin ? "Admin" : "Team"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Role</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for each granted section */}
      {grantedSections.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-medium text-muted-foreground">No sections assigned</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask an admin to grant you access to dashboard sections.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-border bg-muted/40 p-1 sm:grid-cols-4 lg:grid-cols-6">
            {grantedSections.map((section) => {
              const Icon = ICON_MAP[section.icon] || Shield
              return (
                <TabsTrigger
                  key={section.key}
                  value={section.key}
                  className="rounded-xl text-xs gap-1.5 data-[state=active]:bg-background"
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="truncate">{section.label}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>

          {grantedSections.map((section) => {
            const Panel = PANEL_MAP[section.key] || GenericPanel
            return (
              <TabsContent key={section.key} value={section.key} className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {(() => { const Icon = ICON_MAP[section.icon] || Shield; return <Icon className="h-5 w-5 text-primary" /> })()}
                      {section.label}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </CardHeader>
                </Card>
                <Panel title={section.label} icon={ICON_MAP[section.icon] || Shield} />
              </TabsContent>
            )
          })}
        </Tabs>
      )}
    </div>
  )
}

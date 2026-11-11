"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { MessageSquare, ExternalLink } from "@/components/icons/lucide-compat"
import { Spinner } from "@/components/ui/skeletons"

export function DiscordInviteWidget() {
  const { getAuthHeader } = useAuth()
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/lounge", { headers: { ...getAuthHeader() } })
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.discord?.enabled && data.discord?.invite_url) {
          setInviteUrl(data.discord.invite_url)
          setVisible(true)
        }
      } catch {
        /* soft-fail — widget just doesn't render */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [getAuthHeader])

  if (loading) {
    return (
      <Card className="border-indigo-500/30 bg-indigo-500/5">
        <CardContent className="flex items-center justify-center p-6">
          <Spinner className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!visible || !inviteUrl) return null

  return (
    <Card className="overflow-hidden border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-card to-purple-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
            <MessageSquare className="h-5 w-5" />
          </span>
          Join the Loop Pro Discord
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Chat directly with the Loop dev team and other Pro members, get early previews of upcoming features, and
          shape the roadmap.
        </p>
        <Button asChild className="w-full rounded-full bg-[#5865F2] text-white hover:bg-[#4a55d4] sm:w-auto">
          <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Discord Invite
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

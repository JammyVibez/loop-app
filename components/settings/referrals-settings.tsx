"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Check, Copy, Gift, Link2, Loader2, Zap, Users } from "lucide-react"

interface ReferralRow {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  created_at: string
  invited_via_coloop?: boolean
}

export function ReferralsSettings() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [stats, setStats] = useState<{
    total: number
    this_week: number
    via_coloop: number
    via_link: number
    referred: ReferralRow[]
  }>({ total: 0, this_week: 0, via_coloop: 0, via_link: 0, referred: [] })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const inviteLink =
    typeof window !== "undefined" && user?.username
      ? `${window.location.origin}/signup?ref=${encodeURIComponent(user.username)}`
      : ""

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch("/api/referrals", { headers: getAuthHeader(), cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (!cancelled && data.success) {
          setStats({
            total: Number(data.total || 0),
            this_week: Number(data.this_week || 0),
            via_coloop: Number(data.via_coloop || 0),
            via_link: Number(data.via_link || 0),
            referred: data.referred || [],
          })
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [getAuthHeader])

  const copyLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
      toast({ title: "Invite link copied!", description: "Share it anywhere — you both earn coins." })
    } catch {
      toast({ title: "Couldn't copy link", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-card to-orange-600/5">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Invite a friend — you both earn coins</p>
              <p className="text-sm text-muted-foreground">
                When someone joins with your link and posts their first loop, both of you get a Loop Coin bonus.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={inviteLink} readOnly className="pl-9 font-mono text-xs" />
            </div>
            <Button onClick={() => void copyLink()} className="shrink-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white">
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied!" : "Copy invite link"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Users className="h-4 w-4" /> Total invites
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{loading ? "—" : stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Zap className="h-4 w-4" /> This week
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{loading ? "—" : stats.this_week}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Gift className="h-4 w-4" /> Co-Loop invites
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{loading ? "—" : stats.via_coloop}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">People you've brought in</CardTitle>
          <CardDescription>Anyone who joined through your link or a Co-Loop invite.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : stats.referred.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No invites yet — share your link and start earning.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.referred.map((row) => (
                <div key={row.id} className="flex items-center gap-3 rounded-xl border p-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={row.avatar_url} />
                    <AvatarFallback>{(row.display_name || row.username || "U").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.display_name || row.username}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{row.username} · {new Date(row.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {row.invited_via_coloop && (
                    <Badge variant="outline" className="rounded-full text-[10px]">
                      Co-Loop
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

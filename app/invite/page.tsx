"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Copy, Mail, Share2, Users, Zap, GitBranch, Loader2, TrendingUp } from "lucide-react"
import { Header } from "@/components/header"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

type ReferredUser = {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  created_at: string
  invited_via_coloop?: boolean
}

export default function InviteFriendsPage() {
  const { user, loading, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [message, setMessage] = useState("Come build stories with me on loopapp.me — trees, circles, and creative collabs.")
  const [inviteUrl, setInviteUrl] = useState("")
  const [stats, setStats] = useState<{ total: number; this_week: number; via_coloop: number; via_link: number } | null>(null)
  const [referred, setReferred] = useState<ReferredUser[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const url = `${window.location.origin}/signup?ref=${encodeURIComponent(user.username || user.id)}`
    setInviteUrl(url)
    setMessage(`Join me on loopapp.me as @${user.username}. ${url}`)
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const loadStats = async () => {
      setStatsLoading(true)
      try {
        const res = await fetch("/api/referrals", { headers: getAuthHeader() })
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) {
          setStats({ total: data.total || 0, this_week: data.this_week || 0, via_coloop: data.via_coloop || 0, via_link: data.via_link || 0 })
          setReferred(data.referred || [])
        }
      } catch {
        /* best-effort */
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    void loadStats()
    return () => {
      cancelled = true
    }
  }, [user, getAuthHeader])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-500" />
      </div>
    )
  }

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">Sign in to invite friends.</div>
  }

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    toast({ title: "Invite link copied" })
  }

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Join me on loopapp.me", text: message, url: inviteUrl })
      return
    }
    await copy()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
              Invite friends
            </CardTitle>
            <CardDescription>
              Share your personal invite link. Anyone who joins through it shows up in your referral dashboard below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input readOnly value={inviteUrl} className="border-border bg-muted" />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[100px] border-border bg-muted" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy} variant="outline">
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </Button>
              <Button onClick={share} className="bg-gradient-to-r from-violet-600 to-cyan-500 text-white">
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
              <Button asChild variant="outline">
                <a href={`mailto:?subject=${encodeURIComponent("Join me on loopapp.me")}&body=${encodeURIComponent(message)}`}>
                  <Mail className="mr-2 h-4 w-4" /> Email
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Referral dashboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
              Your referral dashboard
            </CardTitle>
            <CardDescription>Everyone who joined Loop through your link or a Co-Loop invite.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {statsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center">
                    <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total invites</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center">
                    <p className="text-2xl font-bold">{stats?.this_week ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">This week</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center">
                    <p className="text-2xl font-bold">{stats?.via_coloop ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Via Co-Loop</p>
                  </div>
                </div>

                {referred.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Nobody has joined through your link yet — share it above, or invite a collaborator into a{" "}
                    <Link href="/co-loop/studio" className="text-cyan-600 dark:text-cyan-400 hover:underline">
                      Co-Loop session
                    </Link>
                    .
                  </div>
                ) : (
                  <div className="space-y-2">
                    {referred.map((r) => (
                      <Link
                        key={r.id}
                        href={`/profile/${r.username}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={r.avatar_url} />
                            <AvatarFallback>{(r.display_name || r.username).charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{r.display_name || r.username}</p>
                            <p className="text-xs text-muted-foreground truncate">@{r.username}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {r.invited_via_coloop && (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <GitBranch className="h-3 w-3" /> Co-Loop
                            </Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Zap className="h-5 w-5 text-cyan-500 dark:text-cyan-400 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Tip: inviting someone into a{" "}
              <Link href="/co-loop/studio" className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline">
                Co-Loop session
              </Link>{" "}
              is the fastest way to get a real signup — you both earn Loop Coins once they join.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

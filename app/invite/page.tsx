"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Copy, Mail, Share2, Users } from "lucide-react"
import { Header } from "@/components/header"

export default function InviteFriendsPage() {
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const [message, setMessage] = useState("Come build stories with me on Loop — trees, circles, and creative collabs.")
  const [inviteUrl, setInviteUrl] = useState("")

  useEffect(() => {
    if (!user) return
    const url = `${window.location.origin}/signup?ref=${encodeURIComponent(user.username || user.id)}`
    setInviteUrl(url)
    setMessage(`Join me on Loop as @${user.username}. ${url}`)
  }, [user])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-cyan-400" /></div>
  }

  if (!user) {
    return <div className="p-8 text-center text-slate-300">Sign in to invite friends.</div>
  }

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    toast({ title: "Invite link copied" })
  }

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Join me on Loop", text: message, url: inviteUrl })
      return
    }
    await copy()
  }

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card className="border-white/10 bg-[#0a1020]/90">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-300" />
              Invite friends
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-400">
              Share your personal invite link. New friends who join through it can find you faster after onboarding.
            </p>
            <Input readOnly value={inviteUrl} className="border-white/10 bg-white/5" />
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[100px] border-white/10 bg-white/5" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy} variant="outline" className="border-white/10">
                <Copy className="mr-2 h-4 w-4" /> Copy link
              </Button>
              <Button onClick={share} className="bg-gradient-to-r from-violet-600 to-cyan-500">
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
              <Button asChild variant="outline" className="border-white/10">
                <a href={`mailto:?subject=${encodeURIComponent("Join me on Loop")}&body=${encodeURIComponent(message)}`}>
                  <Mail className="mr-2 h-4 w-4" /> Email
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Megaphone, Send, TrendingUp } from "lucide-react"

export function AdminBroadcastPanel() {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [actionUrl, setActionUrl] = useState("")
  const [scope, setScope] = useState<"all" | "random">("all")
  const [sampleSize, setSampleSize] = useState(100)
  const [sendEmail, setSendEmail] = useState(true)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const sendBroadcast = async (type: "announcement" | "trending", preset?: { title: string; message: string; url?: string }) => {
    if (sending) return
    setSending(true)
    setResult(null)
    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: preset?.title ?? title,
          message: preset?.message ?? message,
          action_url: (preset?.url ?? actionUrl) || null,
          type,
          scope,
          sample_size: sampleSize,
          send_email: sendEmail,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Broadcast failed")
      setResult(
        `✅ Notified ${data.notified} users (${data.targets} targeted) · ${data.emailed} emails sent${
          sendEmail && !data.send_email ? " — email skipped (RESEND_API_KEY not set)" : ""
        }`,
      )
      toast({ title: "Broadcast sent", description: `${data.notified} users notified` })
      setTitle("")
      setMessage("")
    } catch (error: any) {
      toast({ title: "Broadcast failed", description: error.message, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-emerald-500" /> Broadcast to users
          </CardTitle>
          <CardDescription>
            Send an in-app notification (and optional email) to all users or a random sample. Great for
            product updates, community announcements, and engagement pushes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="b-title">Title</Label>
              <Input
                id="b-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🎉 New Co-Loop Studio features"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-url">Action link (optional)</Label>
              <Input
                id="b-url"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="/explore"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b-msg">Message</Label>
            <Textarea
              id="b-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="What should everyone know?"
            />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Audience</Label>
              <div className="flex gap-2">
                {(["all", "random"] as const).map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={scope === s ? "default" : "outline"}
                    onClick={() => setScope(s)}
                  >
                    {s === "all" ? "All users" : "Random sample"}
                  </Button>
                ))}
              </div>
            </div>
            {scope === "random" && (
              <div className="space-y-1.5">
                <Label htmlFor="b-size">Sample size</Label>
                <Input
                  id="b-size"
                  type="number"
                  min={1}
                  max={500}
                  value={sampleSize}
                  onChange={(e) => setSampleSize(Number(e.target.value) || 100)}
                  className="w-28"
                />
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant={sendEmail ? "default" : "outline"}
              onClick={() => setSendEmail((v) => !v)}
            >
              Email: {sendEmail ? "ON" : "OFF"}
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => void sendBroadcast("announcement")}
                disabled={sending || !title.trim() || !message.trim()}
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Send announcement
              </Button>
              <Button
                variant="outline"
                onClick={() => void sendBroadcast("trending", { title: "🔥 Check out what's trending on loopapp.me", message: "A big conversation is happening right now — jump in before it wraps up!" })}
                disabled={sending}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Push trending nudge
              </Button>
            </div>
          </div>
          {result && <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-300">{result}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

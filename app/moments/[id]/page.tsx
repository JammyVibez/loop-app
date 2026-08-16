"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Loader2, Trash2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Header } from "@/components/header"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

export default function MomentPage() {
  const { id } = useParams<{ id: string }>()
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [moment, setMoment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = async () => {
    try {
      const res = await fetch(`/api/moments/${id}`, { headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok || !data.moment) {
        setNotFound(true)
        return
      }
      setMoment(data.moment)
      setDraft(data.moment.content || "")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/moments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ content: draft }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update")
      setMoment(data.moment)
      setEditing(false)
      toast({ title: "Moment updated" })
    } catch (error: any) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/moments/${id}`, { method: "DELETE", headers: getAuthHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete")
      toast({ title: "Moment deleted" })
      window.location.href = "/"
    } catch (error: any) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" })
      setDeleting(false)
    }
  }

  const isMine = user?.id === moment?.user_id
  const author = Array.isArray(moment?.author) ? moment?.author[0] : moment?.author
  const isVideo = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(moment?.media_url || "")

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Header />
        <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading moment…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-lg px-3 py-6">
        <Link href="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to feed
        </Link>

        {notFound || !moment ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-10 text-center">
            <span className="text-4xl">⏳</span>
            <h1 className="text-lg font-bold">Moment gone</h1>
            <p className="text-sm text-muted-foreground">
              This moment expired or was deleted. That&apos;s the point — moments are ephemeral.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-black text-white">
            <div className="flex items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
              <Avatar url={author?.avatar_url} name={author?.display_name || author?.username || "U"} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">@{author?.username || "user"}</p>
                <p className="flex items-center gap-1 text-[11px] text-white/60">
                  <Zap className="h-3 w-3 text-amber-400" />
                  Expires in{" "}
                  {Math.max(0, Math.floor(((new Date(moment.expires_at).getTime() - now) / 60000) / 60))}h{" "}
                  {Math.max(0, Math.floor(((new Date(moment.expires_at).getTime() - now) / 60000) % 60))}m
                </p>
              </div>
              {isMine && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => setEditing((v) => !v)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" className="h-8" onClick={() => void remove()} disabled={deleting}>
                    {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>

            {moment.media_url ? (
              <div className="flex max-h-[60vh] items-center justify-center bg-black">
                {isVideo ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={moment.media_url} className="max-h-[60vh] w-full object-contain" controls autoPlay playsInline />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={moment.media_url} alt="Moment" className="max-h-[60vh] w-full object-contain" />
                )}
              </div>
            ) : null}

            <div className="px-4 py-4">
              {editing && isMine ? (
                <div className="space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    className="border-white/20 bg-white/5 text-white"
                    maxLength={500}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void save()} disabled={saving}>
                      {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : "Save"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{moment.content || "Moment"}</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Avatar({ url, name }: { url?: string; name: string }) {
  return (
    <span className="relative shrink-0">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white/15 text-sm font-semibold text-white">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          name.charAt(0)
        )}
      </span>
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black bg-emerald-400" />
    </span>
  )
}

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, Eye, Loader2, Radio, Play } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function StreamDetailPage() {
  const params = useParams<{ id: string }>()
  const streamId = params?.id
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [stream, setStream] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!streamId) return
    const load = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/streams/${streamId}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Stream not found")
        setStream(data.data?.stream || data.stream)
      } catch (error: any) {
        toast({ title: "Stream unavailable", description: error.message, variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [streamId])

  const isOwner = user?.id && stream?.streamer_id === user.id

  const setStatus = async (status: "live" | "ended" | "paused") => {
    if (!streamId) return
    setBusy(true)
    try {
      const response = await fetch(`/api/streams/${streamId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Update failed")
      setStream(data.data?.stream || { ...stream, status })
      toast({ title: status === "live" ? "You’re live" : `Stream ${status}` })
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading stream…
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-4 text-muted-foreground">Stream not found.</p>
        <Link href="/streams">
          <Button variant="outline">Back to Livestream</Button>
        </Link>
      </div>
    )
  }

  const streamer = Array.isArray(stream.streamer) ? stream.streamer[0] : stream.streamer

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/streams" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> All streams
      </Link>

      <div className="overflow-hidden rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 text-white shadow-xl">
        <div className="relative aspect-video bg-black/60">
          {stream.thumbnail_url ? (
            <img src={stream.thumbnail_url} alt="" className="h-full w-full object-cover opacity-70" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Play className="h-16 w-16 text-white/40" />
            </div>
          )}
          <div className="absolute left-4 top-4 flex items-center gap-2">
            {stream.status === "live" ? (
              <Badge className="bg-rose-500 text-white">
                <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="secondary">{stream.status}</Badge>
            )}
            <Badge variant="outline" className="border-white/20 bg-black/40 text-white">
              <Eye className="mr-1 h-3 w-3" />
              {Number(stream.viewer_count || 0).toLocaleString()}
            </Badge>
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{stream.title}</h1>
              {stream.description && <p className="mt-2 text-sm text-white/70">{stream.description}</p>}
              <div className="mt-4 flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={streamer?.avatar_url} />
                  <AvatarFallback>{(streamer?.display_name || "S").charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{streamer?.display_name || "Streamer"}</p>
                  <p className="text-sm text-white/60">@{streamer?.username}</p>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="flex flex-wrap gap-2">
                {stream.status !== "live" && (
                  <Button disabled={busy} onClick={() => setStatus("live")} className="rounded-full bg-rose-500 hover:bg-rose-400">
                    <Radio className="mr-2 h-4 w-4" /> Go live
                  </Button>
                )}
                {stream.status === "live" && (
                  <Button disabled={busy} variant="outline" onClick={() => setStatus("ended")} className="rounded-full border-white/20 bg-white/5">
                    End stream
                  </Button>
                )}
              </div>
            )}
          </div>

          {isOwner && (
            <Card className="border-white/10 bg-white/5 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-white/80">Streamer studio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-white/60">
                <p>
                  Stream key: <code className="rounded bg-black/40 px-1.5 py-0.5 text-white/90">{stream.stream_key}</code>
                </p>
                {stream.rtmp_url && (
                  <p className="break-all">
                    RTMP: <code className="text-white/80">{stream.rtmp_url}</code>
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

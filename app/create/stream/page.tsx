"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, MonitorUp, Radio, Video } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const CATEGORIES = ["gaming", "music", "art", "tech", "education", "lifestyle", "entertainment", "general"]

export default function CreateStreamPage() {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    tags: "",
  })

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground">Sign in to go live.</p>
        <Link href="/login">
          <Button className="rounded-full">Log in</Button>
        </Link>
      </div>
    )
  }

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/streams", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create stream")
      const streamId = data.data?.stream?.id
      toast({ title: "Studio ready", description: "Turn on your camera and go live." })
      router.push(streamId ? `/streams/${streamId}` : "/streams")
    } catch (error: any) {
      toast({ title: "Couldn't create live", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-xl px-4 py-8">
        <Link
          href="/streams"
          className="mb-6 inline-flex items-center text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Livestream
        </Link>

        <div className="mb-6">
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Radio className="h-6 w-6 text-rose-500" />
            Go Live
          </h1>
          <p className="mt-2 text-sm text-white/60">
            TikTok-style livestream — real-time video, chat, reactions, gifts, and screen share.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <Video className="mb-2 h-5 w-5 text-rose-400" />
            <p className="text-sm font-semibold">Camera Live</p>
            <p className="mt-1 text-xs text-white/50">Broadcast from your phone or webcam in real time.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <MonitorUp className="mb-2 h-5 w-5 text-sky-400" />
            <p className="text-sm font-semibold">Share Screen</p>
            <p className="mt-1 text-xs text-white/50">Host can switch to screen share for viewers instantly.</p>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-white/10 bg-zinc-950/80 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-white/80">
              Title
            </Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="What are you going live about?"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc" className="text-white/80">
              Description
            </Label>
            <Textarea
              id="desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Tell viewers what to expect"
              className="min-h-[96px] border-white/10 bg-white/5 text-white"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category" className="text-white/80">
              Category
            </Label>
            <select
              id="category"
              className="flex h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-zinc-900">
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tags" className="text-white/80">
              Tags
            </Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
              placeholder="gaming, chill, qna"
              className="border-white/10 bg-white/5 text-white"
            />
          </div>

          <Button
            disabled={saving}
            onClick={handleCreate}
            className="h-12 w-full rounded-full bg-rose-500 text-base font-bold hover:bg-rose-400"
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Radio className="mr-2 h-4 w-4" />}
            Open Live Studio
          </Button>
        </div>
      </div>
    </div>
  )
}

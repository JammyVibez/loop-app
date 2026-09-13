"use client"

import { useState } from "react"
import { MonitorUp, Radio, Video } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/skeletons"

const CATEGORIES = ["gaming", "music", "art", "tech", "education", "lifestyle", "entertainment", "general"]

interface CreateStreamFormProps {
  onStreamCreated?: (streamId: string | null) => void
}

export function CreateStreamForm({ onStreamCreated }: CreateStreamFormProps) {
  const { getAuthHeader } = useAuth()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "general",
    tags: "",
  })

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
      const streamId = data.data?.stream?.id || null
      toast({ title: "Studio ready", description: "Turn on your camera and go live." })
      onStreamCreated?.(streamId)
    } catch (error: any) {
      toast({ title: "Couldn't create live", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Browser WebRTC live — camera, screen share, chat, and gifts. Best for small-to-medium audiences
        (mesh peer-to-peer, ~25 concurrent viewers).
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
          <Video className="mb-2 h-5 w-5 text-rose-500" />
          <p className="text-sm font-semibold">Camera Live</p>
          <p className="mt-1 text-xs text-muted-foreground">Broadcast from your phone or webcam in real time.</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
          <MonitorUp className="mb-2 h-5 w-5 text-sky-500" />
          <p className="text-sm font-semibold">Share Screen</p>
          <p className="mt-1 text-xs text-muted-foreground">Switch to screen share for viewers instantly.</p>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-border/60 bg-card/60 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="stream-title">Title</Label>
          <Input
            id="stream-title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="What are you going live about?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stream-desc">Description</Label>
          <Textarea
            id="stream-desc"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Tell viewers what to expect"
            className="min-h-[96px]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stream-category">Category</Label>
          <select
            id="stream-category"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stream-tags">Tags</Label>
          <Input
            id="stream-tags"
            value={form.tags}
            onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
            placeholder="gaming, chill, qna"
          />
        </div>

        <Button
          disabled={saving}
          onClick={handleCreate}
          className="h-12 w-full rounded-full bg-rose-500 text-base font-bold hover:bg-rose-400"
        >
          {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Radio className="mr-2 h-4 w-4" />}
          Open Live Studio
        </Button>
      </div>
    </div>
  )
}

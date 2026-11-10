"use client"

import { useState } from "react"
import { Mic } from "@/components/icons/lucide-compat"
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
          stream_type: "audio",
          tags: form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Failed to create stream")
      const streamId = data.data?.stream?.id || null
      toast({ title: "Audio studio ready", description: "Check your microphone and start your audio room." })
      onStreamCreated?.(streamId)
    } catch (error: any) {
      toast({ title: "Couldn't create audio room", description: error.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Start an audio-first live room with real-time conversation, listener chat, reactions and Loop gifts.
      </p>

      <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
        <Mic className="mb-2 h-5 w-5 text-primary" />
        <p className="text-sm font-semibold">Audio stage</p>
        <p className="mt-1 text-xs text-muted-foreground">Your microphone is live; listeners join to talk in chat, react and send gifts.</p>
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
          className="h-12 w-full rounded-full text-base font-bold"
        >
          {saving ? <Spinner className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
          Open Audio Studio
        </Button>
      </div>
    </div>
  )
}

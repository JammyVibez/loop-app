"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/components/ui/use-toast"
import { Spinner } from "@/components/ui/skeletons"
import {
  Zap,
  Users,
  
  Radio,
  Globe,
  ArrowRight,
  Lightbulb,
} from "@/components/icons/lucide-compat"

interface CreateOpenCoLoopFormProps {
  onCreated?: (sessionId: string) => void
}

const COLLAB_OPTIONS = [
  { value: 2, label: "2", desc: "Duo" },
  { value: 3, label: "3", desc: "Trio" },
  { value: 4, label: "4", desc: "Squad" },
]

export function CreateOpenCoLoopForm({ onCreated }: CreateOpenCoLoopFormProps) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [topic, setTopic] = useState("")
  const [maxCollabs, setMaxCollabs] = useState(4)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!user) {
      router.push("/auth")
      return
    }

    if (!topic.trim()) {
      toast({
        title: "Topic required",
        description: "Enter a topic or prompt for your open Co-Loop session.",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      const sessionId = `open-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`

      // Create session + feed post via the open-invite API
      const res = await fetch("/api/co-loop/open-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          session_id: sessionId,
          topic: topic.trim(),
          max_collaborators: maxCollabs,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create open Co-Loop")

      toast({
        title: "Open Co-Loop Published! 🤝",
        description: "Your open invite is now live in the feed. Anyone can join!",
      })

      // Refresh the feed to show the new invite
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("loop-created"))
      }

      onCreated?.(sessionId)
    } catch (err: any) {
      toast({
        title: "Failed to create",
        description: err.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="border-border bg-card p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/25">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold">Open Co-Loop Invite</h3>
            <p className="text-xs text-muted-foreground">
              Anyone on Loop can join your live collaboration session
            </p>
          </div>
        </div>

        {/* Topic / Prompt */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-cyan-400" />
            Topic / Prompt
          </label>
          <Textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What should we create together? e.g. 'Let's write a viral thread about AI in 2026'"
            rows={3}
            className="border-cyan-500/20 bg-background/80 resize-none"
          />
        </div>

        {/* Max Collaborators */}
        <div className="space-y-2">
          <label className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-cyan-400" />
            Max Collaborators
          </label>
          <div className="flex gap-2">
            {COLLAB_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxCollabs(opt.value)}
                className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                  maxCollabs === opt.value
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-300 shadow-lg shadow-cyan-500/10"
                    : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/20"
                }`}
              >
                <span className="text-lg font-bold block">{opt.label}</span>
                <span className="text-[10px] opacity-70">{opt.desc}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {maxCollabs === 4
              ? "Up to 4 collaborators can join your open session"
              : `Up to ${maxCollabs} collaborators can join your open session`}
          </p>
        </div>

        {/* Publish Button */}
        <Button
          onClick={handleCreate}
          disabled={creating || !topic.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 font-bold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-400 hover:to-indigo-500 transition-all"
        >
          {creating ? (
            <Spinner className="h-4 w-4 mr-2" />
          ) : (
            <Radio className="h-4 w-4 mr-2 animate-pulse" />
          )}
          {creating ? "Publishing..." : "Publish Open Invite"}
          {!creating && <ArrowRight className="h-4 w-4 ml-2" />}
        </Button>
      </Card>

      {/* Tips */}
      <div className="rounded-2xl border border-border/70 bg-card/50 p-4 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-amber-400" />
          How it works
        </p>
        <ul className="space-y-2 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 border-cyan-500/30 text-[9px] text-cyan-400 px-1.5 py-0 mt-0.5">
              1
            </Badge>
            <span>Your open invite appears as a special card in the main feed</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 border-cyan-500/30 text-[9px] text-cyan-400 px-1.5 py-0 mt-0.5">
              2
            </Badge>
            <span>Any user can tap "Join Session" to enter your live Co-Loop Studio</span>
          </li>
          <li className="flex items-start gap-2">
            <Badge variant="outline" className="shrink-0 border-cyan-500/30 text-[9px] text-cyan-400 px-1.5 py-0 mt-0.5">
              3
            </Badge>
            <span>Collaborate in real-time, then publish together when ready</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

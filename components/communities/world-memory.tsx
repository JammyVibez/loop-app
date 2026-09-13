"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { formatDate } from "@/lib/community-engine"
import { History, Plus, Trophy, Star, Megaphone, Sparkles } from "lucide-react"
import { Spinner } from "@/components/ui/skeletons"

const KIND_META: Record<string, { emoji: string; label: string }> = {
  milestone: { emoji: "🎉", label: "Milestone" },
  memory: { emoji: "📜", label: "Memory" },
  announcement: { emoji: "📢", label: "Announcement" },
  legend: { emoji: "👑", label: "Legendary" },
}

export function WorldMemory({
  communityId,
  initial,
  canModerate,
  focusId,
  onFocused,
}: {
  communityId: string
  initial: any
  canModerate: boolean
  focusId?: number
  onFocused?: () => void
}) {
  const [memory, setMemory] = useState(initial || { manual: [], auto: [] })
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState("memory")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const all = useTimeline(memory)
  const [flashId, setFlashId] = useState<number | null>(null)

  // Deep-link focus from What's Happening / Community Loop
  useEffect(() => {
    if (!focusId) return
    let attempts = 0
    const tryScroll = () => {
      attempts += 1
      const el = document.getElementById(`world-memory-${focusId}`)
      if (el) {
        setFlashId(focusId)
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setTimeout(() => {
          setFlashId(null)
          if (onFocused) onFocused()
        }, 2400)
      } else if (attempts < 10) {
        setTimeout(tryScroll, 180)
      } else if (onFocused) {
        onFocused()
      }
    }
    tryScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, all.length])

  const save = async () => {
    if (!title.trim()) return setError("Memory needs a title")
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, kind }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      setMemory((prev: any) => ({ ...prev, manual: [data.memory, ...(prev.manual || [])] }))
      setOpen(false)
      setTitle("")
      setDescription("")
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Community Memory</h2>
          <p className="text-xs text-muted-foreground">The archive of everything this world has lived through — new members can read its history.</p>
        </div>
        {canModerate && (
          <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Record a memory
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {all.length === 0 ? (
          <div className="text-center py-8">
            <History className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">History will be written here as this world grows.</p>
          </div>
        ) : (
          <div className="relative space-y-5 pl-6 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-border">
            {all.map((m: any, i: number) => {
              const meta = KIND_META[m.kind] || KIND_META.memory
              const date = m.happened_at || m.created_at
              return (
                <div key={m.id || i} id={m.id ? `world-memory-${m.id}` : undefined} className="relative scroll-mt-24">
                  <span className="absolute -left-6 top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  </span>
                  <div
                    className={`rounded-xl border bg-muted/20 p-3.5 transition-all duration-500 ${
                      flashId === m.id ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-border/60"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.emoji}</span>
                      <p className="text-sm font-bold flex-1">{m.title}</p>
                      <span className="text-[10px] text-muted-foreground">{formatDate(date)}</span>
                    </div>
                    {m.description && <p className="mt-1 text-xs text-muted-foreground">{m.description}</p>}
                    {m.is_auto && (
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-indigo-500">
                        <Sparkles className="h-2.5 w-2.5" /> auto-recorded
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a community memory</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Kind</label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {Object.entries(KIND_META).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-lg border p-2 text-center transition ${kind === k ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:border-indigo-500/40"}`}
                  >
                    <p className="text-base">{v.emoji}</p>
                    <p className="text-[9px] font-semibold mt-0.5">{v.label}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 rounded-xl" maxLength={150} placeholder='e.g. "Our first 100 members"' />
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl text-sm min-h-[70px]" maxLength={1000} />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="rounded-full">
              {saving ? <Spinner className="h-3.5 w-3.5 mr-1.5" /> : <Star className="h-3.5 w-3.5 mr-1.5" />}
              Record memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function useTimeline(memory: any) {
  if (!memory) return []
  const items = [
    ...(memory.manual || []).map((m: any) => ({ ...m, is_auto: false })),
    ...(memory.auto || []).map((m: any) => ({ ...m, is_auto: true })),
  ]
  return items.sort((a: any, b: any) => {
    const ad = new Date(a.happened_at || a.created_at || 0).getTime()
    const bd = new Date(b.happened_at || b.created_at || 0).getTime()
    return bd - ad
  })
}
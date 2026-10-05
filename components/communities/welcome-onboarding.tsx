"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PartyPopper, Check } from "lucide-react"
import { iconForSpace } from "@/components/communities/world-spaces"
import { Spinner } from "@/components/ui/skeletons"

const INTEREST_CHIPS = [
  "Anime & Manga",
  "Gaming",
  "Tech",
  "Education",
  "Art",
  "Music",
  "Movies & TV",
  "Sports",
  "Memes",
  "Books",
  "Creators",
  "Events",
]

/**
 * Shown right after a member joins a community: pick which spaces to follow
 * and what you care about. Persisted on the membership row (interests +
 * followed_spaces) through /api/communities/[id]/welcome.
 */
export function WelcomeOnboarding({
  open,
  onOpenChange,
  communityId,
  communityName,
  spaces,
  initialInterests = [],
  initialSpaces = [],
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  communityName: string
  spaces: any[]
  initialInterests?: string[]
  initialSpaces?: any[]
  onDone: () => void
}) {
  const [interests, setInterests] = useState<string[]>(initialInterests)
  const [followed, setFollowed] = useState<number[]>(initialSpaces)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const active = useMemo(() => (Array.isArray(spaces) ? spaces.filter((s: any) => !s.is_archived) : []), [spaces])

  const toggleInterest = (i: string) =>
    setInterests((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : prev.length >= 8 ? prev : [...prev, i]))

  const toggleSpace = (id: number) =>
    setFollowed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const save = async (completed: boolean) => {
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/welcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests, followed_spaces: followed, completed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to save")
      onOpenChange(false)
      onDone()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && save(false)}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary to-primary/40" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <PartyPopper className="h-4 w-4" />
            </span>
            Welcome to {communityName}
          </DialogTitle>
          <DialogDescription>
            Make this world yours — follow the spaces you care about and tell us what you're into.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto py-1 pr-1">
          {active.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Follow spaces</p>
              <p className="text-[11px] text-muted-foreground">We'll surface these first in your feed.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {active.map((s) => {
                  const on = followed.includes(Number(s.id))
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSpace(Number(s.id))}
                      className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-semibold transition ${
                        on ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <span>{iconForSpace(s.icon)}</span>
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your interests</p>
            <p className="text-[11px] text-muted-foreground">Pick up to 8 — powers personalized highlights in this world.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {INTEREST_CHIPS.map((i) => {
                const on = interests.includes(i)
                return (
                  <Badge
                    key={i}
                    variant={on ? "default" : "outline"}
                    onClick={() => toggleInterest(i)}
                    className={`cursor-pointer select-none rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      on ? "bg-primary hover:bg-primary/90" : "hover:border-primary/50 hover:text-primary"
                    }`}
                  >
                    {on && <Check className="mr-1 h-3 w-3" />}
                    {i}
                  </Badge>
                )
              })}
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" className="rounded-full text-xs" onClick={() => save(false)} disabled={saving}>
            Skip for now
          </Button>
          <Button className="rounded-full" onClick={() => save(true)} disabled={saving}>
            {saving ? <Spinner className="mr-1.5 h-3.5 w-3.5" /> : null}
            Enter the world
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

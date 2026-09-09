"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Swords, Coins, Clock, Zap } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { DeviceMediaPicker, type PickedMedia } from "@/components/communities/device-media-picker"

interface CreateDuelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDuelCreated?: () => void
}

export function CreateDuelDialog({ open, onOpenChange, onDuelCreated }: CreateDuelDialogProps) {
  const [prompt, setPrompt] = useState("")
  const [opponent, setOpponent] = useState("")
  const [creatorContent, setCreatorContent] = useState("")
  const [creatorMedia, setCreatorMedia] = useState<PickedMedia[]>([])
  const [stakeCoins, setStakeCoins] = useState(50)
  const [durationHours, setDurationHours] = useState(24)
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [loading, setLoading] = useState(false)

  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || !creatorContent.trim()) {
      toast({ title: "Validation Error", description: "Prompt and your argument are required!" })
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/duels", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          prompt,
          opponentUsername: opponent,
          stakeCoins,
          durationHours: durationHours + durationMinutes / 60,
          creatorContent,
          creatorMediaUrl: creatorMedia[0]?.url || null,
        }),
      })

      const data = await res.json()
      if (res.ok && (data.duel || data.loop)) {
        toast({ title: "Duel Launched! ⚔️", description: "Your duel is live on the feed for community votes!" })
        onOpenChange(false)
        setPrompt("")
        setOpponent("")
        setCreatorContent("")
        setCreatorMedia([])
        if (onDuelCreated) onDuelCreated()
        else window.location.reload()
      } else {
        toast({ title: "Failed to create duel", description: data.error || "Unknown error" })
      }
    } catch (err) {
      console.error("Failed to create duel:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-[calc(100vw-2rem)] max-h-[90dvh] overflow-y-auto bg-card text-card-foreground dark:bg-[#0b1329] dark:text-white border border-border/80 rounded-3xl p-4 sm:p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-600 dark:text-cyan-300">
            <Swords className="h-6 w-6 text-amber-500 dark:text-amber-400" /> Launch Loop Duel
          </DialogTitle>
          <p className="text-xs text-muted-foreground dark:text-slate-400">
            Post a paired duel topic, state your take (Side A), and invite the community or @mention an opponent to debate!
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Prompt / Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground dark:text-slate-300">Duel Topic or Prompt</label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Next.js App Router vs Page Router @username"
              className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white placeholder:text-muted-foreground rounded-xl"
            />
          </div>

          {/* Opponent Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground dark:text-slate-300">Target Opponent (Optional)</label>
            <Input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="@username (Leave blank for open public challenge)"
              className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white placeholder:text-muted-foreground rounded-xl"
            />
          </div>

          {/* Side A Take */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-rose-600 dark:text-rose-300">Your Take (Side A) - Use @ to mention users</label>
            <MentionTextarea
              value={creatorContent}
              onChange={(val) => setCreatorContent(val)}
              placeholder="State your opening argument clearly... Type @ to tag users"
              rows={4}
              className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white placeholder:text-muted-foreground rounded-xl min-h-[100px]"
            />
            {/* Image/video duel: attach media to Side A */}
            <div className="mt-2">
              <label className="text-xs font-semibold text-foreground dark:text-slate-300">Attach media to your take (optional)</label>
              <div className="mt-1">
                <DeviceMediaPicker items={creatorMedia} onChange={setCreatorMedia} maxItems={1} compact folder="duel-media" />
              </div>
            </div>
          </div>

          {/* Coins Stake & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground dark:text-slate-300 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" /> Stake Coins
              </label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={stakeCoins}
                onChange={(e) => setStakeCoins(Number(e.target.value))}
                className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground dark:text-slate-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" /> Voting Window
              </label>
              <div className="flex gap-2">
                <select
                  value={durationHours}
                  onChange={(e) => setDurationHours(Number(e.target.value))}
                  className="flex-1 h-10 bg-background dark:bg-slate-900 border border-input rounded-xl px-3 text-sm text-foreground dark:text-white focus:outline-none"
                >
                  {[0,1,2,3,6,12,24,48,72,96,120,144,168].map(h => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-20 h-10 bg-background dark:bg-slate-900 border border-input rounded-xl px-3 text-sm text-foreground dark:text-white focus:outline-none"
                >
                  {[0,15,30,45].map(m => (
                    <option key={m} value={m}>{m}m</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-muted-foreground dark:text-slate-500">Total: {durationHours + (durationMinutes > 0 ? 1 : 0)}h{durationMinutes > 0 ? ` ${durationMinutes}m` : ''} — up to 7 days</p>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-slate-950 font-bold rounded-xl shadow-lg"
            >
              {loading ? "Launching..." : "Publish Duel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}


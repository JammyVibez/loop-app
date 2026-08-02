"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Swords, Coins, Clock, Send, Sparkles } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface CreateDuelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDuelCreated?: () => void
}

export function CreateDuelDialog({ open, onOpenChange, onDuelCreated }: CreateDuelDialogProps) {
  const [prompt, setPrompt] = useState("")
  const [opponent, setOpponent] = useState("")
  const [creatorContent, setCreatorContent] = useState("")
  const [stakeCoins, setStakeCoins] = useState(50)
  const [durationHours, setDurationHours] = useState(24)
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
          durationHours,
          creatorContent,
        }),
      })

      const data = await res.json()
      if (res.ok && data.duel) {
        toast({ title: "Duel Launched!", description: "Your duel is live for community votes!" })
        onOpenChange(false)
        setPrompt("")
        setOpponent("")
        setCreatorContent("")
        if (onDuelCreated) onDuelCreated()
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
      <DialogContent className="max-w-xl bg-[#0b1329] border-white/10 text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-300">
            <Swords className="h-6 w-6 text-amber-400" /> Launch Loop Duel
          </DialogTitle>
          <p className="text-xs text-slate-400">
            Post a paired duel topic, state your take (Side A), and invite the community or an opponent to debate!
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Prompt / Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Duel Topic or Prompt</label>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Next.js App Router vs Page Router for enterprise apps"
              className="bg-slate-900 border-white/10 text-white placeholder-slate-500 rounded-xl"
            />
          </div>

          {/* Opponent Username */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Target Opponent (Optional)</label>
            <Input
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              placeholder="@username (Leave blank for open public challenge)"
              className="bg-slate-900 border-white/10 text-white placeholder-slate-500 rounded-xl"
            />
          </div>

          {/* Side A Take */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-rose-300">Your Take (Side A)</label>
            <Textarea
              value={creatorContent}
              onChange={(e) => setCreatorContent(e.target.value)}
              placeholder="State your opening argument clearly..."
              className="bg-slate-900 border-white/10 text-white placeholder-slate-500 rounded-xl min-h-[100px]"
            />
          </div>

          {/* Coins Stake & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Coins className="h-3.5 w-3.5 text-amber-400" /> Stake Coins
              </label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={stakeCoins}
                onChange={(e) => setStakeCoins(Number(e.target.value))}
                className="bg-slate-900 border-white/10 text-white rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-cyan-400" /> Voting Window
              </label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full h-10 bg-slate-900 border border-white/10 rounded-xl px-3 text-sm text-white focus:outline-none"
              >
                <option value={12}>12 Hours</option>
                <option value={24}>24 Hours</option>
                <option value={48}>48 Hours</option>
                <option value={168}>7 Days</option>
              </select>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-400 hover:text-white"
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

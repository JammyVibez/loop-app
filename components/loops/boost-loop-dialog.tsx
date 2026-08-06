"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Rocket, Coins, Sparkles, TrendingUp, CheckCircle2 } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"

interface BoostLoopDialogProps {
  loopId: string
  loopTitle?: string
  currentCoins: number
  targetCoins: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onBoostSuccess?: (newCurrent: number, isBoosted: boolean) => void
}

export function BoostLoopDialog({
  loopId,
  loopTitle,
  currentCoins,
  targetCoins,
  open,
  onOpenChange,
  onBoostSuccess,
}: BoostLoopDialogProps) {
  const [selectedAmount, setSelectedAmount] = useState<number>(50)
  const [customAmount, setCustomAmount] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(false)

  const { user, getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()

  const amountToContribute = customAmount ? Number(customAmount) : selectedAmount
  const percent = Math.min(100, Math.round(((currentCoins + amountToContribute) / targetCoins) * 100))
  const walletBalance = Number(user?.loop_coins || 0)
  const insufficientFunds = amountToContribute > walletBalance

  const handleBoost = async () => {
    if (!amountToContribute || amountToContribute <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid coin amount!" })
      return
    }

    if (insufficientFunds) {
      toast({
        title: "Not enough Loop Coins",
        description: `You have ${walletBalance} coins — buy more to boost with ${amountToContribute}.`,
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/loops/${loopId}/boost`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ coins: amountToContribute }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast({
          title: "🚀 Loop Boosted!",
          description: `${amountToContribute} coins were deducted from your wallet to boost this Loop into feed visibility!`,
        })
        // The boost actually charges the wallet server-side now — refresh so
        // the coin balance shown everywhere (header, wallet page) is correct
        // instead of silently going stale.
        void refreshUser()
        if (onBoostSuccess) {
          onBoostSuccess(data.boost.current, data.boost.isBoosted)
        }
        onOpenChange(false)
      } else {
        toast({ title: "Boost failed", description: data.error || "Could not contribute coins", variant: "destructive" })
      }
    } catch (err) {
      console.error("Failed to boost loop:", err)
      toast({ title: "Boost failed", description: "Please try again.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-cyan-500/30 text-foreground rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
            <Rocket className="h-6 w-6 text-cyan-600 dark:text-cyan-400 animate-bounce" /> Crowd-Fund Feed Boost
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Pool coins to push &ldquo;{loopTitle || "this Loop"}&rdquo; to the top of everyone&apos;s feed!
          </p>
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            Your balance: {walletBalance.toLocaleString()} coins
          </p>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Progress Goal Widget */}
          <div className="p-4 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-500/20 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
                <Coins className="h-4 w-4 text-amber-400" />
                {currentCoins + amountToContribute} / {targetCoins} Coins
              </span>
              <span className="text-cyan-600 dark:text-cyan-400">{percent}% Funded</span>
            </div>

            <div className="h-3 w-full bg-muted rounded-full overflow-hidden p-0.5 border border-border">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_12px_#22d3ee]"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Quick Select Buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground">Select Coin Contribution</label>
            <div className="grid grid-cols-4 gap-2">
              {[20, 50, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amt)
                    setCustomAmount("")
                  }}
                  className={`flex items-center justify-center gap-1 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    selectedAmount === amt && !customAmount
                      ? "bg-cyan-500/15 dark:bg-cyan-500/20 border-cyan-400 text-cyan-700 dark:text-cyan-300 shadow-lg"
                      : "bg-muted border-border text-muted-foreground hover:border-cyan-500/30"
                  }`}
                >
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Or enter custom amount</label>
            <input
              type="number"
              min={1}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder="e.g. 500"
              className="w-full bg-muted border border-border rounded-xl p-2.5 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-cyan-400"
            />
          </div>

          {insufficientFunds && (
            <p className="text-xs font-semibold text-red-500">
              Not enough coins — you have {walletBalance.toLocaleString()}, need {amountToContribute.toLocaleString()}.
            </p>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleBoost}
            disabled={loading || amountToContribute <= 0 || insufficientFunds}
            className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white font-extrabold rounded-xl shadow-lg flex items-center gap-1.5"
          >
            {loading ? (
              "Boosting..."
            ) : (
              <>
                <Rocket className="h-4 w-4" /> Boost Loop with {amountToContribute} Coins
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

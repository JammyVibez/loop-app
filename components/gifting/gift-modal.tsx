"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Gift,
  Coins,
  Crown,
  Heart,
  Star,
  Zap,
  TreePine,
  MessageCircle,
  Loader2,
  Palette,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabase"

interface GiftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipient: {
    id: string
    username: string
    display_name: string
    avatar_url?: string
  }
  context?: {
    type: "post" | "reel" | "profile" | "comment" | "branch" | "stream"
    id: string
    title?: string
  }
  onGiftSent?: (gift: { id: string; name: string; cost: number; type: string; rarity: string }) => void
}

interface GiftItem {
  id: string
  name: string
  description: string
  type: string
  cost: number
  rarity: string
  preview?: string | null
  duration?: string | null
  effects?: {
    animation?: string
    sound?: string
    particles?: boolean
  }
}

const rarityColors: Record<string, string> = {
  common: "bg-slate-500 text-white",
  rare: "bg-blue-500 text-white",
  epic: "bg-violet-500 text-white",
  legendary: "bg-amber-500 text-slate-900",
}

function giftIcon(type: string) {
  const base = "flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm"
  switch (type) {
    case "coins":
      return <span className={`${base} border-yellow-500/30 bg-gradient-to-br from-yellow-500/20 to-amber-600/20 text-yellow-500`}><Coins className="h-5 w-5" /></span>
    case "premium":
      return <span className={`${base} border-violet-500/30 bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20 text-violet-500`}><Crown className="h-5 w-5" /></span>
    case "theme":
      return <span className={`${base} border-cyan-500/30 bg-gradient-to-br from-cyan-500/20 to-sky-600/20 text-cyan-500`}><Palette className="h-5 w-5" /></span>
    case "badge":
      return <span className={`${base} border-amber-500/30 bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-500`}><Star className="h-5 w-5" /></span>
    case "animation":
      return <span className={`${base} border-pink-500/30 bg-gradient-to-br from-pink-500/20 to-rose-600/20 text-pink-500`}><Zap className="h-5 w-5" /></span>
    case "effect":
      return <span className={`${base} border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/20 to-purple-600/20 text-fuchsia-500`}><Zap className="h-5 w-5" /></span>
    default:
      return <span className={`${base} border-rose-500/30 bg-gradient-to-br from-rose-500/20 to-red-600/20 text-rose-500`}><Heart className="h-5 w-5" /></span>
  }
}

export function GiftModal({ open, onOpenChange, recipient, context, onGiftSent }: GiftModalProps) {
  const { toast } = useToast()
  const { user, getAuthHeader, refreshUser } = useAuth()
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null)
  const [message, setMessage] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadingGifts, setLoadingGifts] = useState(false)
  const [gifts, setGifts] = useState<GiftItem[]>([])
  const [userBalance, setUserBalance] = useState(0)

  useEffect(() => {
    setUserBalance(Number(user?.loop_coins || 0))
  }, [user?.loop_coins])

  useEffect(() => {
    if (!open) return
    const load = async () => {
      setLoadingGifts(true)
      try {
        const response = await fetch("/api/gifts")
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Failed to load gifts")
        const list = (data.data?.gifts || data.gifts || []) as GiftItem[]
        setGifts(list)
        if (list[0]) setSelectedGift(list[0])
      } catch (error: any) {
        toast({ title: "Gifts unavailable", description: error.message, variant: "destructive" })
      } finally {
        setLoadingGifts(false)
      }
    }
    void load()
  }, [open, toast])

  const groupedGifts = useMemo(() => {
    return gifts.reduce(
      (acc, gift) => {
        const key = gift.type || "special"
        if (!acc[key]) acc[key] = []
        acc[key].push(gift)
        return acc
      },
      {} as Record<string, GiftItem[]>,
    )
  }, [gifts])

  const tabKeys = Object.keys(groupedGifts)
  const defaultTab = tabKeys[0] || "coins"

  const handleSendGift = async () => {
    if (!selectedGift || !user) return
    if (userBalance < selectedGift.cost) {
      toast({
        title: "Insufficient Coins",
        description: "You don't have enough Loop Coins for this gift.",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    try {
      const response = await fetch("/api/gifts/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          recipient_id: recipient.id,
          gift_item_id: selectedGift.id,
          message: message.trim(),
          is_anonymous: isAnonymous,
          context,
          effects: selectedGift.effects,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send gift")
      }

      setUserBalance(Number(data.new_balance ?? userBalance - selectedGift.cost))

      try {
        await supabase.channel(`user:${recipient.id}`).send({
          type: "broadcast",
          event: "gift_received",
          payload: {
            gift_name: selectedGift.name,
            gift_type: selectedGift.type,
            rarity: selectedGift.rarity,
            sender: isAnonymous
              ? null
              : {
                  id: user.id,
                  username: user.username,
                  display_name: user.display_name,
                  avatar_url: user.avatar_url,
                },
            message: message.trim() || null,
            context,
          },
        })
      } catch {}

      toast({
        title: "Gift sent",
        description: `You sent ${selectedGift.name} to ${recipient.display_name}.`,
      })

      onGiftSent?.({
        id: selectedGift.id,
        name: selectedGift.name,
        cost: selectedGift.cost,
        type: selectedGift.type,
        rarity: selectedGift.rarity,
      })

      onOpenChange(false)
      setSelectedGift(null)
      setMessage("")
      setIsAnonymous(false)
      await refreshUser()
    } catch (error: any) {
      toast({
        title: "Gift failed",
        description: error.message || "Failed to send gift.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const getContextIcon = () => {
    if (!context) return <Gift className="h-4 w-4" />
    switch (context.type) {
      case "post":
        return <MessageCircle className="h-4 w-4" />
      case "reel":
        return <Zap className="h-4 w-4" />
      case "branch":
        return <TreePine className="h-4 w-4" />
      default:
        return <Gift className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-violet-500" />
            Send a Gift
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={recipient.avatar_url || "/placeholder.svg"} alt={recipient.display_name} />
              <AvatarFallback>{recipient.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{recipient.display_name}</p>
              <p className="text-sm text-muted-foreground">@{recipient.username}</p>
              {context && (
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {getContextIcon()}
                  <span>
                    Gift for {context.type}
                    {context.title ? `: ${context.title}` : ""}
                  </span>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Your balance</p>
              <div className="flex items-center justify-end gap-1 font-bold">
                <Coins className="h-4 w-4 text-yellow-500" />
                {userBalance.toLocaleString()}
              </div>
            </div>
          </div>

          {loadingGifts ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading gifts…
            </div>
          ) : gifts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No giftable items are available right now.
            </div>
          ) : (
            <Tabs defaultValue={defaultTab} className="w-full">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                {tabKeys.map((key) => (
                  <TabsTrigger key={key} value={key} className="capitalize">
                    {key}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(groupedGifts).map(([type, typeGifts]) => (
                <TabsContent key={type} value={type} className="mt-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {typeGifts.map((gift) => {
                      const unaffordable = userBalance < gift.cost
                      const selected = selectedGift?.id === gift.id
                      const rarity = gift.rarity || "common"
                      return (
                        <button
                          key={gift.id}
                          type="button"
                          disabled={unaffordable}
                          onClick={() => setSelectedGift(gift)}
                          className={`gift-card-3d gift-card-${rarity} relative overflow-hidden rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-violet-500 bg-violet-500/10 shadow-lg"
                              : "border-border hover:border-violet-300"
                          } ${unaffordable ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <div className={`gift-glow-${rarity} pointer-events-none absolute inset-0 opacity-60`} />
                          <div className="relative">
                            <div className="mb-2 flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`gift-icon-float inline-flex ${selected ? "scale-110" : ""}`}>
                                  {giftIcon(gift.type)}
                                </span>
                                <h3 className="text-sm font-medium">{gift.name.replace(/^Gift:\s*/, "")}</h3>
                              </div>
                              <Badge className={`text-[10px] ${rarityColors[rarity] || rarityColors.common}`}>
                                {rarity}
                              </Badge>
                            </div>
                            <p className="mb-3 text-xs text-muted-foreground">{gift.description}</p>
                            {gift.duration && (
                              <p className="mb-2 text-xs text-cyan-600 dark:text-cyan-400">Duration: {gift.duration}</p>
                            )}
                            <div className="flex items-center gap-1 text-sm font-semibold">
                              <Coins className="h-3.5 w-3.5 text-yellow-500" />
                              {gift.cost.toLocaleString()}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}

          {selectedGift && (
            <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <div>
                <Label htmlFor="gift-message">Personal message (optional)</Label>
                <Textarea
                  id="gift-message"
                  placeholder="Add a note with your gift..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded"
                />
                Send anonymously
              </label>

              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-muted-foreground">
                  <p>
                    Selected: <span className="font-medium text-foreground">{selectedGift.name}</span>
                  </p>
                  <p>
                    Cost: <span className="font-medium text-foreground">{selectedGift.cost.toLocaleString()} coins</span>
                  </p>
                  <p>
                    After gift:{" "}
                    <span className="font-medium text-foreground">
                      {(userBalance - selectedGift.cost).toLocaleString()} coins
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendGift}
                    disabled={isProcessing || userBalance < selectedGift.cost}
                    className="rounded-full bg-gradient-to-r from-violet-600 to-pink-500 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Gift className="mr-2 h-4 w-4" />
                        Send Gift
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

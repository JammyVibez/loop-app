"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Coins, Plus, Zap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Lottie } from "@/components/ui/lottie";
import { COIN, COIN_GOLD } from "@/components/shop/shop-art";
import { cn } from "@/lib/utils";

interface LoopCoinsBalanceProps {
  showDetails?: boolean;
}

interface CoinPackage {
  id: string;
  name: string;
  description: string;
  price_usd: number;
  item_data: {
    coins_amount: number;
    bonus: number;
  };
  rarity: string;
}

/** The value tag a pack carries, if any. */
const PACK_TAG: Record<string, string> = {
  rare: "Popular",
  epic: "Best value",
  legendary: "Premium",
};

export function LoopCoinsBalance({ showDetails = false }: LoopCoinsBalanceProps) {
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCoinPackages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/shop/items?category=coins");
      const data = await response.json();
      if (data.success) setPackages(data.items || []);
    } catch (error) {
      console.error("Error fetching coin packages:", error);
      toast({
        title: "Couldn't load coin packs",
        description: "Your balance is untouched — try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) void fetchCoinPackages();
  }, [open, fetchCoinPackages]);

  const handlePurchase = async (pkg: CoinPackage) => {
    if (!user?.token) {
      toast({ title: "Sign in first", description: "Coins are added to your account.", variant: "destructive" });
      return;
    }
    setPurchasing(pkg.id);
    try {
      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ item_id: pkg.id, payment_method: "stripe" }),
      });
      const data = await response.json();
      if (data.success && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      toast({
        title: "That didn't go through",
        description: data.error || "Nothing was charged.",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Error purchasing coins:", error);
      toast({
        title: "That didn't go through",
        description: "Nothing was charged — try again.",
        variant: "destructive",
      });
    } finally {
      setPurchasing(null);
    }
  };

  const formatCoins = (coins: number) => {
    if (coins >= 1000000) return `${(coins / 1000000).toFixed(1)}M`;
    if (coins >= 1000) return `${(coins / 1000).toFixed(coins >= 10000 ? 0 : 1)}K`;
    return coins.toString();
  };

  const sorted = [...packages].sort(
    (a, b) => Number(a.item_data?.coins_amount || 0) - Number(b.item_data?.coins_amount || 0),
  );

  const packs = (
    <div className="space-y-2 pt-1">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Lottie animation={COIN} className="h-20 w-20" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No coin packs are on sale right now. Earn coins in Quests in the meantime.
        </p>
      ) : (
        sorted.map((pkg) => {
          const amount = Number(pkg.item_data?.coins_amount || 0);
          const bonus = Number(pkg.item_data?.bonus || 0);
          const tag = PACK_TAG[pkg.rarity];
          return (
            <div
              key={pkg.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20",
                pkg.rarity === "legendary" && "border-amber-500/30",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Lottie
                  animation={pkg.rarity === "legendary" ? COIN_GOLD : COIN}
                  className="h-11 w-11 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {(amount + bonus).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">coins</span>
                    {tag ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <Zap className="h-2.5 w-2.5" />
                        {tag}
                      </span>
                    ) : null}
                  </div>
                  {bonus > 0 ? (
                    <p className="mt-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      +{bonus.toLocaleString()} bonus included
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => void handlePurchase(pkg)}
                disabled={purchasing === pkg.id}
                className="shrink-0 rounded-full px-4 text-xs font-semibold"
              >
                {purchasing === pkg.id ? (
                  <Lottie animation={COIN} className="h-4 w-4" />
                ) : (
                  `$${Number(pkg.price_usd || 0).toFixed(2)}`
                )}
              </Button>
            </div>
          );
        })
      )}
    </div>
  );

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-amber-500" />
            Get Loop Coins
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
          Coins are what the shop runs on. Buy them here, or earn them free in Quests.
        </p>
        {packs}
      </DialogContent>
    </Dialog>
  );

  if (!showDetails) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 rounded-full">
            <Coins className="mr-1.5 h-4 w-4 text-amber-500" />
            <span className="font-semibold tabular-nums">{formatCoins(user?.loop_coins || 0)}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-amber-500" />
              Get Loop Coins
            </DialogTitle>
          </DialogHeader>
          <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">
            Coins are what the shop runs on. Buy them here, or earn them free in Quests.
          </p>
          {packs}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Coins className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Loop Coins balance</h3>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <Lottie animation={COIN} className="h-16 w-16 shrink-0" />
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {(user?.loop_coins || 0).toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Earned from quests, tips and posts that land well.
          </p>
        </div>
      </div>
      <Button onClick={() => setOpen(true)} className="mt-4 w-full rounded-full">
        <Plus className="mr-1.5 h-4 w-4" />
        Top up
      </Button>
      {dialog}
    </div>
  );
}

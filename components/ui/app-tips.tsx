"use client"

import { useState, useEffect, memo } from "react"
import { cn } from "@/lib/utils"
import {
  Zap,
  GitBranch,
  Gift,
  Users,
  Sparkles,
  Shield,
  Trophy,
  MessageCircle,
  Swords,
  Coins,
  Eye,
  Palette,
  Radio,
  Rocket,
  Heart,
} from "lucide-react"

interface Tip {
  icon: any
  title: string
  description: string
  color: string
}

const APP_TIPS: Tip[] = [
  {
    icon: GitBranch,
    title: "Loop Trees",
    description: "Every post can branch. Reply to create a tree of conversations — up to 10 levels deep.",
    color: "text-emerald-500",
  },
  {
    icon: Zap,
    title: "Co-Loop",
    description: "Start a real-time collaborative session. Build content together with other creators live.",
    color: "text-amber-500",
  },
  {
    icon: Gift,
    title: "Send Gifts",
    description: "Show love with gifts! Send coins, themes, or premium items to your favorite creators.",
    color: "text-pink-500",
  },
  {
    icon: Users,
    title: "Circles",
    description: "Join communities (Circles) to chat, share, and collaborate with people who share your interests.",
    color: "text-cyan-500",
  },
  {
    icon: Swords,
    title: "Duels",
    description: "Create prediction duels on any content. Let the community vote — see who's right!",
    color: "text-rose-500",
  },
  {
    icon: Coins,
    title: "Earn Coins",
    description: "Get weekly bonuses, earn from gifts, and climb the leaderboard. Coins unlock cosmetics and premium features.",
    color: "text-yellow-500",
  },
  {
    icon: Palette,
    title: "Themes & Cosmetics",
    description: "Customize your profile with themes, frames, auras, and badges from the shop.",
    color: "text-violet-500",
  },
  {
    icon: Eye,
    title: "Double-Tap to Like",
    description: "Double-tap any media to instantly like it — just like your favorite social apps.",
    color: "text-rose-400",
  },
  {
    icon: MessageCircle,
    title: "Nested Comments",
    description: "Reply to any comment to create threaded discussions. Conversations stay organized.",
    color: "text-blue-500",
  },
  {
    icon: Shield,
    title: "Verification",
    description: "Get verified to earn a blue checkmark. Apply in Settings once you meet the criteria.",
    color: "text-sky-500",
  },
  {
    icon: Trophy,
    title: "Leaderboards",
    description: "See who's trending in your circles. Top contributors earn special badges and recognition.",
    color: "text-amber-400",
  },
  {
    icon: Radio,
    title: "Live Streams",
    description: "Go live with camera or screen share! Broadcast to your followers in real-time.",
    color: "text-red-500",
  },
  {
    icon: Sparkles,
    title: "Content Boosts",
    description: "Boost your posts with coins to get more visibility. Spend smart, grow faster.",
    color: "text-indigo-500",
  },
  {
    icon: Rocket,
    title: "Keyboard Shortcuts",
    description: "Press J/K to navigate posts, L to like, S to save. Power user mode!",
    color: "text-cyan-400",
  },
  {
    icon: Heart,
    title: "Profile Themes",
    description: "Your profile can have its own color scheme. Set it up in Settings → Profile Theme.",
    color: "text-rose-400",
  },
]

interface AppTipsProps {
  className?: string
  variant?: "loading" | "minimal" | "inline"
}

export const AppTips = memo(function AppTips({
  className,
  variant = "loading",
}: AppTipsProps) {
  const [currentTip, setCurrentTip] = useState(() =>
    Math.floor(Math.random() * APP_TIPS.length)
  )

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % APP_TIPS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const tip = APP_TIPS[currentTip]
  const Icon = tip.icon

  if (variant === "minimal") {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", tip.color)} />
        <span className="line-clamp-1">{tip.description}</span>
      </div>
    )
  }

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 transition-all duration-500",
          className
        )}
      >
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted")}>
          <Icon className={cn("h-4 w-4", tip.color)} />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">{tip.description}</p>
      </div>
    )
  }

  // Full loading variant with animated transition
  return (
    <div className={cn("space-y-3 text-center", className)}>
      <div className="flex items-center justify-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 transition-all duration-500"
          )}
        >
          <Icon className={cn("h-5 w-5 transition-colors duration-500", tip.color)} />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold text-foreground">{tip.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2 max-w-[240px]">
            {tip.description}
          </p>
        </div>
      </div>
      {/* Tip indicator dots */}
      <div className="flex items-center justify-center gap-1">
        {APP_TIPS.slice(0, 8).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 rounded-full transition-all duration-300",
              i === currentTip % 8 ? "w-4 bg-primary" : "w-1 bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  )
})

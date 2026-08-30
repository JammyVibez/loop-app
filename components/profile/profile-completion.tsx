"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Camera,
  FileText,
  MapPin,
  LinkIcon,
  Users,
  Award,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileCompletionProps {
  profile: {
    avatar_url?: string
    bio?: string
    location?: string
    website?: string
    banner_url?: string
    tagged_circles?: Array<{ id: string; name: string; avatar_url?: string | null }>
    achievements?: any[]
    loops_count?: number
  }
}

interface CompletionItem {
  id: string
  label: string
  description: string
  completed: boolean
  action: string
  icon: any
  href?: string
}

export function ProfileCompletionIndicator({ profile }: ProfileCompletionProps) {
  const [expanded, setExpanded] = useState(false)

  const items: CompletionItem[] = [
    {
      id: "avatar",
      label: "Add a profile photo",
      description: "Profiles with photos get 10x more views",
      completed: Boolean(profile.avatar_url),
      action: "Upload",
      icon: Camera,
      href: "/settings?tab=profile",
    },
    {
      id: "bio",
      label: "Write a bio",
      description: "Tell people who you are and what you create",
      completed: Boolean(profile.bio && profile.bio.length > 10),
      action: "Write",
      icon: FileText,
      href: "/settings?tab=profile",
    },
    {
      id: "location",
      label: "Add your location",
      description: "Help others find you locally",
      completed: Boolean(profile.location),
      action: "Add",
      icon: MapPin,
      href: "/settings?tab=profile",
    },
    {
      id: "website",
      label: "Link your website",
      description: "Drive traffic to your other platforms",
      completed: Boolean(profile.website),
      action: "Link",
      icon: LinkIcon,
      href: "/settings?tab=profile",
    },
    {
      id: "banner",
      label: "Add a banner image",
      description: "Make your profile stand out visually",
      completed: Boolean(profile.banner_url),
      action: "Upload",
      icon: Camera,
      href: "/settings?tab=profile",
    },
    {
      id: "circles",
      label: "Join a community",
      description: "Connect with like-minded creators",
      completed: Boolean(profile.tagged_circles && profile.tagged_circles.length > 0),
      action: "Browse",
      icon: Users,
      href: "/circles",
    },
    {
      id: "first_post",
      label: "Post your first loop",
      description: "Share something with the world",
      completed: Boolean(profile.loops_count && profile.loops_count > 0),
      action: "Create",
      icon: Award,
      href: "/create",
    },
  ]

  const completedCount = items.filter((i) => i.completed).length
  const percentage = Math.round((completedCount / items.length) * 100)

  // Don't show if fully complete
  if (percentage >= 100) return null

  const circumference = 2 * Math.PI * 18
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3"
        >
          {/* Circle Progress */}
          <div className="relative h-12 w-12 shrink-0">
            <svg className="h-12 w-12 -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-muted/50"
              />
              <circle
                cx="20"
                cy="20"
                r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-primary transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
              {percentage}%
            </span>
          </div>

          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Complete your profile</p>
            <p className="text-xs text-muted-foreground">
              {completedCount}/{items.length} steps done — {items.length - completedCount} remaining
            </p>
          </div>

          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-90"
            )}
          />
        </button>

        {/* Expandable Steps */}
        {expanded && (
          <div className="mt-4 space-y-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-2 transition-colors",
                  item.completed ? "bg-emerald-500/5" : "hover:bg-muted/50"
                )}
              >
                {item.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-medium", item.completed && "text-muted-foreground line-through")}>
                    {item.label}
                  </p>
                  {!item.completed && (
                    <p className="text-[10px] text-muted-foreground">{item.description}</p>
                  )}
                </div>
                {!item.completed && item.href && (
                  <Link href={item.href}>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-primary">
                      {item.action}
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/community-engine"
import {
  Award,
  Star,
  MessageCircle,
  Users,
  Palette,
  BookOpen,
  Trophy,
  Flame,
  Target,
  Lightbulb,
  Handshake,
  Calendar,
  ExternalLink,
} from "lucide-react"
import Link from "next/link"

interface MemberReputationProps {
  member: {
    id: string
    username: string
    display_name?: string
    avatar_url?: string
    is_verified?: boolean
    is_premium?: boolean
    role?: string
    reputation?: number
    recognitions?: string[]
    contribution_stats?: {
      discussions?: number
      comments?: number
      reactions?: number
      projects?: number
      challenges?: number
      events_attended?: number
    }
  }
  viewerRole?: string
  compact?: boolean
}

const RECOGNITION_CONFIG: Record<string, { label: string; icon: typeof Award; color: string }> = {
  knowledge_keeper: { label: "Knowledge Keeper", icon: BookOpen, color: "text-amber-500 bg-amber-500/10" },
  creator: { label: "Creator", icon: Palette, color: "text-fuchsia-500 bg-fuchsia-500/10" },
  connector: { label: "Connector", icon: Handshake, color: "text-sky-500 bg-sky-500/10" },
  conversation_starter: { label: "Conversation Starter", icon: MessageCircle, color: "text-indigo-500 bg-indigo-500/10" },
  organizer: { label: "Organizer", icon: Calendar, color: "text-emerald-500 bg-emerald-500/10" },
  top_contributor: { label: "Top Contributor", icon: Flame, color: "text-orange-500 bg-orange-500/10" },
  problem_solver: { label: "Problem Solver", icon: Lightbulb, color: "text-cyan-500 bg-cyan-500/10" },
  mentor: { label: "Mentor", icon: Target, color: "text-rose-500 bg-rose-500/10" },
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  founder: { label: "Founder", color: "text-amber-600 bg-amber-500/15 border-amber-500/30" },
  admin: { label: "Admin", color: "text-red-600 bg-red-500/15 border-red-500/30" },
  moderator: { label: "Moderator", color: "text-indigo-600 bg-indigo-500/15 border-indigo-500/30" },
  member: { label: "Member", color: "text-muted-foreground bg-muted border-border" },
}

export function MemberReputation({ member, viewerRole, compact = false }: MemberReputationProps) {
  const [expanded, setExpanded] = useState(false)
  
  const reputation = member.reputation || 0
  const recognitions = member.recognitions || []
  const stats = member.contribution_stats || {}
  const role = member.role || "member"
  
  // Calculate reputation tier
  let tier = "Newcomer"
  let tierColor = "text-muted-foreground"
  if (reputation >= 1000) { tier = "Legend"; tierColor = "text-amber-500" }
  else if (reputation >= 500) { tier = "Expert"; tierColor = "text-fuchsia-500" }
  else if (reputation >= 200) { tier = "Contributor"; tierColor = "text-indigo-500" }
  else if (reputation >= 50) { tier = "Active"; tierColor = "text-emerald-500" }
  else if (reputation >= 10) { tier = "Regular"; tierColor = "text-sky-500" }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className={cn("flex items-center gap-1 text-xs font-semibold", tierColor)}>
          <Award className="h-3 w-3" />
          {formatNumber(reputation)}
        </div>
        {recognitions.length > 0 && (
          <div className="flex items-center gap-1">
            {recognitions.slice(0, 2).map((r) => {
              const config = RECOGNITION_CONFIG[r]
              if (!config) return null
              const Icon = config.icon
              return (
                <span key={r} className={cn("flex h-5 w-5 items-center justify-center rounded-full", config.color)}>
                  <Icon className="h-3 w-3" />
                </span>
              )
            })}
            {recognitions.length > 2 && (
              <span className="text-[10px] text-muted-foreground">+{recognitions.length - 2}</span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${member.username}`}>
          <Avatar className="h-12 w-12">
            <AvatarImage src={member.avatar_url || ""} alt="" />
            <AvatarFallback className="text-sm font-bold">
              {(member.display_name || member.username || "U").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/profile/${member.username}`} className="text-sm font-bold truncate hover:underline">
              {member.display_name || member.username}
            </Link>
            {member.is_verified && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500/15">
                <Award className="h-2.5 w-2.5 text-blue-500" />
              </span>
            )}
            {member.is_premium && (
              <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                PRO
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">@{member.username}</p>
        </div>
        
        <Badge variant="outline" className={cn("text-[10px] font-bold border", ROLE_CONFIG[role]?.color)}>
          {ROLE_CONFIG[role]?.label}
        </Badge>
      </div>
      
      {/* Reputation */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1.5 text-lg font-extrabold", tierColor)}>
            <Star className="h-5 w-5" />
            {formatNumber(reputation)}
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Reputation</p>
            <p className={cn("text-xs font-semibold", tierColor)}>{tier}</p>
          </div>
        </div>
      </div>
      
      {/* Recognitions */}
      {recognitions.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Recognitions</p>
          <div className="flex flex-wrap gap-1.5">
            {recognitions.map((r) => {
              const config = RECOGNITION_CONFIG[r]
              if (!config) return null
              const Icon = config.icon
              return (
                <Badge key={r} variant="outline" className={cn("gap-1 text-[10px] font-semibold border", config.color)}>
                  <Icon className="h-3 w-3" /> {config.label}
                </Badge>
              )
            })}
          </div>
        </div>
      )}
      
      {/* Stats toggle */}
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full text-[11px] text-muted-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide stats" : "Show contribution stats"}
      </Button>
      
      {expanded && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{stats.discussions || 0}</p>
            <p className="text-[10px] text-muted-foreground">Discussions</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{stats.comments || 0}</p>
            <p className="text-[10px] text-muted-foreground">Comments</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{stats.reactions || 0}</p>
            <p className="text-[10px] text-muted-foreground">Reactions</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{stats.projects || 0}</p>
            <p className="text-[10px] text-muted-foreground">Projects</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{stats.challenges || 0}</p>
            <p className="text-[10px] text-muted-foreground">Challenges</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-lg font-bold">{stats.events_attended || 0}</p>
            <p className="text-[10px] text-muted-foreground">Events</p>
          </div>
        </div>
      )}
    </div>
  )
}

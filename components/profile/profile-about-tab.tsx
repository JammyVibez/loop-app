"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { useAuth } from "@/hooks/use-auth"
import {
  MapPin,
  LinkIcon,
  Calendar,
  Shield,
  Star,
  Crown,
  Users,
  Flame,
  Eye,
  Heart,
  MessageCircle,
  GitBranch,
  ExternalLink,
  Edit3,
  Clock,
  Award,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ProfileAboutProps {
  profile: {
    id: string
    username: string
    display_name: string
    bio?: string
    avatar_url?: string
    banner_url?: string
    location?: string
    website?: string
    created_at: string
    is_verified?: boolean
    is_premium?: boolean
    is_admin?: boolean
    is_organization?: boolean
    organization_name?: string
    loop_coins?: number
    level?: number
    tagged_circles?: string[]
    achievements?: Array<{
      id: string
      name: string
      description: string
      icon?: string
      earned_at?: string
    }>
    stats?: {
      loops_count?: number
      branches_count?: number
      followers_count?: number
      following_count?: number
      likes_received?: number
      views_received?: number
    }
    recent_loops?: any[]
  }
  isOwnProfile?: boolean
  onEdit?: () => void
}

function formatJoinDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })
}

function formatTimeAgo(dateStr: string) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function formatNumber(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export function ProfileAboutTab({ profile, isOwnProfile, onEdit }: ProfileAboutProps) {
  const stats = profile.stats || {}
  const memberSince = formatJoinDate(profile.created_at)
  const daysSinceJoin = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const socialLinks = [
    profile.website ? { label: "Website", url: profile.website, icon: LinkIcon } : null,
  ].filter(Boolean) as Array<{ label: string; url: string; icon: typeof LinkIcon }>

  return (
    <div className="space-y-4 p-4">
      {/* Bio */}
      {profile.bio && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">About</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
            <Flame className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <p className="text-sm font-bold">{formatNumber(stats.loops_count || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Loops</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10">
            <GitBranch className="h-4 w-4 text-cyan-500" />
          </div>
          <div>
            <p className="text-sm font-bold">{formatNumber(stats.branches_count || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Branches</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10">
            <Heart className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <p className="text-sm font-bold">{formatNumber(stats.likes_received || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Likes</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 p-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Eye className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold">{formatNumber(stats.views_received || 0)}</p>
            <p className="text-[10px] text-muted-foreground">Views</p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">Details</h3>

        {/* Location */}
        {profile.location && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{profile.location}</span>
          </div>
        )}

        {/* Website */}
        {profile.website && (
          <div className="flex items-center gap-3 text-sm">
            <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <a
              href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              {profile.website.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {/* Join Date */}
        <div className="flex items-center gap-3 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>Joined {memberSince}</span>
        </div>

        {/* Level */}
        {profile.level && profile.level > 0 && (
          <div className="flex items-center gap-3 text-sm">
            <Award className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Level {profile.level}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {profile.level >= 50 ? "Legendary" : profile.level >= 25 ? "Expert" : profile.level >= 10 ? "Skilled" : "Growing"}
            </Badge>
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {profile.is_verified && (
            <Badge variant="outline" className="gap-1 text-xs border-blue-500/30 text-blue-500">
              <Shield className="h-3 w-3" /> Verified
            </Badge>
          )}
          {profile.is_premium && (
            <Badge variant="outline" className="gap-1 text-xs border-amber-500/30 text-amber-500">
              <Crown className="h-3 w-3" /> Premium
            </Badge>
          )}
          {profile.is_admin && (
            <Badge variant="outline" className="gap-1 text-xs border-violet-500/30 text-violet-500">
              <Star className="h-3 w-3" /> Admin
            </Badge>
          )}
          {profile.is_organization && (
            <Badge variant="outline" className="gap-1 text-xs border-cyan-500/30 text-cyan-500">
              <Users className="h-3 w-3" /> {profile.organization_name || "Organization"}
            </Badge>
          )}
        </div>
      </div>

      {/* Tagged Circles */}
      {profile.tagged_circles && profile.tagged_circles.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Communities</h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.tagged_circles.map((circle) => (
              <Badge key={circle} variant="secondary" className="text-xs">
                {circle}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {profile.achievements && profile.achievements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            Achievements ({profile.achievements.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {profile.achievements.slice(0, 6).map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-2.5 rounded-xl bg-muted/30 p-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-lg">
                  {achievement.icon || "🏆"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{achievement.name}</p>
                  {achievement.earned_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {formatTimeAgo(achievement.earned_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Button for Own Profile */}
      {isOwnProfile && onEdit && (
        <Button
          variant="outline"
          onClick={onEdit}
          className="w-full gap-2 rounded-full"
        >
          <Edit3 className="h-4 w-4" />
          Edit Profile
        </Button>
      )}
    </div>
  )
}

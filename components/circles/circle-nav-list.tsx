"use client"

import { ArrowLeft, ChevronRight, Hash, Zap, Video, MessageCircle, Calendar, Users, Trophy, Star, Settings, Megaphone, BookOpen, Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"

interface CircleNavListProps {
  circle: any
  isJoined: boolean
  userRole: string
  memberCount: number
  onlineCount?: number
  onNavigate: (section: string) => void
}

interface NavItem {
  id: string
  label: string
  description: string
  icon: any
  color: string
  bgColor: string
  badge?: string | number
  requireMember?: boolean
}

export function CircleNavList({
  circle,
  isJoined,
  userRole,
  memberCount,
  onlineCount = 0,
  onNavigate,
}: CircleNavListProps) {
  const sections: NavItem[] = [
    {
      id: "feed",
      label: "Feed",
      description: "Posts, media, and discussions",
      icon: Hash,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      requireMember: false,
    },
    {
      id: "activity",
      label: "Activity",
      description: "Recent events and milestones",
      icon: Zap,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      requireMember: false,
    },
    {
      id: "coloop",
      label: "Co-Loop",
      description: "Collaborative sessions",
      icon: Video,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      requireMember: true,
    },
    {
      id: "chat",
      label: "Chat",
      description: "Real-time circle chat",
      icon: MessageCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      requireMember: true,
    },
    {
      id: "rooms",
      label: "Rooms",
      description: "Text, voice, and video rooms",
      icon: BookOpen,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
      requireMember: true,
    },
    {
      id: "events",
      label: "Events",
      description: "Upcoming and past events",
      icon: Calendar,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
      requireMember: false,
    },
    {
      id: "members",
      label: "Members",
      description: `${memberCount} members${onlineCount > 0 ? ` · ${onlineCount} online` : ""}`,
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      badge: memberCount,
      requireMember: false,
    },
    {
      id: "leaderboard",
      label: "Leaderboard",
      description: "Top contributors and badges",
      icon: Trophy,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      requireMember: false,
    },
    {
      id: "about",
      label: "About",
      description: "Rules, info, and settings",
      icon: Star,
      color: "text-rose-400",
      bgColor: "bg-rose-500/10",
      requireMember: false,
    },
    ...(userRole === "owner" || userRole === "admin"
      ? [
          {
            id: "studio",
            label: "Studio",
            description: "Circle settings and customization",
            icon: Settings,
            color: "text-slate-400",
            bgColor: "bg-slate-500/10",
            requireMember: false,
          } as NavItem,
        ]
      : []),
  ]

  return (
    <div className="space-y-2">
      {/* Circle Header Card */}
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
        <VideoAvatar
          src={circle?.avatar_url}
          videoSrc={circle?.video_avatar_url}
          className="h-16 w-16 border-2 border-cyan-500/30"
          fallback={circle?.name?.charAt(0) || "C"}
        />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-extrabold text-foreground truncate">{circle?.name || "Circle"}</h2>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {circle?.description || "A community for creators"}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <Badge variant="outline" className="text-[10px] border-border">
              {circle?.is_private ? "🔒 Private" : "🌐 Public"}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {memberCount} members
            </span>
            {isJoined && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
                ✓ Joined
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
        {sections.map((item) => {
          const Icon = item.icon
          const locked = item.requireMember && !isJoined

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              disabled={locked}
              className={`w-full flex items-center gap-4 px-4 py-3.5 text-left tap-feedback ${
                locked
                  ? "opacity-40 cursor-not-allowed"
                  : "hover:bg-muted/60 active:bg-muted/80 cursor-pointer transition-colors duration-200"
              }`}
            >
              {/* Icon */}
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.bgColor} transition-transform duration-200 group-hover:scale-110`}>
                <Icon className={`h-5 w-5 ${item.color} transition-transform duration-200`} />
              </div>

              {/* Label & Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{item.label}</span>
                  {locked && (
                    <span className="text-[10px] text-muted-foreground">🔒</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.description}</p>
              </div>

              {/* Badge & Arrow */}
              <div className="flex items-center gap-2 shrink-0">
                {item.badge !== undefined && (
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    {item.badge}
                  </Badge>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200" style={{ transform: undefined }} />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

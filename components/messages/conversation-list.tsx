"use client"

import { useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, MessageCircle } from "lucide-react"

interface Conversation {
  id: string
  is_group?: boolean
  name?: string | null
  other_user?: {
    id: string
    username?: string
    display_name?: string
    avatar_url?: string
    active_cosmetics?: any
    cosmetics?: any
  } | null
  last_message?: {
    content?: string
    created_at?: string
    message_type?: string
    sender_id?: string
    author_id?: string
  } | null
  unread_count?: number
}

interface ConversationListProps {
  conversations: Conversation[]
  selectedId: string | null
  search: string
  onSearchChange: (value: string) => void
  onSelect: (id: string) => void
  loading: boolean
  currentUserId?: string
  inboxTab: "chats" | "calls"
  onTabChange: (tab: "chats" | "calls") => void
}

function convoTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
  const diffDays = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000,
  )
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" })
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function ConversationList({
  conversations,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  loading,
  currentUserId,
  inboxTab,
  onTabChange,
}: ConversationListProps) {
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => {
      const name = c.name || c.other_user?.display_name || c.other_user?.username || ""
      const lastMsg = c.last_message?.content || ""
      return name.toLowerCase().includes(q) || lastMsg.toLowerCase().includes(q)
    })
  }, [conversations, search])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-foreground">Messages</h1>
          <Badge variant="secondary" className="text-xs">
            {conversations.length}
          </Badge>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
          {(["chats", "calls"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={cn(
                "flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all",
                inboxTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab === "chats" ? "Chats" : "Calls"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search conversations..."
            className="pl-9 h-9 text-xs bg-muted/50 border-border/50"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                <div className="h-12 w-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-2.5 w-40 bg-muted/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageCircle className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">{search ? "No matches" : "No conversations yet"}</p>
            <p className="text-xs opacity-60 mt-1">
              {search ? "Try a different search" : "Start a conversation from a profile"}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((convo) => {
              const other = convo.other_user
              const displayName = convo.is_group
                ? convo.name || "Group Chat"
                : other?.display_name || other?.username || "Unknown"
              const lastContent = convo.last_message?.content || ""
              const unread = (convo.unread_count || 0)
              const isActive = String(convo.id) === String(selectedId)

              return (
                <button
                  key={convo.id}
                  type="button"
                  onClick={() => onSelect(convo.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                    isActive
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/60 border border-transparent",
                  )}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {other?.video_avatar_url ? (
                      <VideoAvatar
                        src={other.avatar_url}
                        videoSrc={other.video_avatar_url}
                        alt={displayName}
                        fallback={displayName.charAt(0)}
                        size="md"
                        className="h-12 w-12"
                      />
                    ) : (
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={other.avatar_url} />
                        <AvatarFallback className="text-sm font-bold">
                          {displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    {/* Online dot */}
                    {other && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-emerald-500" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm truncate", unread > 0 ? "font-bold" : "font-semibold")}>
                        {displayName}
                      </p>
                      {convo.last_message?.created_at && (
                        <span className={cn(
                          "text-[10px] shrink-0",
                          unread > 0 ? "text-primary font-semibold" : "text-muted-foreground",
                        )}>
                          {convoTime(convo.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={cn(
                        "text-xs truncate",
                        unread > 0 ? "text-foreground font-medium" : "text-muted-foreground",
                      )}>
                        {lastContent || "No messages yet"}
                      </p>
                      {unread > 0 && (
                        <Badge className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                          {unread > 99 ? "99+" : unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

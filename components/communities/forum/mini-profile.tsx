"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { RoleChip, type RoleBadgeLike } from "@/components/communities/forum/role-chip"
import { Loader2, MessagesSquare, ArrowUpRight, Crown, ShieldCheck } from "lucide-react"

type MiniData = {
  profile: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    bio: string | null
    is_verified?: boolean
    is_premium?: boolean
    equipped_frame_id?: string | null
  }
  membership: { role: string | null; status: string | null; contribution_score: number; joined_at: string | null } | null
  powers: Array<{ id: string; name: string; color: string | null; icon: string | null }>
  post_count: number
}

const BASE_ROLE_BADGE: Record<string, RoleBadgeLike> = {
  owner: { name: "Owner", color: "#F59E0B", icon: "crown" },
  admin: { name: "Admin", color: "#EF4444", icon: "shield" },
  moderator: { name: "Moderator", color: "#38BDF8", icon: "shield" },
  member: { name: "Member", color: "#94A3B8", icon: "user" },
}

/**
 * Tap a name in a community and this opens: who they are *in this room* —
 * their role, their Powers, what they have posted here — with one tap through
 * to the full profile for everything else.
 */
export function MiniProfile({
  communityId,
  userId,
  name,
}: {
  communityId: string
  userId: string
  name: string
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<MiniData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/members/${userId}/profile`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not load profile")
      setData(json as MiniData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const onOpen = (next: boolean) => {
    setOpen(next)
    if (next && !data) void load()
  }

  const baseRole = data?.membership?.role && BASE_ROLE_BADGE[data.membership.role]
  const memberSince = data?.membership?.joined_at
    ? new Date(data.membership.joined_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => onOpen(true)}
        className="max-w-full truncate text-left text-[13px] font-semibold text-foreground hover:underline"
      >
        {name}
      </button>

      <Dialog open={open} onOpenChange={onOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm overflow-y-auto p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{name} in this community</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{error}</p>
          ) : data ? (
            <div className="p-5">
              <div className="flex items-start gap-3">
                <Avatar className="h-14 w-14 shrink-0 rounded-2xl ring-1 ring-border">
                  <AvatarImage src={data.profile.avatar_url || undefined} alt="" />
                  <AvatarFallback className="rounded-2xl text-base font-black">
                    {(data.profile.display_name || data.profile.username || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-black leading-tight">{data.profile.display_name || name}</p>
                  <p className="truncate text-xs text-muted-foreground">@{data.profile.username || "member"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {baseRole && <RoleChip badge={baseRole} />}
                    {data.powers.map((power) => (
                      <RoleChip
                        key={power.id}
                        badge={{ name: power.name, color: power.color || undefined }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {data.profile.bio && (
                <p className="mt-3 text-sm leading-relaxed text-foreground/80">{data.profile.bio}</p>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <MessagesSquare className="h-3.5 w-3.5" /> Threads here
                  </p>
                  <p className="mt-1 text-xl font-black tabular-nums">{data.post_count}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Crown className="h-3.5 w-3.5" /> Contributed
                  </p>
                  <p className="mt-1 text-xl font-black tabular-nums">
                    {data.membership?.contribution_score || 0}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {data.profile.is_verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 font-bold text-sky-500">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                )}
                {data.profile.is_premium && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-bold text-amber-500">
                    PRO
                  </span>
                )}
                {memberSince && <span>Member since {memberSince}</span>}
              </div>

              <Button
                asChild
                variant="outline"
                className="mt-4 w-full rounded-full border-border bg-background text-foreground"
              >
                <a href={`/profile/${data.profile.username || data.profile.id}`}>
                  Open full profile <ArrowUpRight className="ml-1 h-4 w-4" />
                </a>
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
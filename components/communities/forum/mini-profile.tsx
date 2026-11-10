"use client"

import { useState } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { RoleChip, type RoleBadgeLike } from "@/components/communities/forum/role-chip"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowUpRight,
  CalendarDays,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Shield,
  UserMinus,
} from "@/components/icons/lucide-compat"

type MiniData = {
  profile: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
    banner_url: string | null
    bio: string | null
    is_verified?: boolean
    is_premium?: boolean
    equipped_frame_id?: string | null
  }
  membership: { role: string | null; status: string | null; contribution_score: number; joined_at: string | null } | null
  powers: Array<{ id: string; name: string; color: string | null; icon: string | null }>
  post_count: number
  message_count: number
  can_moderate: boolean
}

const BASE_ROLE_BADGE: Record<string, RoleBadgeLike> = {
  owner: { name: "Owner", color: "#F59E0B", icon: "crown" },
  admin: { name: "Admin", color: "#EF4444", icon: "shield" },
  moderator: { name: "Moderator", color: "#38BDF8", icon: "shield" },
  member: { name: "Member", color: "#94A3B8", icon: "user" },
}

/**
 * A member card for the Circle they are in — banner, avatar, their standing
 * here and the two or three actions you would actually take from a chat.
 * Scoped to this community on purpose: the full profile is one tap away.
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
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<MiniData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

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

  const removeMember = async () => {
    if (!window.confirm("Remove this member from the community?")) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/communities/${communityId}/members?user_id=${userId}`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Could not remove")
      toast({ title: "Member removed" })
      setOpen(false)
    } catch (e: any) {
      toast({ title: "Could not remove", description: e.message, variant: "destructive" })
    } finally {
      setRemoving(false)
    }
  }

  const baseRole = data?.membership?.role && BASE_ROLE_BADGE[data.membership.role]
  const memberSince = data?.membership?.joined_at
    ? new Date(data.membership.joined_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })
    : null
  const handle = data?.profile.username || "member"

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
        <DialogHeader className="sr-only">
          <DialogTitle>{name} in this community</DialogTitle>
        </DialogHeader>

        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm overflow-hidden border-0 bg-card p-0 shadow-2xl animate-in fade-in zoom-in-95 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <p className="py-12 text-center text-sm text-muted-foreground">{error}</p>
          ) : data ? (
            <div className="max-h-[85dvh] overflow-y-auto">
              {/* Banner — their cover, or a brand gradient when they have none. */}
              <div className="relative h-24 w-full bg-gradient-to-br from-cyan-500 via-violet-500 to-fuchsia-500">
                {data.profile.banner_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={data.profile.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-card/70 to-transparent" />
              </div>

              <div className="px-5 pb-5">
                <div className="-mt-9 flex items-end gap-3">
                  <Avatar
                    className={`h-[72px] w-[72px] rounded-full border-4 border-card bg-card shadow-lg ${
                      data.profile.is_premium ? "ring-2 ring-amber-400/80" : ""
                    } ${data.profile.equipped_frame_id ? "ring-2 ring-violet-400/80" : ""}`}
                  >
                    <AvatarImage src={data.profile.avatar_url || undefined} alt="" />
                    <AvatarFallback className="rounded-full text-xl font-black">
                      {(data.profile.display_name || handle).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="mb-1 flex gap-1.5">
                    {data.profile.is_verified && <VerifiedSeal size={16} title="Verified" />}
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <p className="truncate text-lg font-black leading-tight">
                    {data.profile.display_name || name}
                  </p>
                  {data.profile.is_premium && (
                    <span className="rounded-full bg-amber-400/15 px-1.5 py-px text-[10px] font-bold text-amber-500">
                      PRO
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">@{handle}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {baseRole && <RoleChip badge={baseRole} />}
                  {data.powers.map((power) => (
                    <RoleChip key={power.id} badge={{ name: power.name, color: power.color || undefined }} />
                  ))}
                </div>

                {data.profile.bio && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground/80">
                    {data.profile.bio}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-base font-black tabular-nums">{data.post_count}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Threads
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-base font-black tabular-nums">{data.message_count}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Replies
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/50 p-2">
                    <p className="text-base font-black tabular-nums">
                      {data.membership?.contribution_score || 0}
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Contributed
                    </p>
                  </div>
                </div>

                {memberSince && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> Joined {memberSince}
                  </p>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    asChild
                    size="sm"
                    className="rounded-full bg-gradient-to-br from-cyan-500 to-violet-500 text-white hover:from-cyan-400 hover:to-violet-400"
                  >
                    <a href={`/messages?user=${data.profile.id}`}>
                      <MessageCircle className="mr-1.5 h-4 w-4" /> Message
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-full border-border">
                    <Link href={`/profile/${handle}`}>
                      <ArrowUpRight className="mr-1.5 h-4 w-4" /> Full profile
                    </Link>
                  </Button>
                </div>

                {data.can_moderate && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void removeMember()}
                    disabled={removing}
                    className="mt-2 w-full rounded-full text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {removing ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserMinus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Remove from community
                  </Button>
                )}

                {data.can_moderate && (
                  <p className="mt-1 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                    <Shield className="h-3 w-3" /> You moderate this community
                  </p>
                )}
                <span className="sr-only">
                  <MessagesSquare className="hidden" />
                </span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
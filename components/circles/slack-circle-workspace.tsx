"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Bell,
  Check,
  Crown,
  Hash,
  Loader2,
  Lock,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RealtimeCircleChat } from "@/components/circles/realtime-circle-chat"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface Room {
  id: string
  name: string
  description?: string | null
  type?: string
  is_private?: boolean
  created_by?: string
  created_at: string
}

interface Member {
  id: string
  user?: {
    id: string
    username: string
    display_name: string
    avatar_url?: string | null
    is_verified?: boolean
    is_premium?: boolean
  }
  role?: string
  status?: string
}

const SLACK_SIDEBAR = "bg-[#1f2023] text-[#d1d2d3]"

export function SlackCircleWorkspace({ circleId }: { circleId: string }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const router = useRouter()

  const [circle, setCircle] = useState<any>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [memberRailOpen, setMemberRailOpen] = useState(true)

  // channel CRUD
  const [createOpen, setCreateOpen] = useState(false)
  const [editRoom, setEditRoom] = useState<Room | null>(null)
  const [channelName, setChannelName] = useState("")
  const [channelDesc, setChannelDesc] = useState("")
  const [savingChannel, setSavingChannel] = useState(false)
  const [search, setSearch] = useState("")

  const loadCircle = useCallback(async () => {
    try {
      const res = await fetch(`/api/circles/${circleId}`, { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.circle) {
        toast({ title: "Community unavailable", description: data.error || "You don't have access to this community.", variant: "destructive" })
        router.replace("/circles")
        return
      }
      setCircle(data.circle)
      const roomList: Room[] = data.rooms || []
      setRooms(roomList)
      if (!activeRoomId && roomList.length > 0) setActiveRoomId(roomList[0].id)
    } catch (error) {
      console.error("Failed to load circle:", error)
      toast({ title: "Failed to load community", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [circleId, getAuthHeader, router, toast])

  useEffect(() => {
    if (circleId) void loadCircle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId])

  const loadRooms = useCallback(async () => {
    try {
      const res = await fetch(`/api/circles/${circleId}/rooms?limit=100`, { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRooms(data.rooms || [])
        setActiveRoomId((prev) => {
          if (prev) return prev
          const list: Room[] = data.rooms || []
          return list.length ? list[0].id : null
        })
      }
    } catch {
      /* ignore */
    }
  }, [circleId, getAuthHeader])

  const loadMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/circles/${circleId}/members?limit=100`, { headers: getAuthHeader() })
      const data = await res.json().catch(() => ({}))
      if (res.ok) setMembers(data.members || [])
    } catch {
      /* ignore */
    }
  }, [circleId, getAuthHeader])

  useEffect(() => {
    void loadRooms()
    void loadMembers()
  }, [loadRooms, loadMembers])

  const activeRoom = useMemo(() => rooms.find((r) => r.id === activeRoomId) || null, [rooms, activeRoomId])
  const isManager = useMemo(() => {
    if (!circle) return false
    const role = String(circle.user_role || circle.membership?.role || "guest")
    return ["owner", "admin", "moderator"].includes(role)
  }, [circle])

  const filteredRooms = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rooms
    return rooms.filter((r) => r.name.toLowerCase().includes(q) || (r.description || "").toLowerCase().includes(q))
  }, [rooms, search])

  const createChannel = async () => {
    if (!channelName.trim() || savingChannel) return
    setSavingChannel(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          name: channelName.trim(),
          description: channelDesc.trim() || undefined,
          type: "text",
          is_private: false,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create channel")
      await loadRooms()
      setActiveRoomId(data.room.id)
      setChannelName("")
      setChannelDesc("")
      setCreateOpen(false)
      toast({ title: "Channel created", description: `#${data.room.name} is live.` })
    } catch (error: any) {
      toast({ title: "Couldn't create channel", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setSavingChannel(false)
    }
  }

  const saveChannel = async () => {
    if (!editRoom || savingChannel) return
    setSavingChannel(true)
    try {
      const res = await fetch(`/api/circles/${circleId}/rooms`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          roomId: editRoom.id,
          name: channelName.trim() || editRoom.name,
          description: channelDesc,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update channel")
      await loadRooms()
      setEditRoom(null)
      toast({ title: "Channel updated" })
    } catch (error: any) {
      toast({ title: "Couldn't update channel", description: error.message || "Unknown error", variant: "destructive" })
    } finally {
      setSavingChannel(false)
    }
  }

  const deleteChannel = async (room: Room) => {
    if (!window.confirm(`Delete #${room.name}? Messages in it will be removed.`)) return
    try {
      const res = await fetch(`/api/circles/${circleId}/rooms?roomId=${room.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete channel")
      setRooms((prev) => prev.filter((r) => r.id !== room.id))
      if (activeRoomId === room.id) {
        const remaining = rooms.filter((r) => r.id !== room.id)
        setActiveRoomId(remaining.length ? remaining[0].id : null)
      }
      toast({ title: "Channel deleted" })
    } catch (error: any) {
      toast({ title: "Couldn't delete channel", description: error.message || "Unknown error", variant: "destructive" })
    }
  }

  const sidebar = (
    <div className={cn("flex h-full flex-col", SLACK_SIDEBAR)}>
      {/* Workspace header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left hover:bg-white/5"
          onClick={() => setSidebarOpen(false)}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarImage src={circle?.avatar_url} />
            <AvatarFallback className="bg-white/10 text-[11px] text-white">{(circle?.name || "P")[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-white">{circle?.name || "Loading…"}</p>
            <p className="flex items-center gap-1 text-[10px] text-white/60">
              <Crown className="h-3 w-3 text-amber-400" /> Pro Community
            </p>
          </div>
        </button>
        <button
          type="button"
          aria-label="Close sidebar"
          className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels…"
            className="h-8 rounded-md border-white/10 bg-white/5 pl-8 text-[12px] text-white placeholder:text-white/40 focus-visible:ring-0"
          />
        </div>

        {/* Channels */}
        <div className="mb-1 flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Channels</p>
          {isManager && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-white/60 hover:bg-white/10 hover:text-white"
              title="Create channel"
              onClick={() => { setCreateOpen(true); setSidebarOpen(false) }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="space-y-0.5">
          {filteredRooms.length === 0 && (
            <p className="px-1 py-2 text-[11px] text-white/40">
              {isManager ? "No channels yet — create one." : "No channels available."}
            </p>
          )}
          {filteredRooms.map((room) => (
            <div key={room.id} className="group relative">
              <button
                type="button"
                onClick={() => { setActiveRoomId(room.id); setSidebarOpen(false) }}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                  activeRoomId === room.id
                    ? "bg-[#1164a3] font-semibold text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="min-w-0 flex-1 truncate">{room.name}</span>
                {room.is_private && <Lock className="h-3 w-3 shrink-0 opacity-60" />}
              </button>
              {isManager && (
                <div className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 group-hover:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 bg-[#2d2f33] text-white/70 hover:bg-[#3a3d42] hover:text-white">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={() => { setEditRoom(room); setChannelName(room.name); setChannelDesc(room.description || "") }}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Rename channel
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-400" onClick={() => void deleteChannel(room)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete channel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Members */}
        <div className="mb-1 mt-4 flex items-center justify-between px-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Members</p>
          <span className="text-[10px] text-white/40">{members.length}</span>
        </div>
        <div className="space-y-0.5">
          {members.slice(0, 12).map((member) => {
            const u = Array.isArray(member.user) ? member.user[0] : member.user
            const name = u?.display_name || u?.username || "member"
            return (
              <Link
                key={member.id || u?.id}
                href={`/profile/${u?.username || ""}`}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-[12px] text-white/75 hover:bg-white/10 hover:text-white"
              >
                <span className="relative shrink-0">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={u?.avatar_url || undefined} />
                    <AvatarFallback className="bg-white/15 text-[9px] text-white">{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-[#1f2023] bg-emerald-400" />
                </span>
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {member.role === "owner" && <Crown className="h-3 w-3 shrink-0 text-amber-400" />}
              </Link>
            )
          })}
          {members.length > 12 && (
            <p className="px-2 py-1 text-[11px] text-white/40">+{members.length - 12} more</p>
          )}
        </div>
      </div>

      {/* Current user */}
      {user && (
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2.5">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="bg-white/15 text-[10px] text-white">{(user.display_name || "U")[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-white">{user.display_name}</p>
            <p className="truncate text-[10px] text-white/50">Pro member</p>
          </div>
        </div>
      )}
    </div>
  )

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading workspace…
      </div>
    )
  }

  if (!circle) return null

  return (
    <div className="relative flex h-[calc(100dvh-7.5rem)] min-h-[32rem] overflow-hidden rounded-2xl border border-border bg-background shadow-sm lg:h-[calc(100dvh-8.5rem)]">
      {/* Sidebar — desktop always visible, mobile overlay */}
      <div className={cn("absolute inset-y-0 left-0 z-40 w-64 shrink-0 lg:static lg:z-auto", sidebarOpen ? "block" : "hidden lg:block")}>
        {sidebar}
      </div>
      {sidebarOpen && (
        <button type="button" aria-label="Close sidebar" className="absolute inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main chat pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slack-style top bar */}
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-2 sm:px-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <Link href="/circles" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" title="Back to communities">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight">
              <span className="text-muted-foreground">{circle.name} /</span>{" "}
              {activeRoom ? (
                <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5 text-muted-foreground" />{activeRoom.name}</span>
              ) : (
                <span className="text-muted-foreground">Pick a channel</span>
              )}
            </p>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {members.length} Pro members · {rooms.length} channels · live
            </p>
          </div>
          <Badge variant="outline" className="hidden items-center gap-1 border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-500 sm:inline-flex">
            <Crown className="h-3 w-3" /> Pro only
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 text-muted-foreground", memberRailOpen ? "bg-muted text-foreground" : "")}
            title="Toggle member list"
            onClick={() => setMemberRailOpen((v) => !v)}
          >
            <Users className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="More">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {isManager && (
                <DropdownMenuItem onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create channel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <Link href={`/circles/${circleId}/admin`}>
                  <Settings className="mr-2 h-4 w-4" /> Community settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/premium">
                  <Bell className="mr-2 h-4 w-4" /> Pro perks
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {activeRoom ? (
          <div className="min-h-0 flex-1 overflow-hidden">
            <RealtimeCircleChat
              circleId={circleId}
              roomId={activeRoom.id}
              roomName={activeRoom.name}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <Hash className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">No channel selected</p>
            <p className="max-w-xs text-xs">
              {isManager
                ? "Create your first channel to start the conversation."
                : "Ask a community manager to add channels."}
            </p>
            {isManager && (
              <Button size="sm" className="mt-2" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" /> Create channel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Members rail (desktop) */}
      {memberRailOpen && (
        <div className="hidden w-56 shrink-0 flex-col border-l border-border bg-card/50 lg:flex">
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Members</p>
            <span className="text-[11px] text-muted-foreground">{members.length}</span>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto p-2">
            {members.map((member) => {
              const u = Array.isArray(member.user) ? member.user[0] : member.user
              const name = u?.display_name || u?.username || "member"
              return (
                <Link
                  key={member.id || u?.id}
                  href={`/profile/${u?.username || ""}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={u?.avatar_url || undefined} />
                    <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate">{name}</span>
                  {member.role === "owner" && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                  {u?.is_premium && (
                    <Badge className="shrink-0 rounded-full border-0 bg-amber-400/15 px-1.5 py-0 text-[9px] text-amber-500">PRO</Badge>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Create channel dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Hash className="h-4 w-4" /> Create a channel</DialogTitle>
            <DialogDescription>Channels live in the sidebar — members can chat in realtime.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ch-name">Name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ch-name"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                  placeholder="e.g. announcements"
                  className="pl-9"
                  onKeyDown={(e) => e.key === "Enter" && void createChannel()}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ch-desc">Description (optional)</Label>
              <Textarea
                id="ch-desc"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                placeholder="What is this channel for?"
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void createChannel()} disabled={!channelName.trim() || savingChannel}>
              {savingChannel ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename channel dialog */}
      <Dialog open={Boolean(editRoom)} onOpenChange={(open) => !open && setEditRoom(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-4 w-4" /> Edit channel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="edit-name"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-desc">Description</Label>
              <Textarea
                id="edit-desc"
                value={channelDesc}
                onChange={(e) => setChannelDesc(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoom(null)}>Cancel</Button>
            <Button onClick={() => void saveChannel()} disabled={!channelName.trim() || savingChannel}>
              {savingChannel ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/community-engine"
import { Plus, FolderOpen, Users, CheckCircle2, Circle, Loader2, Trash2, Lock } from "lucide-react"
import { DeviceMediaPicker, type PickedMedia } from "./device-media-picker"

interface Project {
  id: number
  title: string
  description: string
  cover_url: string | null
  status: string
  progress: number
  tags: string[]
  contributor_count: number
  task_count: number
  done_task_count: number
  created_at: string
  creator?: { username?: string; display_name?: string; avatar_url?: string | null }
}

export function WorldProjects({
  communityId,
  initial,
  isMember,
  isModerator,
  focusId,
  onFocused,
}: {
  communityId: string
  initial: Project[]
  isMember: boolean
  isModerator: boolean
  focusId?: number
  onFocused?: () => void
}) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>(initial)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tags, setTags] = useState("")
  const [cover, setCover] = useState("")
  const [coverUpload, setCoverUpload] = useState<PickedMedia[]>([])
  const uploadedCoverRef = useRef<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [active, setActive] = useState<Project | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newTask, setNewTask] = useState("")

  // Deep-link focus from What's Happening / Community Loop
  useEffect(() => {
    if (!focusId) return
    let attempts = 0
    const tryScroll = () => {
      attempts += 1
      const el = document.getElementById(`world-project-${focusId}`)
      if (el) {
        setFlashId(focusId)
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        setTimeout(() => {
          setFlashId(null)
          if (onFocused) onFocused()
        }, 2400)
      } else if (attempts < 10) {
        setTimeout(tryScroll, 180)
      } else if (onFocused) {
        onFocused()
      }
    }
    tryScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, projects.length])

  const create = async () => {
    if (!title.trim()) return setError("Project needs a title")
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/communities/${communityId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), cover_url: cover || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create")
      setOpen(false)
      setProjects((prev) => [data.project, ...prev])
      setTitle("")
      setDescription("")
      setTags("")
      setCover("")
      setCoverUpload([])
      uploadedCoverRef.current = null
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCoverUpload = (items: PickedMedia[]) => {
    setCoverUpload(items)
    if (items[0]) {
      uploadedCoverRef.current = items[0].url
      setCover(items[0].url)
    } else if (uploadedCoverRef.current && cover === uploadedCoverRef.current) {
      setCover("")
      uploadedCoverRef.current = null
    }
  }

  const openProject = async (p: Project) => {
    setActive(p)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/communities/${communityId}/projects/${p.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load")
      setDetail(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const joinProject = async (p: Project) => {
    if (!user) return
    const res = await fetch(`/api/communities/${communityId}/projects/${p.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join" }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    if (detail && active?.id === p.id) openProject(p)
    else {
      setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, contributor_count: x.contributor_count + 1 } : x)))
    }
  }

  const addTask = async () => {
    if (!newTask.trim() || !active) return
    const res = await fetch(`/api/communities/${communityId}/projects/${active.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTask.trim() }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Failed")
      return
    }
    setNewTask("")
    openProject(active)
  }

  const updateTask = async (task: any, status: string) => {
    if (!active) return
    const res = await fetch(`/api/communities/${communityId}/projects/${active.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", task_id: task.id, status }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || "Failed")
      return
    }
    openProject(active)
  }

  const deleteTask = async (taskId: number) => {
    if (!active) return
    const res = await fetch(`/api/communities/${communityId}/projects/${active.id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", task_id: taskId }),
    })
    if (res.ok) openProject(active)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Community Projects</h2>
          <p className="text-xs text-muted-foreground">Build together — join a project, contribute, watch progress grow.</p>
        </div>
        {isMember && (
          <Button size="sm" className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New project
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <FolderOpen className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold">No projects yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isMember ? "Start the first collaborative build." : "Projects will appear when members start building."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {projects.map((p) => (
            <button
              key={p.id}
              id={`world-project-${p.id}`}
              onClick={() => openProject(p)}
              className={`group rounded-2xl border bg-card p-4 text-left transition hover:border-indigo-500/40 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 scroll-mt-24 ${
                flashId === p.id ? "border-indigo-500 ring-2 ring-indigo-500/40" : "border-border"
              }`}
            >
              {p.cover_url && (
                <div className="relative -mx-4 -mt-4 mb-3 h-24 overflow-hidden rounded-t-2xl">
                  <Image src={p.cover_url} alt="" fill className="object-cover" unoptimized />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate group-hover:text-indigo-500 transition-colors">{p.title}</p>
                  <Badge variant="secondary" className="mt-1 text-[9px] capitalize">{p.status}</Badge>
                </div>
                <span className="text-xs font-extrabold text-indigo-500 shrink-0">{p.progress}%</span>
              </div>
              {p.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
              <Progress value={p.progress} className="mt-3 h-1.5" />
              <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {p.contributor_count} contributors</span>
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> {p.done_task_count}/{p.task_count} tasks</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a community project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 rounded-xl" maxLength={120} placeholder="e.g. Community Tier List" />
            </div>
            <div>
              <label className="text-xs font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl text-sm min-h-[80px]" maxLength={3000} />
            </div>
            <div>
              <label className="text-xs font-medium">Cover</label>
              <Input value={cover} onChange={(e) => setCover(e.target.value)} className="mt-1 rounded-xl" placeholder="https://… or upload one below (optional)" />
              <div className="mt-1.5">
                <DeviceMediaPicker
                  items={coverUpload}
                  onChange={handleCoverUpload}
                  maxItems={1}
                  folder="community-projects"
                  accept="image/*"
                  compact
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Tags</label>
              <Input value={tags} onChange={(e) => setTags(e.target.value)} className="mt-1 rounded-xl" placeholder="comma, separated" />
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create} disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project detail dialog */}
      <Dialog open={Boolean(active)} onOpenChange={(o) => { if (!o) setActive(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <FolderOpen className="h-5 w-5 text-indigo-500" /> {detail.project?.title}
                </DialogTitle>
              </DialogHeader>

              {detail.project?.description && (
                <p className="text-sm text-muted-foreground">{detail.project.description}</p>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <p className="text-lg font-extrabold">{detail.project?.progress || 0}%</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Complete</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <p className="text-lg font-extrabold">{detail.project?.members?.length || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Contributors</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                  <p className="text-lg font-extrabold">{detail.project?.task_count || 0}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Tasks</p>
                </div>
              </div>

              {/* Contributors */}
              {detail.project?.members && detail.project.members.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {detail.project.members.map((m: any) => (
                    <div key={m.user_id} className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-2.5">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={m.user?.avatar_url || ""} alt="" />
                        <AvatarFallback className="text-[9px]">{(m.user?.display_name || m.user?.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-medium">{m.user?.display_name || m.user?.username}</span>
                      {m.role === "lead" && <Badge className="text-[8px] h-4">lead</Badge>}
                    </div>
                  ))}
                </div>
              )}

              {/* Join */}
              {!detail.is_contributor && isMember && (
                <Button size="sm" className="rounded-full w-fit" onClick={() => joinProject(active!)}>
                  <Users className="h-3.5 w-3.5 mr-1.5" /> Join project
                </Button>
              )}
              {!isMember && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Join the community to contribute.</p>
              )}

              {/* Tasks */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold">Tasks</h3>
                  <span className="text-[11px] text-muted-foreground">
                    {detail.project?.done_task_count}/{detail.project?.task_count} done
                  </span>
                </div>
                {(detail.is_contributor || isModerator) && (
                  <div className="flex gap-2 mb-3">
                    <Input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Add a task…" className="rounded-xl h-9 text-sm" onKeyDown={(e) => e.key === "Enter" && addTask()} />
                    <Button size="sm" className="rounded-full h-9" onClick={addTask} disabled={!newTask.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                {(detail.project?.tasks || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No tasks yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {detail.project.tasks.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
                        {t.status === "done" ? (
                          <button onClick={() => updateTask(t, "todo")} className="text-emerald-500">
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => updateTask(t, "done")} className="text-muted-foreground hover:text-emerald-500">
                            <Circle className="h-4 w-4" />
                          </button>
                        )}
                        <span className={`text-xs flex-1 ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                        {t.assignee && (
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={t.assignee.avatar_url || ""} alt="" />
                            <AvatarFallback className="text-[8px]">{(t.assignee.display_name || t.assignee.username || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        )}
                        {(detail.is_contributor || isModerator) && (
                          <button onClick={() => deleteTask(t.id)} className="text-muted-foreground hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
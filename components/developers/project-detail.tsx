"use client"

import { useCallback, useEffect, useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { useLoginGate } from "@/hooks/use-login-gate"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
  Crown,
  Download,
  FileText,
  
  LogOut,
  MessageCircle,
  Send,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wrench,
} from "lucide-react"
import { CodeLoopCard } from "@/components/developers/code-loop-card"
import { ProjectRepoBrowser } from "@/components/developers/project-repo-browser"
import { Spinner } from "@/components/ui/skeletons"

interface CommentAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  video_avatar_url?: string | null
  is_verified?: boolean
}

interface ProjectComment {
  id: string
  content: string
  parent_comment_id?: string | null
  created_at: string
  user_id: string
  author?: CommentAuthor
  replies?: ProjectComment[]
}

function timeAgo(iso?: string) {
  if (!iso) return ""
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return "just now"
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h`
  if (ms < 86_400_000 * 7) return `${Math.floor(ms / 86_400_000)}d`
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function ProjectDetail({ project }: { project: any }) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, LoginGateDialog } = useLoginGate()

  const projectId = project.id
  const isOwner = Boolean(user && project.author_id === user.id)

  // ---- Comments ----
  const [comments, setComments] = useState<ProjectComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState("")
  const [replyTo, setReplyTo] = useState<ProjectComment | null>(null)
  const [posting, setPosting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/comments`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load comments")
      setComments(data.comments || [])
    } catch (err: any) {
      console.error("Load project comments failed:", err)
    } finally {
      setCommentsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchComments()
  }, [fetchComments])

  // Realtime comments
  useEffect(() => {
    const channel = supabase.channel(`dev-project-comments:${projectId}`)
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_comments",
          filter: `project_id=eq.${projectId}`,
        },
        () => void fetchComments(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [projectId, fetchComments])

  const postComment = async () => {
    if (!requireAuth("comment")) return
    const content = commentText.trim()
    if (!content) return
    setPosting(true)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          content,
          parent_comment_id: replyTo?.id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to post comment")
      setCommentText("")
      setReplyTo(null)
      await fetchComments()
    } catch (err: any) {
      toast({ title: "Couldn't post comment", description: err.message, variant: "destructive" })
    } finally {
      setPosting(false)
    }
  }

  const deleteComment = async (comment: ProjectComment) => {
    if (!window.confirm("Delete this comment? Replies will be removed too.")) return
    setDeletingId(comment.id)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/comments/${comment.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to delete comment")
      await fetchComments()
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" })
    } finally {
      setDeletingId(null)
    }
  }

  const canDeleteComment = (comment: ProjectComment) =>
    Boolean(user) && (comment.user_id === user?.id || isOwner)

  // ---- Collaborators ----
  interface Collaborator {
    id: string
    user_id: string
    role: "owner" | "maintainer" | "contributor"
    joined_at: string
    user?: {
      id: string
      username: string
      display_name: string
      avatar_url?: string | null
      video_avatar_url?: string | null
      is_verified?: boolean
    }
  }

  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(true)
  const [inviteUsername, setInviteUsername] = useState("")
  const [inviteRole, setInviteRole] = useState<"maintainer" | "contributor">("contributor")
  const [inviting, setInviting] = useState(false)
  const [collabBusyId, setCollabBusyId] = useState<string | null>(null)

  const fetchCollaborators = useCallback(async () => {
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/collaborators`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to load collaborators")
      setCollaborators(data.collaborators || [])
    } catch (err: any) {
      console.error("Load collaborators failed:", err)
    } finally {
      setCollaboratorsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchCollaborators()
  }, [fetchCollaborators])

  // Realtime collaborator updates
  useEffect(() => {
    const channel = supabase.channel(`dev-project-collaborators:${projectId}`)
    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_collaborators",
          filter: `project_id=eq.${projectId}`,
        },
        () => void fetchCollaborators(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [projectId, fetchCollaborators])

  const currentCollab = collaborators.find((c) => c.user_id === user?.id)
  const canManageCollabs = isOwner || Boolean(currentCollab && currentCollab.role !== "contributor")

  const inviteCollaborator = async () => {
    if (!requireAuth("post")) return
    const username = inviteUsername.trim()
    if (!username) return
    setInviting(true)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ username, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to add collaborator")
      setInviteUsername("")
      toast({ title: `@${data.collaborator?.user?.username || username} added as ${inviteRole}` })
      await fetchCollaborators()
    } catch (err: any) {
      toast({ title: "Couldn't add collaborator", description: err.message, variant: "destructive" })
    } finally {
      setInviting(false)
    }
  }

  const changeRole = async (collab: Collaborator, role: Collaborator["role"]) => {
    setCollabBusyId(collab.user_id)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/collaborators/${collab.user_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ role }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update role")
      setCollaborators((prev) =>
        prev.map((c) => (c.user_id === collab.user_id ? { ...c, role: data.collaborator.role } : c)),
      )
      toast({ title: `Role updated to ${role}` })
    } catch (err: any) {
      toast({ title: "Role update failed", description: err.message, variant: "destructive" })
    } finally {
      setCollabBusyId(null)
    }
  }

  const removeCollaborator = async (collab: Collaborator) => {
    const leavingSelf = collab.user_id === user?.id
    if (
      !window.confirm(
        leavingSelf ? "Leave this project?" : `Remove @${collab.user?.username || "this user"} from the project?`,
      )
    ) {
      return
    }
    setCollabBusyId(collab.user_id)
    try {
      const res = await fetch(`/api/developers/projects/${projectId}/collaborators/${collab.user_id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to remove collaborator")
      setCollaborators((prev) => prev.filter((c) => c.user_id !== collab.user_id))
      toast({ title: leavingSelf ? "You left the project" : `Removed @${collab.user?.username || "user"}` })
    } catch (err: any) {
      toast({ title: "Remove failed", description: err.message, variant: "destructive" })
    } finally {
      setCollabBusyId(null)
    }
  }

  const ROLE_META = {
    owner: { label: "Owner", icon: Crown, classes: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
    maintainer: {
      label: "Maintainer",
      icon: Shield,
      classes: "text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
    },
    contributor: {
      label: "Contributor",
      icon: Wrench,
      classes: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
    },
  } as const

  return (
    <>
      {LoginGateDialog}
      <div className="space-y-6">
        <CodeLoopCard project={project} onDeleted={() => (window.location.href = "/developers")} />

        {/* GitHub-style repo browser for ZIP-based projects */}
        {Array.isArray(project.file_tree) && project.file_tree.length > 0 && (
          <ProjectRepoBrowser project={project} isOwner={isOwner} />
        )}

        {/* Attached files */}
        {Array.isArray(project.files) && project.files.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-cyan-500" /> Attached files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {project.files.map((file: any) => (
                <a
                  key={file.url}
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3 transition hover:border-cyan-500/40"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{file.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {file.size ? <span>{(file.size / 1024).toFixed(0)} KB</span> : null}
                    <Download className="h-4 w-4" />
                  </div>
                </a>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Collaborators */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-emerald-500" />
              Collaborators
              <span className="text-sm font-normal text-muted-foreground">
                {collaboratorsLoading ? "" : `· ${collaborators.length}`}
              </span>
            </CardTitle>
            <CardDescription>
              Everyone building on this project. Maintainers can invite people and manage roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {collaboratorsLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading collaborators…
              </div>
            ) : collaborators.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No collaborators yet — invite your first teammate.
              </p>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collab) => {
                  const member = collab.user || { id: "", username: "user", display_name: "User", avatar_url: null }
                  const roleMeta = ROLE_META[collab.role] || ROLE_META.contributor
                  const RoleIcon = roleMeta.icon
                  const isSelf = collab.user_id === user?.id
                  const isOwnerRow = collab.role === "owner"
                  return (
                    <div
                      key={collab.user_id}
                      className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <VideoAvatar
                          src={member.avatar_url}
                          videoSrc={(member as any).video_avatar_url}
                          isPremium={(member as any).is_premium}
                          fallback={(member.display_name || member.username || "U").charAt(0).toUpperCase()}
                          size="sm"
                          className="h-9 w-9 shrink-0 rounded-full"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">
                              {member.display_name || member.username}
                            </span>
                            {isSelf && (
                              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                you
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">@{member.username}</p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <Badge className={`rounded-full border ${roleMeta.classes}`}>
                          <RoleIcon className="mr-1 h-3 w-3" />
                          {roleMeta.label}
                        </Badge>

                        {canManageCollabs && !isOwnerRow && (
                          <>
                            <select
                              value={collab.role}
                              onChange={(e) => void changeRole(collab, e.target.value as Collaborator["role"])}
                              disabled={collabBusyId === collab.user_id}
                              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                              title="Change role"
                            >
                              <option value="maintainer">Maintainer</option>
                              <option value="contributor">Contributor</option>
                            </select>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => void removeCollaborator(collab)}
                              disabled={collabBusyId === collab.user_id}
                              title={`Remove ${member.display_name || member.username}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        {!canManageCollabs && isSelf && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 rounded-full text-xs"
                            onClick={() => void removeCollaborator(collab)}
                            disabled={collabBusyId === collab.user_id}
                          >
                            <LogOut className="h-3.5 w-3.5" />
                            Leave
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {canManageCollabs && (
              <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="collab-username" className="text-xs text-muted-foreground">
                    Invite by username
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="collab-username"
                      placeholder="@username"
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          void inviteCollaborator()
                        }
                      }}
                      className="flex-1 rounded-xl"
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "maintainer" | "contributor")}
                      className="h-10 rounded-xl border border-border bg-background px-2 text-xs"
                      title="Role"
                    >
                      <option value="contributor">Contributor</option>
                      <option value="maintainer">Maintainer</option>
                    </select>
                    <Button
                      onClick={() => void inviteCollaborator()}
                      disabled={inviting || !inviteUsername.trim()}
                      className="h-10 shrink-0 gap-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      {inviting ? <Spinner className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                      <span className="hidden sm:inline">Add</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-5 w-5 text-indigo-500" />
              Discussion
              <span className="text-sm font-normal text-muted-foreground">
                {commentsLoading ? "" : `· ${comments.length} thread${comments.length === 1 ? "" : "s"}`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {commentsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" /> Loading comments…
              </div>
            ) : comments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No discussion yet — ask a question or leave feedback.
              </p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const author: CommentAuthor = comment.author || { id: "", username: "", display_name: "" }
                  return (
                    <div key={comment.id}>
                      <div className="flex gap-3">
                        <VideoAvatar
                          src={author.avatar_url}
                          videoSrc={(author as any).video_avatar_url}
                          isPremium={(author as any).is_premium}
                          fallback={(author.username || "U").charAt(0).toUpperCase()}
                          size="sm"
                          className="h-9 w-9 shrink-0 rounded-full"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold">
                              {author.display_name || author.username || "user"}
                            </span>
                            <span className="text-xs text-muted-foreground">@{author.username || "user"}</span>
                            <span className="text-xs text-muted-foreground/70">· {timeAgo(comment.created_at)}</span>
                          </div>
                          <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                          <div className="mt-1 flex items-center gap-3">
                            <button
                              type="button"
                              className="text-xs font-semibold text-indigo-500 transition hover:text-indigo-400"
                              onClick={() => setReplyTo(comment)}
                            >
                              Reply
                            </button>
                            {canDeleteComment(comment) && (
                              <button
                                type="button"
                                className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive"
                                onClick={() => void deleteComment(comment)}
                                disabled={deletingId === comment.id}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {(comment.replies || []).length > 0 && (
                        <div className="mt-3 space-y-3 border-l-2 border-border/60 pl-4 ml-[18px]">
                          {(comment.replies || []).map((reply) => {
                            const rAuthor: CommentAuthor = reply.author || { id: "", username: "", display_name: "" }
                            return (
                              <div key={reply.id} className="flex gap-3">
                                <VideoAvatar
                                  src={rAuthor.avatar_url}
                                  videoSrc={(rAuthor as any).video_avatar_url}
                                  isPremium={(rAuthor as any).is_premium}
                                  fallback={(rAuthor.username || "U").charAt(0).toUpperCase()}
                                  size="sm"
                                  className="h-7 w-7 shrink-0 rounded-full"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                    <span className="text-sm font-semibold">
                                      {rAuthor.display_name || rAuthor.username || "user"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">@{rAuthor.username || "user"}</span>
                                    <span className="text-xs text-muted-foreground/70">· {timeAgo(reply.created_at)}</span>
                                  </div>
                                  <p className="mt-0.5 text-sm leading-relaxed whitespace-pre-wrap">{reply.content}</p>
                                  {canDeleteComment(reply) && (
                                    <button
                                      type="button"
                                      className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition hover:text-destructive"
                                      onClick={() => void deleteComment(reply)}
                                      disabled={deletingId === reply.id}
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Composer */}
            <div className="border-t border-border/60 pt-4">
              {replyTo && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-indigo-500/10 px-3 py-1.5 text-xs">
                  <span className="text-indigo-500">
                    Replying to @{replyTo.author?.username || "user"}
                  </span>
                  <button type="button" onClick={() => setReplyTo(null)} className="font-semibold text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  placeholder={replyTo ? `Reply to @${replyTo.author?.username || "user"}…` : "Share feedback or ask a question…"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void postComment()
                    }
                  }}
                  className="min-h-[44px] flex-1 rounded-2xl border-border/60"
                />
                <Button
                  size="icon"
                  className="h-[44px] w-[44px] shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-fuchsia-500 text-white"
                  onClick={() => void postComment()}
                  disabled={!commentText.trim() || posting}
                >
                  {posting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

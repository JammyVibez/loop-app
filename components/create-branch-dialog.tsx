"use client";
import type React from "react";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { VideoAvatar } from "@/components/cosmetics/video-avatar";
import { GitBranch, Type, ImageIcon, Video, Music, FileText, Upload, X, CheckCircle2, ArrowUpRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { VerifiedSeal } from "@/components/ui/verified-seal"
import { Spinner } from "@/components/ui/skeletons"

const MAX_BRANCH_CHARS = 1000;

interface CreateBranchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentLoop: any
  /** Optional — fired with the new branch id instead of a full page reload. */
  onBranchCreated?: (branchId: string) => void
}

function parentContentText(parentLoop: any): string {
  if (!parentLoop) return ""
  const c = parentLoop.content
  if (typeof c === "string") return c
  if (c && typeof c === "object") return c.text || c.content || ""
  return parentLoop.content_text || parentLoop.contentText || ""
}

function parentAuthor(parentLoop: any): any {
  const a = parentLoop?.author
  if (!a) return null
  if (typeof a === "string") return { display_name: a }
  return a
}

export function CreateBranchDialog({ open, onOpenChange, parentLoop, onBranchCreated }: CreateBranchDialogProps) {
  const [activeTab, setActiveTab] = useState("text")
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** Set after a successful post — the dialog flips to a confirmation step. */
  const [createdBranchId, setCreatedBranchId] = useState<string | null>(null)
  /** Branch mode: "new" = write your own take, "rebranch" = repost the same content */
  const [branchMode, setBranchMode] = useState<"new" | "rebranch" | null>(null)
  const [rebranchQuote, setRebranchQuote] = useState("")
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()
  const router = useRouter()

  const resetForm = () => {
    setContent("")
    setTitle("")
    setSelectedFile(null)
    setActiveTab("text")
    setCreatedBranchId(null)
    setBranchMode(null)
    setRebranchQuote("")
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  const parentPreview = useMemo(() => parentContentText(parentLoop), [parentLoop])
  const author = useMemo(() => parentAuthor(parentLoop), [parentLoop])
  const authorName = author?.display_name || author?.username || author?.name || "Someone"
  const authorHandle = author?.username ? `@${author.username}` : ""
  const parentMedia = parentLoop?.media_url || parentLoop?.media_urls?.[0] || parentLoop?.content_media_url || ""
  const parentMediaIsVideo = /\.(mp4|webm|mov|ogg|m4v)(\?|$)/i.test(parentMedia)
  // Branch limits are owned by the root post of the tree; fetch the resolved
  // values so the dialog reflects the author's choice instead of a fixed cap.
  const [branchLimits, setBranchLimits] = useState<{
    maxDepth: number | null
    maxPerUser: number | null
    used: number
  }>({
    maxDepth: Number(parentLoop?.max_branch_depth) > 0 ? Number(parentLoop.max_branch_depth) : null,
    maxPerUser: Number(parentLoop?.max_branches_per_user) > 0 ? Number(parentLoop.max_branches_per_user) : null,
    used: 0,
  })

  useEffect(() => {
    if (!open || !parentLoop?.id) return
    let cancelled = false
    fetch(`/api/loops/${parentLoop.id}/branch-limits`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.success) return
        setBranchLimits({
          maxDepth: Number(data.max_depth) > 0 ? Number(data.max_depth) : null,
          maxPerUser: Number(data.max_branches_per_user) > 0 ? Number(data.max_branches_per_user) : null,
          used: Number(data.branches_used || 0),
        })
      })
      .catch(() => { /* fall back to the seeded/uncapped values */ })
    return () => {
      cancelled = true
    }
  }, [open, parentLoop?.id])

  const parentDepth = Number(parentLoop?.tree_depth || 0)
  const treeDepth = parentDepth + 1
  const atMaxDepth = branchLimits.maxDepth != null && parentDepth >= branchLimits.maxDepth
  const perUserReached =
    branchLimits.maxPerUser != null && branchLimits.used >= branchLimits.maxPerUser
  const branchBlocked = atMaxDepth || perUserReached
  const depthBadge =
    branchLimits.maxDepth == null
      ? `level ${treeDepth}`
      : `level ${treeDepth}/${branchLimits.maxDepth}`

  const filePreviewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : null),
    [selectedFile],
  )

  // Free the object URL we created for the file preview (memory hygiene).
  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl)
    }
  }, [filePreviewUrl])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select a file smaller than 50MB", variant: "destructive" })
      return
    }
    setSelectedFile(file)
    e.target.value = ""
  }

  const handleSubmit = async () => {
    if (atMaxDepth) {
      toast({
        title: "Branch depth limit reached",
        description: `This post allows branches up to ${branchLimits.maxDepth} levels deep.`,
        variant: "destructive",
      })
      return
    }
    if (perUserReached) {
      toast({
        title: "Branch limit reached",
        description: `You've used your ${branchLimits.maxPerUser} branches on this post.`,
        variant: "destructive",
      })
      return
    }
    if (!content.trim() && !selectedFile) {
      toast({ title: "Content required", description: "Add your perspective, a file, or both to branch this loop.", variant: "destructive" })
      return
    }
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to branch." })
      return
    }

    setIsSubmitting(true)

    try {
      const formData = new FormData()
      formData.append("content", content)
      formData.append("title", title)
      formData.append("type", activeTab)
      formData.append("parent_id", parentLoop.id)
      if (selectedFile) {
        formData.append("file", selectedFile)
      }

      const response = await fetch("/api/loops/branch", {
        method: "POST",
        body: formData,
        headers: { ...getAuthHeader() },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to create branch")
      }

      toast({ title: "Branch created 🌿", description: "Your branch is now part of the loop tree." })

      const branchId = result.branch?.id
      if (branchId) {
        // Success step: keep the dialog open so the user can view their new
        // branch or keep branching — same flow as the create hub.
        setCreatedBranchId(branchId)
      } else {
        resetForm()
        onOpenChange(false)
      }
    } catch (error: any) {
      toast({
        title: "Couldn't create branch",
        description: error?.message || "Failed to create branch. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const mediaTab = activeTab === "image" || activeTab === "video" || activeTab === "audio" || activeTab === "file"

  const handleRebranch = async () => {
    if (branchBlocked) {
      toast({
        title: atMaxDepth ? "Branch depth limit reached" : "Branch limit reached",
        description: atMaxDepth
          ? `This post allows branches up to ${branchLimits.maxDepth} levels deep.`
          : `You've used your ${branchLimits.maxPerUser} branches on this post.`,
        variant: "destructive",
      })
      return
    }
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to rebranch." })
      return
    }
    setIsSubmitting(true)
    try {
      const quoteText = rebranchQuote.trim()
      const formData = new FormData()

      if (quoteText) {
        // Quote rebranch: a top-level post of your own that embeds the
        // original by reference. Nothing from the original is copied, so the
        // post you quote keeps its own text, media and replies.
        formData.append("content", quoteText)
        formData.append("quoted_loop_id", parentLoop.id)
        formData.append("type", "text")
      } else {
        // Simple rebranch: repost the loop itself, exactly as before.
        const parentContent = parentContentText(parentLoop) || ""
        const rebranchText = parentContent || `Rebranched from @${author?.username || "someone"}`
        const parentMediaUrl = parentLoop?.media_url || parentLoop?.media_urls?.[0] || parentLoop?.content_media_url || ""
        const parentMediaType = parentLoop?.media_type || parentLoop?.content_type || "text"

        formData.append("content", rebranchText)
        formData.append("title", parentLoop?.content_title || "")
        formData.append("type", parentMediaType)
        formData.append("parent_id", parentLoop.id)

        // If parent has media, pass it through so the API can reference it
        if (parentMediaUrl) {
          formData.append("parent_media_url", parentMediaUrl)
          formData.append("parent_media_type", parentMediaType)
        }
        // Multi-media passthrough
        const parentMediaUrls = parentLoop?.media_urls || (parentMediaUrl ? [parentMediaUrl] : [])
        if (parentMediaUrls.length > 1) {
          formData.append("parent_media_urls", JSON.stringify(parentMediaUrls))
        }

        // Pass through duels, polls, and other metadata
        if (parentLoop?.duel) {
          formData.append("parent_duel", JSON.stringify(parentLoop.duel))
        }
        if (parentLoop?.poll) {
          formData.append("parent_poll", JSON.stringify(parentLoop.poll))
        }
        if (parentLoop?.hashtags?.length) {
          formData.append("hashtags", parentLoop.hashtags.join(","))
        }
        if (parentLoop?.content_metadata) {
          formData.append("content_metadata", JSON.stringify(parentLoop.content_metadata))
        }
      }

      const response = await fetch("/api/loops/branch", {
        method: "POST",
        body: formData,
        headers: { ...getAuthHeader() },
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Failed to rebranch")
      toast(
        quoteText
          ? { title: "Quote posted", description: `Your quote of @${author?.username || "this loop"} is on your profile.` }
          : { title: "Rebranched!", description: "This loop is now on your feed." },
      )
      const branchId = result.branch?.id
      if (branchId) {
        setCreatedBranchId(branchId)
      } else {
        resetForm()
        onOpenChange(false)
      }
    } catch (error: any) {
      toast({ title: "Couldn't rebranch", description: error?.message || "Try again.", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const viewCreatedBranch = () => {
    if (!createdBranchId) return
    if (onBranchCreated) {
      onBranchCreated(createdBranchId)
    } else {
      window.dispatchEvent(
        new CustomEvent("loop-branch-created", { detail: { branch_id: createdBranchId, parent_id: parentLoop.id } }),
      )
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl border-border bg-card text-foreground max-h-[88dvh] overflow-y-auto p-0 sm:p-0">
        <DialogHeader className="sticky top-0 z-10 border-b border-border/70 bg-card px-5 pb-3 pt-5 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                <GitBranch className="h-4 w-4 text-emerald-500" />
              </span>
              {createdBranchId ? "Branch created" : "Branch this Loop"}
            </DialogTitle>
            {!createdBranchId && (
              <Link
                href="/create"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-emerald-500/40 hover:text-emerald-500"
              >
                Full studio
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <DialogDescription className="text-muted-foreground">
            {createdBranchId
              ? "Your take is live in the loop tree — others can branch from it too."
              : "Add your take to the tree — others can branch from yours too."}
          </DialogDescription>
        </DialogHeader>

        {createdBranchId ? (
          <div className="flex flex-col items-center gap-4 px-5 py-12 text-center sm:px-6">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </span>
            <div>
              <h3 className="text-lg font-bold text-foreground">Your branch is live 🌿</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                It&apos;s connected to the original loop and ready for the community to react, comment, and branch
                from. What next?
              </p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2.5 sm:flex-row">
              <Button variant="outline" className="flex-1 border-border text-foreground hover:bg-muted" onClick={resetForm}>
                Post another branch
              </Button>
              <Button
                className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
                onClick={viewCreatedBranch}
              >
                <GitBranch className="h-4 w-4" />
                View your branch
              </Button>
            </div>
          </div>
        ) : (
        <div className="space-y-5 px-5 py-4 sm:px-6">
          {/* Branch Mode Selector — choose Rebranch or Branch New */}
          {!branchMode && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">How do you want to branch?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setBranchMode("rebranch")}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border-2 border-border/60 bg-muted/30 p-5 text-center transition-all hover:border-amber-500/50 hover:bg-amber-500/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 transition group-hover:bg-amber-500/25">
                    <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Rebranch</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Repost this loop to your followers with your support</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBranchMode("new")}
                  className="group flex flex-col items-center gap-2.5 rounded-2xl border-2 border-border/60 bg-muted/30 p-5 text-center transition-all hover:border-emerald-500/50 hover:bg-emerald-500/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 transition group-hover:bg-emerald-500/25">
                    <GitBranch className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Branch New Take</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Add your own perspective, reply, or creative take</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Rebranch Confirmation View */}
          {branchMode === "rebranch" && !createdBranchId && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                    <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Rebranch this loop</p>
                    <p className="text-xs text-muted-foreground">
                      Add a quote and it posts as your own post with the original embedded. Leave it empty to
                      simply repost it, credited to {authorName}.
                    </p>
                  </div>
                </div>
              </div>

              {/* Quote composer — the outer post is yours */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Your commentary (optional)</Label>
                <Textarea
                  value={rebranchQuote}
                  onChange={(e) => setRebranchQuote(e.target.value)}
                  placeholder="Add your take — this becomes the post, with the original embedded below it…"
                  rows={2}
                  maxLength={500}
                  className="resize-none bg-background border-border text-foreground placeholder:text-muted-foreground text-sm"
                />
                <p className="text-[10px] text-muted-foreground text-right">{rebranchQuote.length}/500</p>
              </div>

              {/* Live preview — exactly how the finished quote post will read */}
              <div className="rounded-2xl border border-border/70 bg-card p-3.5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview — your post
                </p>
                <div className="flex items-center gap-2">
                  <VideoAvatar
                    src={user?.avatar_url || undefined}
                    className="h-7 w-7"
                    fallback={(user?.display_name || user?.username || "Y").charAt(0).toUpperCase()}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-xs font-semibold text-foreground">
                      {user?.display_name || user?.username || "You"}
                      {user?.is_verified && <VerifiedSeal size={13} title="Verified Creator" />}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      @{user?.username || "you"}
                    </p>
                  </div>
                </div>
                <p className={`mt-2 whitespace-pre-wrap text-[13px] leading-relaxed ${rebranchQuote.trim() ? "text-foreground/90" : "text-muted-foreground/60 italic"}`}>
                  {rebranchQuote.trim() || "Your commentary will appear here…"}
                </p>

                {/* Embedded original — the same nested card the feed renders */}
                <div className="mt-2.5 overflow-hidden rounded-xl border border-border/70 bg-muted/20">
                  <div className="flex items-center gap-2 px-3 pt-2.5">
                    <VideoAvatar
                      src={author?.avatar_url || undefined}
                      className="h-5 w-5"
                      fallback={authorName.charAt(0).toUpperCase()}
                    />
                    <span className="truncate text-[11px] font-semibold text-foreground">{authorName}</span>
                    {author?.is_verified && <VerifiedSeal size={12} title="Verified" />}
                    {authorHandle && <span className="truncate text-[10px] text-muted-foreground">{authorHandle}</span>}
                  </div>
                  <div className="space-y-1.5 px-3 pb-2.5 pt-1">
                    {parentPreview ? (
                      <p className="line-clamp-4 whitespace-pre-wrap text-[12px] leading-relaxed text-foreground/80">
                        {parentPreview}
                      </p>
                    ) : (
                      <p className="text-[12px] italic text-muted-foreground">(media post)</p>
                    )}
                    {parentMedia && (
                      <div className="overflow-hidden rounded-lg bg-black/30">
                        {parentMediaIsVideo ? (
                          <video src={parentMedia} className="max-h-40 w-full object-contain" muted playsInline preload="metadata" />
                        ) : (
                          <img src={parentMedia} alt="Original media" className="max-h-40 w-full object-contain" loading="lazy" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={() => void handleRebranch()}
                disabled={isSubmitting}
                className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold"
              >
                {isSubmitting ? (
                  <><Spinner className="h-4 w-4" /> Rebranching…</>
                ) : (
                  <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> Rebranch</>
                )}
              </Button>
              <button type="button" onClick={() => setBranchMode(null)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition">
                ← Back to options
              </button>
            </div>
          )}

          {/* New Branch Content Editor (shown only in "new" mode) */}
          {branchMode === "new" && (
          <>
          <div className="space-y-5">
          {/* Parent Loop Preview — author + media + text */}
          <div className="overflow-hidden rounded-xl border border-border/70 bg-muted/40">
            <div className="flex items-center gap-2.5 border-b border-border/60 bg-background/40 px-3.5 py-2.5">
              <VideoAvatar src={author?.avatar_url || undefined} className="h-7 w-7" fallback={authorName.charAt(0).toUpperCase()} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-xs font-semibold text-foreground">
                  <span className="truncate">{authorName}</span>
                  {author?.is_verified && (
                    <VerifiedSeal size={16} title="Verified Creator" />
                  )}
                </p>
                {authorHandle && <p className="truncate text-[10px] text-muted-foreground">{authorHandle}</p>}
              </div>
              <Badge variant="outline" className="shrink-0 gap-1 border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400">
                <GitBranch className="h-3 w-3" /> {depthBadge}
              </Badge>
            </div>

            {parentMedia && (
              <div className="relative max-h-40 overflow-hidden border-b border-border/60 bg-black">
                {parentMediaIsVideo ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={parentMedia} className="max-h-40 w-full object-contain" muted playsInline preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={parentMedia} alt="Original post media" className="max-h-40 w-full object-contain" loading="lazy" />
                )}
              </div>
            )}

            <div className="px-3.5 py-3">
              <p className="text-xs leading-relaxed text-foreground/80">
                <span className="mr-1.5 font-semibold text-emerald-600 dark:text-emerald-400">Quoting:</span>
                {parentPreview ? (
                  <span className="line-clamp-3">{parentPreview}</span>
                ) : (
                  <span className="italic text-muted-foreground">(original post with media only)</span>
                )}
              </p>
            </div>
          </div>

          {/* Content Type Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 bg-muted">
              <TabsTrigger value="text" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Type className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Text</span>
              </TabsTrigger>
              <TabsTrigger value="image" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <ImageIcon className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Image</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Video className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Music className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">Audio</span>
              </TabsTrigger>
              <TabsTrigger value="file" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <FileText className="h-4 w-4" />
                <span className="ml-1.5 hidden sm:inline">File</span>
              </TabsTrigger>
            </TabsList>

            {/* Title Input */}
            <div className="mt-4 space-y-1.5">
              <Label className="text-foreground">Branch title (optional)</Label>
              <Input
                placeholder="Give your branch a title…"
                value={title}
                maxLength={120}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <TabsContent value="text" className="mt-3 space-y-1.5">
              <Label className="text-foreground">Your addition</Label>
              <Textarea
                placeholder="Continue the story, add your perspective, or take it in a new direction…"
                value={content}
                maxLength={MAX_BRANCH_CHARS}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[130px] resize-none bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
              <p className={cn("text-right text-[11px] tabular-nums", content.length >= MAX_BRANCH_CHARS ? "text-amber-500" : "text-muted-foreground")}>
                {content.length.toLocaleString()}/{MAX_BRANCH_CHARS.toLocaleString()}
              </p>
            </TabsContent>

            {/* Shared media upload UI for image/video/audio/file tabs */}
            {mediaTab && (
              <TabsContent value={activeTab} className="mt-3 space-y-3">
                {selectedFile ? (
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    {activeTab === "image" && filePreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={filePreviewUrl} alt="Selected file" className="max-h-52 w-full object-contain bg-black" />
                    ) : activeTab === "video" && filePreviewUrl ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={filePreviewUrl} className="max-h-52 w-full object-contain bg-black" controls muted playsInline />
                    ) : null}
                    <div className="flex items-center justify-between gap-2 bg-muted/50 px-3 py-2">
                      <p className="min-w-0 truncate text-xs text-muted-foreground">
                        {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-500 hover:bg-red-500/10" onClick={() => setSelectedFile(null)}>
                        <X className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor={`branch-${activeTab}-upload`}
                    className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border px-6 py-8 text-center transition hover:border-emerald-500/60 hover:bg-emerald-500/5"
                  >
                    <Upload className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Click to upload</p>
                    <p className="text-xs text-muted-foreground/70">
                      {activeTab === "image" && "PNG, JPG, GIF up to 10MB"}
                      {activeTab === "video" && "MP4, MOV, WebM up to 50MB"}
                      {activeTab === "audio" && "MP3, WAV, OGG up to 25MB"}
                      {activeTab === "file" && "ZIP, PDF, DOCX, code files up to 50MB"}
                    </p>
                  </label>
                )}
                <input
                  type="file"
                  id={`branch-${activeTab}-upload`}
                  className="hidden"
                  accept={
                    activeTab === "image"
                      ? "image/*"
                      : activeTab === "video"
                        ? "video/*"
                        : activeTab === "audio"
                          ? "audio/*"
                          : ".zip,.pdf,.docx,.txt,.md,.json,.js,.ts,.py,.java,.cpp,.c,.html,.css"
                  }
                  onChange={handleFileSelect}
                />
                <div className="space-y-1.5">
                  <Label className="text-foreground">{activeTab === "file" ? "Description" : "Caption (optional)"}</Label>
                  <Textarea
                    placeholder="Add context to your branch…"
                    value={content}
                    maxLength={MAX_BRANCH_CHARS}
                    onChange={(e) => setContent(e.target.value)}
                    rows={3}
                    className="resize-none bg-background border-border text-foreground placeholder:text-muted-foreground"
                  />
                  <p className={cn("text-right text-[11px] tabular-nums", content.length >= MAX_BRANCH_CHARS ? "text-amber-500" : "text-muted-foreground")}>
                    {content.length.toLocaleString()}/{MAX_BRANCH_CHARS.toLocaleString()}
                  </p>
                </div>
              </TabsContent>
            )}
          </Tabs>
          </div>

          {/* Branch Info */}
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {atMaxDepth
                  ? `Branch depth limit reached (${branchLimits.maxDepth} levels)`
                  : perUserReached
                    ? `You've used all ${branchLimits.maxPerUser} of your branches on this post`
                    : branchLimits.maxDepth == null
                      ? `This branch will be level ${treeDepth} — no depth limit`
                      : `This branch will be level ${treeDepth} of ${branchLimits.maxDepth}`}
              </span>
            </div>
            <ul className="space-y-1 text-[11px] leading-relaxed text-muted-foreground">
              <li>• Connected to the original loop — your take grows the tree</li>
              <li>
                • Anyone can branch from your branch
                {branchLimits.maxDepth == null
                  ? " — this tree has no depth limit"
                  : ` up to ${branchLimits.maxDepth} levels deep`}
              </li>
              {branchLimits.maxPerUser != null && (
                <li>• You&apos;ve used {branchLimits.used} of {branchLimits.maxPerUser} branches on this post</li>
              )}
              <li>• You get credit when others interact with your branch</li>
            </ul>
          </div>

          {/* Action Buttons — sticky footer */}
          <div className="sticky bottom-0 flex gap-2.5 border-t border-border/70 bg-card/95 px-5 py-3.5 backdrop-blur sm:px-6">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1 border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || (!content.trim() && !selectedFile) || branchBlocked}
              className="flex-1 gap-1.5 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600"
            >
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4" /> Posting…
                </>
              ) : (
                <>
                  <GitBranch className="h-4 w-4" /> {branchBlocked ? "Limit reached" : "Create branch"}
                </>
              )}
            </Button>
          </div>
          </>
          )}

        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

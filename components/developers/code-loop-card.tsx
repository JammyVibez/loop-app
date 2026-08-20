"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Star,
  GitBranch,
  Eye,
  Download,
  Copy,
  Code,
  Loader2,
  Check,
  Paperclip,
  FileText,
  Share2,
  Pencil,
  Trash2,
  MoreHorizontal,
  Archive,
  Lock,
  Globe,
  TerminalSquare,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CreateProjectDialog, type EditableProject } from "@/components/developers/create-project-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLoginGate } from "@/hooks/use-login-gate";
import { SyntaxHighlightedCode } from "@/components/loops/syntax-highlighted-code";
import { absoluteAppUrl, shareContent } from "@/lib/share";

export type ProjectFile = {
  name: string
  url: string
  size?: number
  format?: string
}

export type ProjectRepoFile = {
  path: string
  name: string
  url: string
  size?: number
  language?: string
}

interface CodeLoopCardProps {
  project: {
    id: string
    author_id?: string
    title: string
    description: string
    author: any
    language: string
    framework: string
    tags: string[]
    stats: {
      stars: number
      forks: number
      views: number
      branches: number
    }
    code_snippet: string
    files?: ProjectFile[]
    file_tree?: ProjectRepoFile[]
    repo_zip_url?: string | null
    forked_from_id?: string | null
    is_public?: boolean
    created_at: Date
  }
  onUpdated?: (project: any) => void
  onDeleted?: (projectId: string) => void
}

function formatFileSize(bytes?: number) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CodeLoopCard({ project, onUpdated, onDeleted }: CodeLoopCardProps) {
  const { user, getAuthHeader } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const [isStarred, setIsStarred] = useState(false)
  const [starCount, setStarCount] = useState(project.stats.stars)
  const [forkCount, setForkCount] = useState(project.stats.forks)
  const [isForked, setIsForked] = useState(false)
  const [starring, setStarring] = useState(false)
  const [forking, setForking] = useState(false)
  const [showFullCode, setShowFullCode] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishSubdomain, setPublishSubdomain] = useState("")
  const [showPublish, setShowPublish] = useState(false)
  const [isPublished, setIsPublished] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState("")
  const [showShareDialog, setShowShareDialog] = useState(false)
  const { toast } = useToast()

  const authorId = project.author_id || project.author?.id
  const isOwner = Boolean(user?.id && authorId && user.id === authorId)
  const projectUrl = absoluteAppUrl(`/developers/${project.id}`)

  useEffect(() => {
    fetch(`/api/developers/projects/${project.id}/interactions`, { headers: { ...getAuthHeader() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return
        setIsStarred(Boolean(data.is_starred))
        setIsForked(Boolean(data.is_forked))
        if (typeof data.stars === "number") setStarCount(data.stars)
        if (typeof data.forks === "number") setForkCount(data.forks)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const handleStar = async () => {
    if (!requireAuth("like")) return
    setStarring(true)
    const nextStarred = !isStarred
    setIsStarred(nextStarred)
    setStarCount((prev) => Math.max(0, prev + (nextStarred ? 1 : -1)))
    try {
      const res = await fetch(`/api/developers/projects/${project.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ type: nextStarred ? "star" : "unstar" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to star project")
      if (typeof data.stars === "number") setStarCount(data.stars)
    } catch (error: any) {
      setIsStarred(!nextStarred)
      setStarCount((prev) => Math.max(0, prev + (nextStarred ? -1 : 1)))
      toast({ title: "Couldn't update star", description: error.message, variant: "destructive" })
    } finally {
      setStarring(false)
    }
  }

  const handleFork = async () => {
    if (!requireAuth("branch")) return
    if (isForked) {
      toast({ description: "You already forked this project — check your gallery." })
      return
    }
    setForking(true)
    try {
      const res = await fetch(`/api/developers/projects/${project.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ type: "fork" }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to fork project")
      setIsForked(true)
      if (typeof data.forks === "number") setForkCount(data.forks)
      else setForkCount((prev) => prev + 1)
      toast({ title: "Forked!", description: "A copy of this project was added to your gallery." })
    } catch (error: any) {
      toast({ title: "Fork failed", description: error.message, variant: "destructive" })
    } finally {
      setForking(false)
    }
  }

  const handleShare = async () => {
    setShowShareDialog(true)
  }

  const copyEmbedCode = () => {
    const embedUrl = absoluteAppUrl(`/preview/${project.id}`)
    const embedCode = `<iframe src="${embedUrl}" width="100%" height="500" frameborder="0" title="${project.title}"></iframe>`
    navigator.clipboard.writeText(embedCode)
    toast({ title: "Embed code copied", description: "Paste this into any webpage to embed your project." })
  }

  const copyLink = async () => {
    const result = await shareContent({
      url: projectUrl,
      title: project.title,
      text: project.description?.slice(0, 140) || `Check out ${project.title} on Loop Developers`,
    })
    if (result === "copied") {
      toast({ title: "Link copied", description: "Project link is on your clipboard." })
    } else if (result === "failed") {
      toast({ title: "Couldn't share", variant: "destructive" })
    }
  }

  const shareToSocial = (platform: string) => {
    const text = encodeURIComponent(`Check out ${project.title} on Loop Developers!`)
    const url = encodeURIComponent(projectUrl)
    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      reddit: `https://reddit.com/submit?url=${url}&title=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    }
    window.open(urls[platform], "_blank", "width=600,height=400")
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/developers/projects/${project.id}`, {
        method: "DELETE",
        headers: { ...getAuthHeader() },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Failed to delete project")
      toast({ title: "Project deleted" })
      onDeleted?.(project.id)
      setShowDelete(false)
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(project.code_snippet)
    toast({
      description: "Code copied to clipboard!",
    })
  }

  const handleDownload = () => {
    const ext: Record<string, string> = {
      javascript: "js", typescript: "ts", python: "py", go: "go", rust: "rs",
      java: "java", "c++": "cpp", php: "php", ruby: "rb",
    }
    const extension = ext[project.language?.toLowerCase()] || "txt"
    const fileName = `${project.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "snippet"}.${extension}`
    const blob = new Blob([project.code_snippet], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast({ description: `Downloaded ${fileName}` })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  const getLanguageColor = (language: string) => {
    const colors: { [key: string]: string } = {
      JavaScript: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
      TypeScript: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      Python: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
      Go: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
      Rust: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
      Java: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    }
    return colors[language] || "bg-muted text-foreground"
  }

  const getVerificationBadge = () => {
    if (!project.author.is_verified) return null
    return (
      <Badge
        variant="secondary"
        className={`ml-2 ${
          project.author.verification_level === "root"
            ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30"
            : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30"
        }`}
      >
        {project.author.verification_level === "root" ? "Root" : "Verified"}
      </Badge>
    )
  }

  const handlePublish = async () => {
    if (!requireAuth("post")) return
    if (!publishSubdomain.trim()) {
      toast({ title: "Enter a subdomain", description: "Choose a unique subdomain for your app.", variant: "destructive" })
      return
    }
    setPublishing(true)
    try {
      const res = await fetch(`/api/developers/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ subdomain: publishSubdomain.trim(), publish: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to publish")
      setIsPublished(true)
      setPublishedUrl(data.url)
      toast({ title: "Published!", description: `Your app is live at ${data.url}` })
      setShowPublish(false)
    } catch (error: any) {
      toast({ title: "Publish failed", description: error.message, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    setPublishing(true)
    try {
      const res = await fetch(`/api/developers/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ publish: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to unpublish")
      setIsPublished(false)
      setPublishedUrl("")
      toast({ title: "Unpublished" })
      setShowPublish(false)
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" })
    } finally {
      setPublishing(false)
    }
  }

  const editableProject: EditableProject = {
    id: project.id,
    title: project.title,
    description: project.description,
    language: project.language,
    framework: project.framework,
    tags: project.tags,
    code_snippet: project.code_snippet,
    files: project.files,
    file_tree: project.file_tree,
    repo_zip_url: project.repo_zip_url,
    is_public: project.is_public,
  }

  return (
    <>
      {LoginGateDialog}
      <Card className="hover:shadow-lg transition-shadow border-border bg-card text-card-foreground">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center space-x-3 min-w-0">
            <Avatar className="w-10 h-10 shrink-0">
              <AvatarImage src={project.author.avatar_url || "/placeholder.svg"} />
              <AvatarFallback>{project.author.display_name?.charAt(0) || "?"}</AvatarFallback>
            </Avatar>
            <div className="flex items-center min-w-0">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{project.author.display_name}</p>
                <p className="text-muted-foreground text-xs truncate">@{project.author.username}</p>
              </div>
              {getVerificationBadge()}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getLanguageColor(project.language)}>{project.language}</Badge>
            {project.framework !== "None" && <Badge variant="outline">{project.framework}</Badge>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Project actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShare}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/developers/${project.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Open
                  </Link>
                </DropdownMenuItem>
                {isOwner && (
                  <>
                    <DropdownMenuSeparator />
                    {user?.is_premium && (
                      <DropdownMenuItem asChild>
                        <Link href={`/preview/${project.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Preview
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {user?.is_premium && (
                      <DropdownMenuItem onClick={() => setShowPublish(true)}>
                        <Globe className="mr-2 h-4 w-4" />
                        {isPublished ? "Manage publish" : "Publish"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowEdit(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setShowDelete(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="min-w-0 space-y-4 overflow-hidden">
        <div>
          <Link href={`/developers/${project.id}`} className="hover:underline">
            <h3 className="font-bold text-lg mb-2">{project.title}</h3>
          </Link>
          <p className="text-muted-foreground text-sm">{project.description}</p>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="max-w-[10rem] truncate text-xs">
              #{tag}
            </Badge>
          ))}
          {(project.file_tree?.length || 0) > 0 && (
            <Badge variant="outline" className="gap-1 rounded-full border-cyan-500/40 text-[10px] text-cyan-600 dark:text-cyan-300">
              <Archive className="h-3 w-3" />
              Repo · {project.file_tree!.length} files
            </Badge>
          )}
          {project.forked_from_id && (
            <Badge variant="outline" className="gap-1 rounded-full border-indigo-500/40 text-[10px] text-indigo-600 dark:text-indigo-300">
              <TerminalSquare className="h-3 w-3" />
              Fork · sandbox soon
            </Badge>
          )}
          {project.is_public === false ? (
            <Badge variant="outline" className="gap-1 rounded-full border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400">
              <Lock className="h-3 w-3" /> Private
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 rounded-full border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Globe className="h-3 w-3" /> Public
            </Badge>
          )}
        </div>

        {project.code_snippet.trim().length > 0 && (
          <div className="bg-muted/50 border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-muted px-4 py-2">
              <div className="flex items-center space-x-2">
                <Code className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground text-sm">Code Preview</span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleCopyCode} className="text-muted-foreground hover:text-foreground">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <SyntaxHighlightedCode
                code={project.code_snippet}
                language={project.language}
                maxLines={showFullCode ? undefined : 8}
                showLineNumbers={false}
              />
            </div>
            {project.code_snippet.split("\n").length > 8 && (
              <div className="px-4 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullCode(!showFullCode)}
                  className="text-primary hover:text-primary/80"
                >
                  {showFullCode ? "Show Less" : "Show More"}
                </Button>
              </div>
            )}
          </div>
        )}

        {project.files && project.files.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {project.files.length} attached file{project.files.length === 1 ? "" : "s"}
            </div>
            <div className="flex flex-wrap gap-2">
              {project.files.map((file, i) => (
                <a
                  key={i}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={file.name}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium hover:bg-muted/70 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  {file.size ? <span className="text-muted-foreground">{formatFileSize(file.size)}</span> : null}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-3 border-t border-border pt-2">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStar}
              disabled={starring}
              className={`flex items-center space-x-2 px-2 ${isStarred ? "text-yellow-500" : "text-muted-foreground"}`}
            >
              {starring ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${isStarred ? "fill-current" : ""}`} />}
              <span>{formatNumber(starCount)}</span>
            </Button>

            <div className="flex items-center space-x-2 text-muted-foreground">
              <GitBranch className="w-4 h-4" />
              <span>{formatNumber(forkCount)}</span>
            </div>

            <div className="flex items-center space-x-2 text-muted-foreground">
              <Eye className="w-4 h-4" />
              <span>{formatNumber(project.stats.views)}</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {isOwner && user?.is_premium && (
              <Button variant="outline" size="sm" asChild className="min-w-0 border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20">
                <Link href={`/preview/${project.id}`}>
                  <Eye className="mr-2 h-4 w-4 shrink-0" />
                  Preview
                </Link>
              </Button>
            )}
            {isPublished && publishedUrl && (
              <Button variant="outline" size="sm" asChild className="min-w-0 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
                <a href={publishedUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="mr-2 h-4 w-4 shrink-0" />
                  Live
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleShare} className="min-w-0">
              <Share2 className="mr-2 h-4 w-4 shrink-0" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleFork} disabled={forking || isForked || isOwner} className="min-w-0">
              {forking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isForked ? (
                <Check className="mr-2 h-4 w-4 text-emerald-500" />
              ) : (
                <GitBranch className="mr-2 h-4 w-4" />
              )}
              {isForked ? "Forked" : "Fork"}
            </Button>
            {project.code_snippet.trim().length > 0 && (
              <Button size="sm" onClick={handleDownload} className="min-w-0">
                <Download className="mr-2 h-4 w-4 shrink-0" />
                Download
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

    <CreateProjectDialog
      open={showEdit}
      onOpenChange={setShowEdit}
      project={editableProject}
      onProjectUpdated={onUpdated}
    />

    {/* Publish Dialog */}
    {showPublish && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{isPublished ? "Manage Published App" : "Publish as Live App"}</h3>
            <button onClick={() => setShowPublish(false)} className="text-muted-foreground hover:text-foreground">✕</button>
          </div>
          {isPublished ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Your app is live at:</p>
              <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-mono text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                {publishedUrl}
              </a>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={publishing} className="flex-1">
                  {publishing ? "Processing…" : "Unpublish"}
                </Button>
                <Button size="sm" asChild className="flex-1">
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer">Visit App</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose a subdomain for your live app:</p>
              <div className="flex items-center gap-0 rounded-lg border border-border overflow-hidden">
                <input
                  type="text"
                  value={publishSubdomain}
                  onChange={(e) => setPublishSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="my-app"
                  className="flex-1 px-3 py-2 bg-background text-foreground text-sm border-0 outline-none"
                  maxLength={63}
                />
                <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-l border-border">.loopapp.me</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Letters, numbers, and hyphens only. Min 3, max 63 characters.</p>
              <Button onClick={handlePublish} disabled={publishing || publishSubdomain.length < 3} className="w-full">
                {publishing ? "Publishing…" : "Publish App"}
              </Button>
            </div>
          )}
        </div>
      </div>
    )}

    <ConfirmDialog
      open={showDelete}
      onOpenChange={setShowDelete}
      title="Delete this project?"
      description="This permanently removes your project from the Developer Hub. This can't be undone."
      confirmLabel={deleting ? "Deleting…" : "Delete"}
      destructive
      onConfirm={handleDelete}
    />

    {/* Share Dialog */}
    {showShareDialog && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShareDialog(false)}>
        <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">Share Project</h3>
            <button onClick={() => setShowShareDialog(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
          </div>
          <p className="text-sm text-muted-foreground">Share {project.title} with others:</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => shareToSocial("twitter")} className="justify-start">Twitter / X</Button>
            <Button variant="outline" size="sm" onClick={() => shareToSocial("reddit")} className="justify-start">Reddit</Button>
            <Button variant="outline" size="sm" onClick={() => shareToSocial("linkedin")} className="justify-start">LinkedIn</Button>
            <Button variant="outline" size="sm" onClick={() => shareToSocial("facebook")} className="justify-start">Facebook</Button>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="w-full justify-start">
            <Share2 className="mr-2 h-4 w-4" /> Copy link
          </Button>
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Embed code:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-muted rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">
                {'<iframe src="' + absoluteAppUrl(`/preview/${project.id}`) + '" width="100%" height="500" />'}
              </code>
              <Button variant="ghost" size="sm" onClick={copyEmbedCode} className="shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}

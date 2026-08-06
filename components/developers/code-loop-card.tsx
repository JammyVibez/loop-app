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

  const editableProject: EditableProject = {
    id: project.id,
    title: project.title,
    description: project.description,
    language: project.language,
    framework: project.framework,
    tags: project.tags,
    code_snippet: project.code_snippet,
    files: project.files,
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

        <div className="flex min-w-0 flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="max-w-[10rem] truncate text-xs">
              #{tag}
            </Badge>
          ))}
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

    <ConfirmDialog
      open={showDelete}
      onOpenChange={setShowDelete}
      title="Delete this project?"
      description="This permanently removes your project from the Developer Hub. This can't be undone."
      confirmLabel={deleting ? "Deleting…" : "Delete"}
      destructive
      onConfirm={handleDelete}
    />
    </>
  )
}

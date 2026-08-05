"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, GitBranch, Eye, Download, Copy, Code, Loader2, Check, Paperclip, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLoginGate } from "@/hooks/use-login-gate";
import { SyntaxHighlightedCode } from "@/components/loops/syntax-highlighted-code";

export type ProjectFile = {
  name: string
  url: string
  size?: number
  format?: string
}

interface CodeLoopCardProps {
  project: {
    id: string
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
}

function formatFileSize(bytes?: number) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CodeLoopCard({ project }: CodeLoopCardProps) {
  const { getAuthHeader } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const [isStarred, setIsStarred] = useState(false)
  const [starCount, setStarCount] = useState(project.stats.stars)
  const [forkCount, setForkCount] = useState(project.stats.forks)
  const [isForked, setIsForked] = useState(false)
  const [starring, setStarring] = useState(false)
  const [forking, setForking] = useState(false)
  const [showFullCode, setShowFullCode] = useState(false)
  const { toast } = useToast()

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
      // Roll back optimistic update on failure
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
      toast({ title: "Forked! 🍴", description: "A copy of this project was added to your gallery." })
    } catch (error: any) {
      toast({ title: "Fork failed", description: error.message, variant: "destructive" })
    } finally {
      setForking(false)
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
      JavaScript: "bg-yellow-100 text-yellow-700",
      TypeScript: "bg-blue-100 text-blue-700",
      Python: "bg-green-100 text-green-700",
      Go: "bg-cyan-100 text-cyan-700",
      Rust: "bg-orange-100 text-orange-700",
      Java: "bg-red-100 text-red-700",
    }
    return colors[language] || "bg-gray-100 text-gray-700"
  }

  const getVerificationBadge = () => {
    if (!project.author.is_verified) return null
    return (
      <Badge
        variant="secondary"
        className={`ml-2 ${
          project.author.verification_level === "root" ?"bg-green-100 text-green-700 border-green-200" :"bg-blue-100 text-blue-700 border-blue-200"
        }`}
      >
        {project.author.verification_level === "root" ? "🌱" : "⭐"}
      </Badge>
    )
  }

  return (
    <>
      {LoginGateDialog}
      <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={project.author.avatar_url || "/placeholder.svg"} />
              <AvatarFallback>{project.author.display_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex items-center">
              <div>
                <p className="font-semibold text-sm">{project.author.display_name}</p>
                <p className="text-muted-foreground text-xs">@{project.author.username}</p>
              </div>
              {getVerificationBadge()}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className={getLanguageColor(project.language)}>{project.language}</Badge>
            {project.framework !== "None" && <Badge variant="outline">{project.framework}</Badge>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <h3 className="font-bold text-lg mb-2">{project.title}</h3>
          <p className="text-muted-foreground text-sm">{project.description}</p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              #{tag}
            </Badge>
          ))}
        </div>

        {/* Code Preview — real syntax highlighting, not flat monospace */}
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
                className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
              >
                {showFullCode ? "Show Less" : "Show More"}
              </Button>
            </div>
          )}
        </div>

        {/* Attached Files */}
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
                  <FileText className="h-3.5 w-3.5 text-cyan-500" />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  {file.size ? <span className="text-muted-foreground">{formatFileSize(file.size)}</span> : null}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center space-x-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStar}
              disabled={starring}
              className={`flex items-center space-x-2 ${isStarred ? "text-yellow-500" : "text-muted-foreground"}`}
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

          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleFork} disabled={forking || isForked}>
              {forking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : isForked ? (
                <Check className="w-4 h-4 mr-2 text-emerald-500" />
              ) : (
                <GitBranch className="w-4 h-4 mr-2" />
              )}
              {isForked ? "Forked" : "Fork"}
            </Button>
            <Button size="sm" onClick={handleDownload} className="bg-gradient-to-r from-purple-500 to-blue-500">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  )
}

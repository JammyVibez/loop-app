"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { formatRepoBytes } from "@/lib/dev-project-zip"
import { SyntaxHighlightedCode } from "@/components/loops/syntax-highlighted-code"
import { Spinner } from "@/components/ui/skeletons"
import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Eye,
  FileCode2,
  Folder,
  FolderOpen,
  GitFork,
  Globe,
  
  Lock,
  Play,
  Zap,
  TerminalSquare,
} from "@/components/icons/lucide-compat"

interface RepoFile {
  path: string
  name: string
  url: string
  size: number
  language: string
}

interface TreeNode {
  name: string
  path: string
  type: "file" | "dir"
  file?: RepoFile
  children?: TreeNode[]
}

function buildTree(files: RepoFile[]): TreeNode[] {
  const root: TreeNode[] = []
  const byPath = new Map<string, TreeNode>()
  for (const file of files) {
    const parts = file.path.split("/")
    let current = root
    let acc = ""
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      acc = acc ? `${acc}/${part}` : part
      if (i === parts.length - 1) {
        const node: TreeNode = { name: part, path: acc, type: "file", file }
        current.push(node)
      } else {
        let dir = byPath.get(acc)
        if (!dir) {
          dir = { name: part, path: acc, type: "dir", children: [] }
          byPath.set(acc, dir)
          current.push(dir)
        }
        current = dir.children || []
      }
    }
  }
  const sortNode = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) if (n.children) sortNode(n.children)
  }
  sortNode(root)
  return root
}

const PREVIEWABLE = new Set(["html", "htm", "svg"])

export function ProjectRepoBrowser({
  project,
  isOwner,
  onUpdated,
}: {
  project: any
  isOwner: boolean
  onUpdated?: (project: any) => void
}) {
  const { user, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const files: RepoFile[] = useMemo(
    () => (Array.isArray(project.file_tree) ? project.file_tree : []),
    [project.file_tree],
  )
  const tree = useMemo(() => buildTree(files), [files])
  const isFork = Boolean(project.forked_from_id)

  const [selectedPath, setSelectedPath] = useState<string | null>(files[0]?.path || null)
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => {
    const set = new Set<string>()
    for (const f of files) {
      const parts = f.path.split("/")
      if (parts.length > 1) set.add(parts.slice(0, -1).join("/"))
    }
    return set
  })
  const [content, setContent] = useState<string | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isPublic, setIsPublic] = useState(project.is_public !== false)
  const [togglingVis, setTogglingVis] = useState(false)

  const selectedFile = useMemo(
    () => files.find((f) => f.path === selectedPath) || null,
    [files, selectedPath],
  )

  const loadFile = useCallback(async (path: string) => {
    const file = files.find((f) => f.path === path)
    if (!file) return
    setSelectedPath(path)
    setShowPreview(false)
    setFileLoading(true)
    setFileError(null)
    try {
      const res = await fetch(file.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      setContent(text)
    } catch {
      setContent(null)
      setFileError("Couldn't read this file inline — use Open file to download it.")
    } finally {
      setFileLoading(false)
    }
  }, [files])

  useEffect(() => {
    if (selectedPath && !content && !fileError) void loadFile(selectedPath)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPath])

  const toggleDir = (path: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderNode = (node: TreeNode, depth: number) => {
    if (node.type === "dir") {
      const open = openDirs.has(node.path)
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggleDir(node.path)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] font-medium text-foreground transition hover:bg-muted"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {open ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-amber-500" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-amber-500" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
          {open && (node.children || []).map((child) => renderNode(child, depth + 1))}
        </div>
      )
    }
    const active = node.path === selectedPath
    return (
      <button
        key={node.path}
        type="button"
        onClick={() => void loadFile(node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] transition",
          active ? "bg-cyan-500/15 font-medium text-cyan-700 dark:text-cyan-300" : "text-foreground/85 hover:bg-muted",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  const copyFile = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast({ title: "Couldn't copy", variant: "destructive" })
    }
  }

  const downloadFile = () => {
    if (!content || !selectedFile) return
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = selectedFile.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const toggleVisibility = async () => {
    if (!isOwner) return
    setTogglingVis(true)
    const next = !isPublic
    try {
      const res = await fetch(`/api/developers/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ is_public: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to update visibility")
      setIsPublic(next)
      onUpdated?.({ ...project, is_public: next })
      toast({
        title: next ? "Project is now public" : "Project is now private",
        description: next
          ? "Anyone can discover and read it."
          : "Only you and your collaborators can see it.",
      })
    } catch (err: any) {
      toast({ title: "Visibility update failed", description: err.message, variant: "destructive" })
    } finally {
      setTogglingVis(false)
    }
  }

  if (files.length === 0) return null

  const previewable = Boolean(selectedFile && PREVIEWABLE.has((selectedFile.name.split(".").pop() || "").toLowerCase()))

  return (
    <div className="space-y-4">
      {/* Repo header */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 text-white shadow-md">
            <Archive className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold">{project.title}</h3>
              {isPublic ? (
                <Badge variant="outline" className="gap-1 rounded-full border-emerald-500/40 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <Globe className="h-3 w-3" /> Public
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 rounded-full border-amber-500/40 text-[10px] text-amber-600 dark:text-amber-400">
                  <Lock className="h-3 w-3" /> Private
                </Badge>
              )}
              {isFork && (
                <Badge className="gap-1 rounded-full bg-indigo-500/15 text-[10px] text-indigo-600 dark:text-indigo-300">
                  <GitFork className="h-3 w-3" /> Fork
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {files.length} file{files.length === 1 ? "" : "s"} · {formatRepoBytes(files.reduce((a, f) => a + (Number(f.size) || 0), 0))} of source · {project.language}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => void toggleVisibility()}
              disabled={togglingVis}
            >
              {togglingVis ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : isPublic ? (
                <Lock className="h-3.5 w-3.5" />
              ) : (
                <Globe className="h-3.5 w-3.5" />
              )}
              {isPublic ? "Make private" : "Make public"}
            </Button>
          )}
          {project.repo_zip_url && (
            <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
              <a href={project.repo_zip_url} target="_blank" rel="noreferrer" download>
                <Download className="h-3.5 w-3.5" /> Download ZIP
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Fork sandbox banner */}
      {isFork && (
        <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-card to-cyan-500/10 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-500">
            <TerminalSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Code Sandbox — coming soon</p>
            <p className="text-xs text-muted-foreground">
              Run forked projects in a live sandbox right inside Loop. We're wiring that up next —
              {project.forked_from_id ? (
                <>
                  {" "}this fork comes from{" "}
                  <Link href={`/developers/${project.forked_from_id}`} className="font-semibold text-indigo-500 hover:underline">
                    the original project
                  </Link>
                  .
                </>
              ) : (
                " the original repo."
              )}
            </p>
          </div>
          <Zap className="hidden h-4 w-4 shrink-0 text-indigo-400 sm:block" />
        </div>
      )}

      {/* File browser */}
      <div className="grid overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[240px_1fr]">
        {/* Sidebar tree */}
        <aside className="max-h-[560px] overflow-y-auto border-b border-border bg-muted/30 p-2 md:border-b-0 md:border-r">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Files
          </p>
          {tree.map((node) => renderNode(node, 0))}
        </aside>

        {/* Viewer */}
        <div className="flex min-h-[300px] min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileCode2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-[13px]">{selectedFile?.path || "Select a file"}</span>
              {selectedFile && (
                <Badge variant="outline" className="hidden rounded-full px-2 text-[10px] sm:inline-flex">
                  {selectedFile.language}
                </Badge>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center gap-1">
                {previewable && (
                  <Button
                    variant={showPreview ? "default" : "ghost"}
                    size="sm"
                    className="h-7 gap-1.5 rounded-full px-2.5 text-xs"
                    onClick={() => setShowPreview((v) => !v)}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-xs" onClick={() => void copyFile()} disabled={!content}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-full px-2.5 text-xs" onClick={downloadFile} disabled={!content}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            )}
          </div>

          <div className="min-h-[280px] flex-1 overflow-auto p-0">
            {fileLoading ? (
              <div className="flex h-full min-h-[280px] items-center justify-center text-muted-foreground">
                <Spinner className="mr-2 h-4 w-4" /> Reading file…
              </div>
            ) : fileError ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-sm text-muted-foreground">{fileError}</p>
                {selectedFile && (
                  <Button asChild variant="outline" size="sm" className="rounded-full">
                    <a href={selectedFile.url} target="_blank" rel="noreferrer">
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Open file
                    </a>
                  </Button>
                )}
              </div>
            ) : showPreview && selectedFile ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 p-8 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/15 to-indigo-500/15 text-cyan-500">
                  <Play className="h-6 w-6" />
                </span>
                <p className="font-semibold">Live preview — coming soon</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Rendered HTML/React previews for uploaded projects are on the way. For now you can
                  read every file and download the full source.
                </p>
                <Badge variant="outline" className="rounded-full text-[10px]">
                  <Zap className="mr-1 h-3 w-3 text-cyan-500" /> Preview coming soon
                </Badge>
              </div>
            ) : content !== null ? (
              <SyntaxHighlightedCode code={content} language={selectedFile?.language || "Text"} showLineNumbers className="p-3 text-[13px]" />
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                Select a file to read it
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

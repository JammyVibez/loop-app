"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Archive,
  CheckCircle2,
  Code,
  Eye,
  FileText,
  FolderTree,
  Loader2,
  Lock,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLoginGate } from "@/hooks/use-login-gate";
import { uploadMediaFile } from "@/lib/client-media-upload";
import {
  formatRepoBytes,
  parseProjectZip,
  uploadRepoFiles,
  zipSizeLimit,
  type UploadedRepoFile,
} from "@/lib/dev-project-zip";
import { SyntaxHighlightedCode } from "@/components/loops/syntax-highlighted-code";

export type EditableProject = {
  id: string
  title: string
  description: string
  language: string
  framework?: string
  tags?: string[]
  code_snippet?: string
  files?: AttachedFile[]
  file_tree?: UploadedRepoFile[]
  repo_zip_url?: string | null
  is_public?: boolean
}

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated?: (project: any) => void
  onProjectUpdated?: (project: any) => void
  /** When set, dialog operates in edit mode for this project. */
  project?: EditableProject | null
}

type AttachedFile = { name: string; url: string; size?: number; format?: string }

const languages = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "C++", "PHP", "Ruby"]
const frameworks = ["React", "Vue", "Angular", "Node.js", "Django", "Flask", "Express", "Spring", "Rails"]
const MAX_FILES = 5

const emptyForm = {
  title: "",
  description: "",
  language: "",
  framework: "",
  code: "",
  tags: [] as string[],
  newTag: "",
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
  onProjectUpdated,
  project = null,
}: CreateProjectDialogProps) {
  const isEdit = Boolean(project?.id)
  const [formData, setFormData] = useState(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [files, setFiles] = useState<AttachedFile[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const zipInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()

  // ---- ZIP repo state ----
  const [zipName, setZipName] = useState("")
  const [zipParsing, setZipParsing] = useState(false)
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [zipExtract, setZipExtract] = useState<{ phase: string; percent: number; label: string } | null>(null)
  const [repoFiles, setRepoFiles] = useState<UploadedRepoFile[]>([])
  const [repoZipUrl, setRepoZipUrl] = useState<string | null>(null)
  const [repoZipError, setRepoZipError] = useState<string | null>(null)
  const [repoRemoved, setRepoRemoved] = useState<string[]>([])
  const [repoTotalBytes, setRepoTotalBytes] = useState(0)
  const [repoTruncated, setRepoTruncated] = useState(false)

  const isPro = Boolean(user?.is_premium)
  const maxZipBytes = zipSizeLimit(isPro)

  useEffect(() => {
    if (!open) return
    if (project) {
      setFormData({
        title: project.title || "",
        description: project.description || "",
        language: project.language || "",
        framework: project.framework && project.framework !== "None" ? project.framework : "",
        code: project.code_snippet || "",
        tags: project.tags || [],
        newTag: "",
      })
      setFiles(Array.isArray(project.files) ? project.files : [])
      setRepoFiles(Array.isArray(project.file_tree) ? project.file_tree : [])
      setRepoZipUrl(project.repo_zip_url || null)
      setRepoZipError(null)
      setZipName(project.repo_zip_url ? "Existing ZIP archive (kept on edit)" : "")
      setRepoRemoved([])
      setRepoTotalBytes((Array.isArray(project.file_tree) ? project.file_tree : []).reduce((acc, f: any) => acc + (Number(f.size) || 0), 0))
      setShowPreview(false)
    } else {
      setFormData(emptyForm)
      setFiles([])
      setRepoFiles([])
      setRepoZipUrl(null)
      setRepoZipError(null)
      setZipName("")
      setRepoRemoved([])
      setRepoTotalBytes(0)
      setRepoTruncated(false)
      setShowPreview(false)
    }
  }, [open, project])

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked) return
    if (files.length >= MAX_FILES) {
      toast({ title: `Up to ${MAX_FILES} files`, description: "Remove a file before adding another.", variant: "destructive" })
      return
    }
    setUploadingFile(true)
    try {
      const result = await uploadMediaFile(picked, { type: "file", folder: "developer-projects", authHeaders: getAuthHeader() })
      setFiles((prev) => [...prev, { name: picked.name, url: result.url, size: picked.size, format: result.format }])
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message || "Could not upload file.", variant: "destructive" })
    } finally {
      setUploadingFile(false)
    }
  }

  const handleRemoveFile = (url: string) => {
    setFiles((prev) => prev.filter((f) => f.url !== url))
  }

  const handleZipPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0]
    e.target.value = ""
    if (!picked) return
    await processZipFile(picked)
  }

  const processZipFile = async (picked: File) => {
    if (!picked.name.toLowerCase().endsWith(".zip")) {
      toast({ title: "Not a ZIP file", description: "Upload a .zip archive of your project.", variant: "destructive" })
      return
    }
    if (picked.size > maxZipBytes) {
      toast({
        title: "Archive too large",
        description: isPro
          ? "Pro members can upload up to 500MB."
          : "Free accounts can upload up to 100MB. Go Pro for up to 500MB.",
        variant: "destructive",
      })
      return
    }

    setZipParsing(true)
    setZipName(picked.name)
    setRepoFiles([])
    setRepoZipUrl(null)
    setRepoZipError(null)
    setRepoRemoved([])
    setRepoTruncated(false)
    setZipExtract(null)
    try {
      const parsed = await parseProjectZip(picked, (phase, percent, label) => {
        setZipExtract({ phase, percent, label })
      })
      setRepoRemoved(parsed.removedReasons)
      setRepoTotalBytes(parsed.totalBytes)
      setRepoTruncated(parsed.truncated)
      if (parsed.entries.length === 0) {
        toast({
          title: "Nothing shareable in that ZIP",
          description: "We only found build/dependency/binary files. Try a ZIP of your source code.",
          variant: "destructive",
        })
        setZipParsing(false)
        return
      }
      const result = await uploadRepoFiles(parsed.entries, picked, getAuthHeader(), (done, total, label) => {
        setZipProgress({ done, total, label })
      })
      setRepoFiles(result.files)
      setRepoZipUrl(result.zipUrl)
      setRepoZipError(result.zipError)
      if (result.files.length === 0) {
        toast({ title: "Upload failed", description: "None of the extracted files could be uploaded. Try a smaller archive.", variant: "destructive" })
      } else {
        toast({
          title: "Project ready 🎉",
          description: `${result.files.length} file${result.files.length === 1 ? "" : "s"} extracted and stored — arranged like GitHub.`,
        })
        if (result.zipError) {
          toast({ title: "ZIP archive not stored", description: result.zipError, variant: "destructive" })
        }
      }
    } catch (error: any) {
      toast({ title: "Couldn't read ZIP", description: error.message || "This archive could not be parsed.", variant: "destructive" })
    } finally {
      setZipParsing(false)
      setZipProgress(null)
    }
  }

  const clearZip = () => {
    setZipName("")
    setRepoFiles([])
    setRepoZipUrl(null)
    setRepoZipError(null)
    setRepoRemoved([])
    setRepoTotalBytes(0)
    setRepoTruncated(false)
  }

  const handleAddTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, formData.newTag.trim()],
        newTag: "",
      })
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    })
  }

  const handleSubmit = async () => {
    if (!requireAuth("post")) return

    if (!formData.title.trim() || !formData.description.trim() || !formData.language) {
      toast({
        title: "Missing Information",
        description: "Please fill in title, description, and language.",
        variant: "destructive",
      })
      return
    }

    if (!formData.code.trim() && files.length === 0 && repoFiles.length === 0) {
      toast({
        title: "Nothing to share",
        description: "Add a code snippet, attach a file, or upload a project ZIP.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        language: formData.language,
        framework: formData.framework || "None",
        tags: formData.tags,
        codeSnippet: formData.code,
        files,
        fileTree: repoFiles,
        repoZipUrl,
      }

      const response = await fetch(
        isEdit ? `/api/developers/projects/${project!.id}` : "/api/developers/projects",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || (isEdit ? "Failed to update project" : "Failed to share project"))

      toast({
        title: isEdit ? "Project Updated" : "Project Shared!",
        description: isEdit
          ? "Your changes are live."
          : "Your project has been shared with the developer community.",
      })

      if (isEdit) onProjectUpdated?.(data.project)
      else onProjectCreated?.(data.project)
      onOpenChange(false)
      if (!isEdit) {
        setFormData(emptyForm)
        setFiles([])
        clearZip()
      }
      setShowPreview(false)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {LoginGateDialog}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-primary" />
            <span>{isEdit ? "Edit Project" : "Share Your Project"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="project-title">Project Title *</Label>
            <Input
              id="project-title"
              placeholder="Enter project title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="project-description">Description *</Label>
            <Textarea
              id="project-description"
              placeholder="Describe what your project does..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="mt-2 min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="language">Programming Language *</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="framework">Framework (Optional)</Label>
              <Select
                value={formData.framework || "None"}
                onValueChange={(value) => setFormData({ ...formData, framework: value === "None" ? "" : value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {frameworks.map((framework) => (
                    <SelectItem key={framework} value={framework}>
                      {framework}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ---- Project ZIP upload (GitHub-style repo) ---- */}
          <div className="rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/5 p-4">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Archive className="h-4 w-4 text-cyan-500" />
                Upload project (ZIP)
              </Label>
              <Badge variant="outline" className="gap-1 rounded-full border-cyan-500/40 text-[10px]">
                {isPro ? (
                  <>
                    <Lock className="h-3 w-3 text-amber-500" /> Pro — up to 500MB
                  </>
                ) : (
                  <>
                    Up to 100MB <span className="text-muted-foreground">·</span>{" "}
                    <span className="text-amber-600 dark:text-amber-400">Pro: 500MB</span>
                  </>
                )}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Loop extracts your archive, removes build/dependency files, and arranges it like GitHub so
              everyone can read each file.
            </p>

            {!zipParsing && repoFiles.length === 0 && !zipName && (
              <button
                type="button"
                onClick={() => zipInputRef.current?.click()}
                className="mt-3 flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-4 py-7 text-center transition hover:border-cyan-500/50 hover:bg-muted/40"
              >
                <UploadCloud className="h-7 w-7 text-cyan-500" />
                <span className="text-sm font-medium">Choose a .zip file</span>
                <span className="text-[11px] text-muted-foreground">
                  HTML, React, TypeScript, JavaScript, Python & more
                </span>
              </button>
            )}

            {zipParsing && (
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-4">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{zipName}</p>
                  <p className="text-xs text-muted-foreground">
                    {zipExtract
                      ? zipExtract.label
                      : zipProgress
                        ? `${zipProgress.label} — ${zipProgress.done}/${zipProgress.total}`
                        : "Extracting & removing unneeded files…"}
                  {zipExtract && zipExtract.percent < 100 && (
                    <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all duration-150"
                        style={{ width: `${Math.max(4, zipExtract.percent)}%` }}
                      />
                    </div>
                  )}
                  </p>
                </div>
              </div>
            )}

            {!zipParsing && (repoFiles.length > 0 || zipName) && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {zipName || "Project archive"}
                        {repoZipUrl ? "" : repoFiles.length ? " (files only)" : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {repoFiles.length} file{repoFiles.length === 1 ? "" : "s"} ·{" "}
                        {formatRepoBytes(repoTotalBytes)} of source
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={clearZip} title="Remove archive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {repoFiles.length > 0 && (
                  <div className="rounded-xl border border-border bg-background p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <FolderTree className="h-3.5 w-3.5 text-cyan-500" />
                      Arranged file tree
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-5">
                      {repoFiles.slice(0, 40).map((f) => {
                        const dir = f.path.split("/").slice(0, -1).join("/")
                        return (
                          <div key={f.path} className="flex items-center gap-1.5 truncate">
                            <span className="text-muted-foreground">{dir ? `📁 ${dir}/` : ""}</span>
                            <span className="text-foreground">{f.name}</span>
                          </div>
                        )
                      })}
                      {repoFiles.length > 40 && (
                        <p className="mt-1 text-muted-foreground">+{repoFiles.length - 40} more files…</p>
                      )}
                    </div>
                    {repoTruncated && (
                      <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                        Some files were skipped to keep the project readable (max {300} files, 15MB of source).
                      </p>
                    )}
                  </div>
                )}

                {repoZipError && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    ⚠️ {repoZipError} — source files are saved, but the Download ZIP button won't work.
                  </p>
                )}
                {repoRemoved.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Removed unneeded files: {repoRemoved.join(" · ")}
                  </p>
                )}
              </div>
            )}

            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={handleZipPick}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="code">Code (optional if you attach a ZIP or file below)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview((v) => !v)}
                disabled={!formData.code.trim()}
                className="h-7 gap-1.5 text-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                {showPreview ? "Edit" : "Preview"}
              </Button>
            </div>
            {showPreview ? (
              <div className="mt-2 min-h-[200px] max-h-[320px] overflow-auto rounded-md border border-border bg-muted/50">
                <SyntaxHighlightedCode code={formData.code} language={formData.language} />
              </div>
            ) : (
              <Textarea
                id="code"
                placeholder="Paste your code here... (or upload a ZIP above)"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="mt-2 min-h-[200px] font-mono text-sm"
              />
            )}
          </div>

          <div>
            <Label>Attach extra files (optional)</Label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Share assets or docs alongside your code — up to {MAX_FILES} files, 25MB each.
            </p>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFilePick} />
            <div className="flex flex-wrap items-center gap-2">
              {files.map((file) => (
                <Badge key={file.url} variant="secondary" className="flex items-center gap-1.5 py-1.5 pl-2 pr-1">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[140px] truncate">{file.name}</span>
                  <button type="button" onClick={() => handleRemoveFile(file.url)} className="ml-1 hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              {files.length < MAX_FILES && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="h-8"
                >
                  {uploadingFile ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {uploadingFile ? "Uploading…" : "Add file"}
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <div className="mt-2 space-y-2">
              <div className="flex space-x-2">
                <Input
                  placeholder="Add a tag..."
                  value={formData.newTag}
                  onChange={(e) => setFormData({ ...formData, newTag: e.target.value })}
                  onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                  className="flex-1"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  Add
                </Button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center space-x-1">
                      <span>#{tag}</span>
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || zipParsing}
              className="flex-1"
            >
              {isSubmitting
                ? isEdit
                  ? "Saving..."
                  : "Sharing..."
                : isEdit
                  ? "Save Changes"
                  : "Share Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}

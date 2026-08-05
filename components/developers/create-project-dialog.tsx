"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Code, Eye, FileText, Loader2, Paperclip, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLoginGate } from "@/hooks/use-login-gate";
import { uploadMediaFile } from "@/lib/client-media-upload";
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
  const { toast } = useToast()
  const { getAuthHeader } = useAuth()
  const { requireAuth, LoginGateDialog } = useLoginGate()

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
      setShowPreview(false)
    } else {
      setFormData(emptyForm)
      setFiles([])
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

    if (!formData.code.trim() && files.length === 0) {
      toast({
        title: "Nothing to share",
        description: "Add a code snippet or attach at least one file.",
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

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="code">Code (optional if you attach a file below)</Label>
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
                placeholder="Paste your code here..."
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="mt-2 min-h-[200px] font-mono text-sm"
              />
            )}
          </div>

          <div>
            <Label>Attach files (optional)</Label>
            <p className="mb-2 mt-0.5 text-xs text-muted-foreground">
              Share assets, docs, or a project zip alongside your code — up to {MAX_FILES} files, 25MB each.
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
              disabled={isSubmitting}
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

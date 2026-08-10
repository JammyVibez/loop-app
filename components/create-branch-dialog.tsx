"use client";
import type React from "react";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Type, ImageIcon, Video, Music, FileText, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface CreateBranchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  parentLoop: any
}

export function CreateBranchDialog({ open, onOpenChange, parentLoop }: CreateBranchDialogProps) {
  const [activeTab, setActiveTab] = useState("text")
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const { user, getAuthHeader } = useAuth()

  const parentPreview =
    typeof parentLoop?.content === "string"
      ? parentLoop.content
      : parentLoop?.content?.text || parentLoop?.content_text || ""

  const parentAuthorName =
    parentLoop?.author?.display_name || parentLoop?.author?.displayName || parentLoop?.author || "Unknown"

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 50MB",
          variant: "destructive",
        })
        return
      }
      setSelectedFile(file)
    }
  }

  const handleSubmit = async () => {
    if (!content.trim() && !selectedFile) {
      toast({
        title: "Content required",
        description: "Please add content to your branch",
        variant: "destructive",
      })
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
        headers: {
          ...getAuthHeader(),
        },
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error || "Failed to create branch")
      }

      toast({
        title: "Branch created",
        description: "Your branch has been added to the loop tree",
      })

      setContent("")
      setTitle("")
      setSelectedFile(null)
      onOpenChange(false)

      // Refresh to show new branch
      window.location.reload()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to create branch. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border text-foreground max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center space-x-2">
            <GitBranch className="w-5 h-5 text-green-500" />
            <span>Quote / Branch this Loop</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Parent Loop Preview */}
          <div className="bg-muted rounded-lg p-4 border-l-4 border-primary">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm text-muted-foreground">Quoting:</span>
              <Badge className="bg-primary text-primary-foreground">{parentAuthorName}</Badge>
            </div>
            <p className="text-foreground text-sm">
              {parentPreview.slice(0, 100)}
              {parentPreview.length > 100 ? "..." : ""}
            </p>
          </div>

          {/* Content Type Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 bg-muted">
              <TabsTrigger value="text" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Type className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Text</span>
              </TabsTrigger>
              <TabsTrigger value="image" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <ImageIcon className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Image</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Video className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <Music className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">Audio</span>
              </TabsTrigger>
              <TabsTrigger value="file" className="text-foreground data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                <FileText className="w-4 h-4" />
                <span className="ml-2 hidden sm:inline">File</span>
              </TabsTrigger>
            </TabsList>

            {/* Title Input */}
            <div className="space-y-2">
              <Label className="text-foreground">Branch Title (Optional)</Label>
              <Input
                placeholder="Give your branch a title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <TabsContent value="text" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Your Addition</Label>
                <Textarea
                  placeholder="Continue the story, add your perspective, or take it in a new direction..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[120px] bg-background border-border text-foreground placeholder:text-muted-foreground resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="image" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Upload Image</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="branch-image-upload"
                  />
                  <label htmlFor="branch-image-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Click to upload an image</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB</p>
                  </label>
                </div>
                {selectedFile && (
                  <Badge className="bg-green-600 text-white">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Caption</Label>
                <Textarea
                  placeholder="Add context to your image branch..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="video" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Upload Video</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="branch-video-upload"
                  />
                  <label htmlFor="branch-video-upload" className="cursor-pointer">
                    <Video className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Click to upload a video</p>
                    <p className="text-xs text-muted-foreground mt-1">MP4, MOV, AVI up to 50MB</p>
                  </label>
                </div>
                {selectedFile && (
                  <Badge className="bg-green-600 text-white">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Description</Label>
                <Textarea
                  placeholder="Describe your video response..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="audio" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Upload Audio</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="branch-audio-upload"
                  />
                  <label htmlFor="branch-audio-upload" className="cursor-pointer">
                    <Music className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Click to upload audio</p>
                    <p className="text-xs text-muted-foreground mt-1">MP3, WAV, OGG up to 25MB</p>
                  </label>
                </div>
                {selectedFile && (
                  <Badge className="bg-green-600 text-white">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Track Info</Label>
                <Textarea
                  placeholder="Tell us about your audio response..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  rows={3}
                />
              </div>
            </TabsContent>

            <TabsContent value="file" className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Upload File</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-emerald-500 transition-colors">
                  <input
                    type="file"
                    accept=".zip,.pdf,.docx,.txt,.md,.json,.js,.ts,.py,.java,.cpp,.c,.html,.css"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="branch-file-upload"
                  />
                  <label htmlFor="branch-file-upload" className="cursor-pointer">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Click to upload a file</p>
                    <p className="text-xs text-muted-foreground mt-1">ZIP, PDF, DOCX, code files up to 50MB</p>
                  </label>
                </div>
                {selectedFile && (
                  <Badge className="bg-green-600 text-white">
                    {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)}MB)
                  </Badge>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Description</Label>
                <Textarea
                  placeholder="Describe what you're adding to the loop..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>

          {/* Branch Info */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <GitBranch className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Branching Rules</span>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Your branch will be connected to the original loop</li>
              <li>• Others can branch from your branch (up to 10 levels deep)</li>
              <li>• You'll get credit when others interact with your branch</li>
              <li>• Branches help create collaborative story trees</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-border text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (!content.trim() && !selectedFile)}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              {isSubmitting ? "Posting…" : "Post quote"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

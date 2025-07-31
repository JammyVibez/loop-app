"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Code, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const languages = ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java", "C++", "PHP", "Ruby"]
const frameworks = ["React", "Vue", "Angular", "Node.js", "Django", "Flask", "Express", "Spring", "Rails"]

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    language: "",
    framework: "",
    code: "",
    tags: [] as string[],
    newTag: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

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
    if (!formData.title.trim() || !formData.description.trim() || !formData.code.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Project Shared!",
        description: "Your project has been shared with the developer community.",
      })

      onOpenChange(false)
      setFormData({
        title: "",
        description: "",
        language: "",
        framework: "",
        code: "",
        tags: [],
        newTag: "",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to share project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-purple-600" />
            <span>Share Your Project</span>
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

          <div className="grid grid-cols-2 gap-4">
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
                value={formData.framework}
                onValueChange={(value) => setFormData({ ...formData, framework: value })}
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
            <Label htmlFor="code">Code *</Label>
            <Textarea
              id="code"
              placeholder="Paste your code here..."
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="mt-2 min-h-[200px] font-mono text-sm"
            />
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
                      <button type="button" onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-red-600">
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
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
            >
              {isSubmitting ? "Sharing..." : "Share Project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

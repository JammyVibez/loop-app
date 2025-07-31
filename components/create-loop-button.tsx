"use client"

import type React from "react"

import { useState } from "react"
import { Plus, ImageIcon, Video, Music, FileText, Code } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Badge } from "./ui/badge"
import { useAuth } from "../providers/auth-provider"

export function CreateLoopButton() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "audio" | "code">("text")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Mock submission - replace with real API call
    console.log("Creating loop:", {
      content,
      hashtags: hashtags.split(" ").filter((tag) => tag.startsWith("#")),
      mediaFile,
      mediaType,
      userId: user?.id,
    })

    // Reset form
    setContent("")
    setHashtags("")
    setMediaFile(null)
    setMediaType("text")
    setIsOpen(false)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setMediaFile(file)

      // Auto-detect media type
      if (file.type.startsWith("image/")) {
        setMediaType("image")
      } else if (file.type.startsWith("video/")) {
        setMediaType("video")
      } else if (file.type.startsWith("audio/")) {
        setMediaType("audio")
      } else if (file.name.endsWith(".zip") || file.name.endsWith(".js") || file.name.endsWith(".py")) {
        setMediaType("code")
      }
    }
  }

  if (!isOpen) {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setIsOpen(true)}>
        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-gray-500 dark:text-gray-400">What's on your mind, {user?.display_name}?</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Create a Loop</span>
          <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
            ×
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={mediaType} onValueChange={(value) => setMediaType(value as any)}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="text" className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Text</span>
              </TabsTrigger>
              <TabsTrigger value="image" className="flex items-center space-x-1">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Image</span>
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center space-x-1">
                <Video className="h-4 w-4" />
                <span className="hidden sm:inline">Video</span>
              </TabsTrigger>
              <TabsTrigger value="audio" className="flex items-center space-x-1">
                <Music className="h-4 w-4" />
                <span className="hidden sm:inline">Audio</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center space-x-1">
                <Code className="h-4 w-4" />
                <span className="hidden sm:inline">Code</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-4">
              <div>
                <Label htmlFor="content">What's your loop about?</Label>
                <Textarea
                  id="content"
                  placeholder="Share your thoughts, ideas, or start a story..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[120px] resize-none"
                  required
                />
              </div>
            </TabsContent>

            <TabsContent value="image" className="space-y-4">
              <div>
                <Label htmlFor="content">Describe your image</Label>
                <Textarea
                  id="content"
                  placeholder="Tell us about your image..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div>
                <Label htmlFor="image-file">Upload Image</Label>
                <Input id="image-file" type="file" accept="image/*" onChange={handleFileChange} />
              </div>
            </TabsContent>

            <TabsContent value="video" className="space-y-4">
              <div>
                <Label htmlFor="content">Describe your video</Label>
                <Textarea
                  id="content"
                  placeholder="What's your video about?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div>
                <Label htmlFor="video-file">Upload Video</Label>
                <Input id="video-file" type="file" accept="video/*" onChange={handleFileChange} />
              </div>
            </TabsContent>

            <TabsContent value="audio" className="space-y-4">
              <div>
                <Label htmlFor="content">Describe your audio</Label>
                <Textarea
                  id="content"
                  placeholder="Tell us about your audio track..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div>
                <Label htmlFor="audio-file">Upload Audio</Label>
                <Input id="audio-file" type="file" accept="audio/*" onChange={handleFileChange} />
              </div>
            </TabsContent>

            <TabsContent value="code" className="space-y-4">
              <div>
                <Label htmlFor="content">Describe your code/project</Label>
                <Textarea
                  id="content"
                  placeholder="What does your code do? What problem does it solve?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div>
                <Label htmlFor="code-file">Upload Code/Project</Label>
                <Input
                  id="code-file"
                  type="file"
                  accept=".zip,.js,.py,.html,.css,.json,.md,.txt"
                  onChange={handleFileChange}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div>
            <Label htmlFor="hashtags">Hashtags</Label>
            <Input
              id="hashtags"
              placeholder="#webdev #design #creativity"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
            />
            <p className="text-sm text-muted-foreground mt-1">Add hashtags to help others discover your loop</p>
          </div>

          {mediaFile && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {mediaType === "image" && <ImageIcon className="h-4 w-4" />}
                  {mediaType === "video" && <Video className="h-4 w-4" />}
                  {mediaType === "audio" && <Music className="h-4 w-4" />}
                  {mediaType === "code" && <Code className="h-4 w-4" />}
                  <span className="text-sm font-medium">{mediaFile.name}</span>
                  <Badge variant="secondary">{mediaType}</Badge>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setMediaFile(null)}>
                  Remove
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">{content.length}/500 characters</div>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!content.trim()}>
                Create Loop
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

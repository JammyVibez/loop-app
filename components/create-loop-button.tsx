"use client"

import type React from "react"

import { useState } from "react"
import { Plus, ImageIcon, Video, Music, FileText, Code, X, Upload } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Textarea } from "./ui/textarea"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Badge } from "./ui/badge"
import { useAuth } from "../providers/auth-provider"
import { createClient } from "@supabase/supabase-js"

// Use NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for client-side code
import { supabase } from "@/lib/supabase"

interface CreateLoopButtonProps {
  onLoopCreated?: () => void
}

export function CreateLoopButton({ onLoopCreated }: CreateLoopButtonProps) {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [content, setContent] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [mediaFiles, setMediaFiles] = useState<File[]>([])
  const [mediaType, setMediaType] = useState<"text" | "image" | "video" | "audio" | "code">("text")
  const [creating, setCreating] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number[]>([])

  const getMaxFiles = () => {
    return user?.is_premium || user?.is_verified ? 4 : 1
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !user.token) {
      alert("You must be logged in to create a loop.");
      setCreating(false);
      return;
    }
    setCreating(true);

    try {
      let res;

      if (mediaFiles.length > 0) {
        // ✅ OPTION B: send file(s) directly to backend
        const formData = new FormData();
        formData.append("content", content);
        formData.append("title", content.slice(0, 80) || "");
        formData.append("type", mediaType);
        formData.append("author_id", user.id);

        // only append first file for now (backend expects one)
        formData.append("file", mediaFiles[0]);

        res = await fetch("/api/loops", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${user.token}`, // ⚠️ no Content-Type here, browser sets it
          },
          body: formData,
        });
      } else {
        // ✅ OPTION A: no file → send JSON
        res = await fetch("/api/loops", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            content,
            title: content.slice(0, 80) || null,
            type: mediaType,
            hashtags: hashtags
              .split(/[ ,#]+/)
              .filter((tag) => tag.length > 0)
              .map((tag) => tag.toLowerCase()),
            author_id: user.id,
          }),
        });
      }

      const result = await res.json();
      if (res.ok) {
        setContent("");
        setHashtags("");
        setMediaFiles([]);
        setMediaType("text");
        setUploadProgress([]);
        setIsOpen(false);
        // Call the callback after successful creation
        if (onLoopCreated) {
          onLoopCreated();
        }
      } else {
        alert("Failed to create loop: " + (result.error || res.statusText));
      }
    } catch (err: any) {
      alert("Failed to create loop: " + err.message);
    }

    setCreating(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const maxFiles = getMaxFiles()

    if (files.length > maxFiles) {
      alert(
        `${user?.is_premium || user?.is_verified ? "Premium users" : "Free users"} can upload up to ${maxFiles} file${maxFiles > 1 ? "s" : ""} per post.`,
      )
      return
    }

    if (files.length > 0) {
      setMediaFiles(files)

      // Auto-detect media type from first file
      const firstFile = files[0]
      if (firstFile.type.startsWith("image/")) {
        setMediaType("image")
      } else if (firstFile.type.startsWith("video/")) {
        setMediaType("video")
      } else if (firstFile.type.startsWith("audio/")) {
        setMediaType("audio")
      } else if (firstFile.name.endsWith(".zip") || firstFile.name.endsWith(".js") || firstFile.name.endsWith(".py")) {
        setMediaType("code")
      }
    }
  }

  const removeFile = (index: number) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index))
    setUploadProgress((prev) => prev.filter((_, i) => i !== index))
  }

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />
    if (file.type.startsWith("video/")) return <Video className="h-4 w-4" />
    if (file.type.startsWith("audio/")) return <Music className="h-4 w-4" />
    return <Code className="h-4 w-4" />
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
              {user?.is_premium || user?.is_verified ? (
                <p className="text-xs text-purple-600 mt-1">Premium: Upload up to 4 media files per post</p>
              ) : (
                <p className="text-xs text-gray-400 mt-1">Upgrade to Premium for multi-media posts</p>
              )}
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
                <Label htmlFor="image-file">Upload Images</Label>
                <Input
                  id="image-file"
                  type="file"
                  accept="image/*"
                  multiple={user?.is_premium || user?.is_verified}
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {user?.is_premium || user?.is_verified
                    ? `Upload up to ${getMaxFiles()} images`
                    : "Upgrade to Premium for multiple images"}
                </p>
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
                <Label htmlFor="video-file">Upload Videos</Label>
                <Input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  multiple={user?.is_premium || user?.is_verified}
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {user?.is_premium || user?.is_verified
                    ? `Upload up to ${getMaxFiles()} videos`
                    : "Upgrade to Premium for multiple videos"}
                </p>
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
                <Input
                  id="audio-file"
                  type="file"
                  accept="audio/*"
                  multiple={user?.is_premium || user?.is_verified}
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {user?.is_premium || user?.is_verified
                    ? `Upload up to ${getMaxFiles()} audio files`
                    : "Upgrade to Premium for multiple audio files"}
                </p>
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
                  multiple={user?.is_premium || user?.is_verified}
                  onChange={handleFileChange}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {user?.is_premium || user?.is_verified
                    ? `Upload up to ${getMaxFiles()} files`
                    : "Upgrade to Premium for multiple files"}
                </p>
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

          {mediaFiles.length > 0 && (
            <div className="space-y-2">
              <Label>
                Selected Files ({mediaFiles.length}/{getMaxFiles()})
              </Label>
              {mediaFiles.map((file, index) => (
                <div key={index} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(file)}
                      <span className="text-sm font-medium">{file.name}</span>
                      <Badge variant="secondary">{mediaType}</Badge>
                      <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {creating && uploadProgress[index] !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[index]}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Uploading... {Math.round(uploadProgress[index])}%</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {content.length}/500 characters
              {user?.is_premium || user?.is_verified ? (
                <span className="ml-2 text-purple-600">• Premium Multi-media</span>
              ) : (
                <span className="ml-2 text-gray-400">• Single file limit</span>
              )}
            </div>
            <div className="flex space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!content.trim() || creating}>
                {creating ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Loop"
                )}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { uploadMediaFile } from "@/lib/client-media-upload"
import {
  Loader2,
  Upload,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  Crown,
  GripVertical,
  Plus,
  X,
} from "lucide-react"

interface PfpFrame {
  id: number
  name: string
  description: string | null
  image_url: string
  image_type: string
  is_active: boolean
  is_premium: boolean
  price_coins: number
  sort_order: number
  equipped_count?: number
  created_at: string
}

export function AdminFramesTab() {
  const { toast } = useToast()
  const { getAuthHeader } = useAuth()
  const [frames, setFrames] = useState<PfpFrame[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newPrice, setNewPrice] = useState(0)
  const [newPremium, setNewPremium] = useState(false)
  const [newSortOrder, setNewSortOrder] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const fetchFrames = useCallback(async () => {
    try {
      setLoading(true)
      const headers = getAuthHeader()
      const res = await fetch("/api/admin/pfp-frames", { headers })
      const data = await res.json()
      if (data.frames) setFrames(data.frames)
    } catch (e) {
      console.error("Failed to fetch frames:", e)
    } finally {
      setLoading(false)
    }
  }, [getAuthHeader])

  useEffect(() => {
    fetchFrames()
  }, [fetchFrames])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)

    // Auto-set name from filename if empty
    if (!newName.trim()) {
      const baseName = file.name.replace(/\.[^.]+$/, "")
      setNewName(baseName)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !newName.trim()) {
      toast({ title: "Error", description: "Name and file are required", variant: "destructive" })
      return
    }

    try {
      setUploading(true)
      const headers = getAuthHeader()

      // Determine upload type based on file MIME
      const isVideo = selectedFile.type.startsWith("video/")
      const isAudio = selectedFile.type.startsWith("audio/")
      const isImage = selectedFile.type.startsWith("image/") || selectedFile.type === "image/svg+xml"
      const uploadType = isVideo ? "video" : isAudio ? "audio" : isImage ? "image" : "file"

      // Upload file to Cloudinary
      const uploaded = await uploadMediaFile(selectedFile, {
        type: uploadType,
        folder: "pfp-frames",
        authHeaders: headers,
      })

      // Create frame in database
      const res = await fetch("/api/admin/pfp-frames", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          image_url: uploaded.url,
          image_type: selectedFile.type,
          is_premium: newPremium,
          price_coins: newPrice,
          sort_order: newSortOrder,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: "Frame uploaded!", description: `"${newName}" frame created successfully` })
      setShowAddForm(false)
      resetForm()
      fetchFrames()
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (frame: PfpFrame) => {
    if (!confirm(`Delete "${frame.name}"? This cannot be undone.`)) return

    try {
      setDeleting(frame.id)
      const headers = getAuthHeader()
      const res = await fetch(`/api/admin/pfp-frames?id=${frame.id}`, {
        method: "DELETE",
        headers,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: "Frame deleted", description: `"${frame.name}" removed` })
      fetchFrames()
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  const resetForm = () => {
    setNewName("")
    setNewDescription("")
    setNewPrice(0)
    setNewPremium(false)
    setNewSortOrder(frames.length)
    setSelectedFile(null)
    setPreviewUrl(null)
    setDragOver(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> PFP Frames
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage profile picture frames. Users can acquire and equip these.
          </p>
        </div>
        <Button onClick={() => { setShowAddForm(true); resetForm() }}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Frame
        </Button>
      </div>

      {/* Add Frame Form */}
      {showAddForm && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" /> Upload New Frame
              </span>
              <Button variant="ghost" size="icon" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File upload area */}
            <div
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) {
                  setSelectedFile(file)
                  const url = URL.createObjectURL(file)
                  setPreviewUrl(url)
                  if (!newName.trim()) {
                    const baseName = file.name.replace(/\.[^.]+$/, "")
                    setNewName(baseName)
                  }
                }
              }}
            >
              {previewUrl ? (
                <div className="relative">
                  {selectedFile?.type.startsWith("video/") ? (
                    <video
                      src={previewUrl}
                      className="h-32 w-32 rounded-full object-cover border-4 border-primary/20"
                      muted
                    />
                  ) : selectedFile?.type.startsWith("audio/") ? (
                    <div className="h-32 w-32 rounded-full border-4 border-primary/20 bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                      <svg className="h-12 w-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    </div>
                  ) : (
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="h-32 w-32 rounded-full object-cover border-4 border-primary/20"
                    />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-medium">Change</span>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Click to upload any file
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Images, videos, GIFs, audio, SVG, Lottie — anything goes
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Frame details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="frame-name">Name *</Label>
                <Input
                  id="frame-name"
                  placeholder="e.g. Neon Glow"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frame-price">Price (coins)</Label>
                <Input
                  id="frame-price"
                  type="number"
                  min={0}
                  value={newPrice}
                  onChange={(e) => setNewPrice(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="frame-desc">Description</Label>
                <Textarea
                  id="frame-desc"
                  placeholder="Optional description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frame-sort">Sort Order</Label>
                <Input
                  id="frame-sort"
                  type="number"
                  min={0}
                  value={newSortOrder}
                  onChange={(e) => setNewSortOrder(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  id="frame-premium"
                  checked={newPremium}
                  onCheckedChange={setNewPremium}
                />
                <Label htmlFor="frame-premium" className="flex items-center gap-1.5 cursor-pointer">
                  <Crown className="h-3.5 w-3.5 text-amber-500" /> Premium only
                </Label>
              </div>
            </div>

            {/* Upload button */}
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile || !newName.trim()}
              className="w-full"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1.5" />
              )}
              {uploading ? "Uploading..." : "Upload Frame"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Frames grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : frames.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-sm text-muted-foreground">No frames yet. Upload your first frame!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {frames.map((frame) => (
            <Card key={frame.id} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Frame preview */}
                  <div className="relative shrink-0">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-muted border-2 border-primary/20">
                      {(frame.image_type || "").startsWith("video/") ? (
                        <video
                          src={frame.image_url}
                          className="h-full w-full object-cover"
                          muted
                        />
                      ) : (frame.image_type || "").startsWith("audio/") ? (
                        <div className="h-full w-full bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                          <span className="text-lg">🎵</span>
                        </div>
                      ) : (
                        <img
                          src={frame.image_url}
                          alt={frame.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            const el = e.target as HTMLImageElement
                            el.style.display = "none"
                          }}
                        />
                      )}
                    </div>
                    {frame.is_premium && (
                      <div className="absolute -top-1 -right-1">
                        <Crown className="h-4 w-4 text-amber-500" />
                      </div>
                    )}
                  </div>

                  {/* Frame info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold truncate">{frame.name}</h4>
                      {!frame.is_active && (
                        <span className="text-xs bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded">Hidden</span>
                      )}
                    </div>
                    {frame.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{frame.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{frame.price_coins} coins</span>
                      <span>•</span>
                      <span>{frame.equipped_count || 0} equipped</span>
                      <span>•</span>
                      <span>#{frame.sort_order}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDelete(frame)}
                    disabled={deleting === frame.id}
                  >
                    {deleting === frame.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

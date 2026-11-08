"use client"

import { useEffect, useRef, useState } from "react"
import { Film, ImageIcon, LayoutGrid, List, Loader2, Music2, Newspaper, Save, Trash2, Upload } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { cn } from "@/lib/utils"
import { isVideoProfileBackground, type ProfileAtmosphere, type ProfilePostView } from "@/lib/profile-theme"

const POST_VIEW_OPTIONS: Array<{ id: ProfilePostView; label: string; hint: string; icon: typeof LayoutGrid }> = [
  { id: "grid", label: "Grid", hint: "Square tiles, visual", icon: LayoutGrid },
  { id: "list", label: "List", hint: "Compact rows", icon: List },
  { id: "cards", label: "Post cards", hint: "Full posts with actions", icon: Newspaper },
]

/**
 * Owner controls for the profile's atmosphere: the background media (picture,
 * GIF or short video), the soundtrack, whether visitors hear it automatically,
 * and how posts are laid out for them. Saved as `theme_preferences` on the
 * owner's profile, so equipping a theme and editing it share one record.
 */
export function ProfileAtmosphereDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial: ProfileAtmosphere
  onSaved: (preferences: Record<string, unknown>) => void
}) {
  const { getAuthHeader, refreshUser } = useAuth()
  const { toast } = useToast()
  const [background, setBackground] = useState(initial.backgroundUrl || "")
  const [audio, setAudio] = useState(initial.audioUrl || "")
  const [audioTitle, setAudioTitle] = useState(initial.audioTitle || "")
  const [audioEnabled, setAudioEnabled] = useState(initial.audioEnabled)
  const [audioAutoplay, setAudioAutoplay] = useState(initial.audioAutoplay)
  const [postView, setPostView] = useState<ProfilePostView>(initial.postView || "grid")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<"background" | "audio" | null>(null)
  const backgroundInputRef = useRef<HTMLInputElement | null>(null)
  const audioInputRef = useRef<HTMLInputElement | null>(null)

  // Re-sync whenever the dialog is opened for a fresh profile state.
  useEffect(() => {
    if (!open) return
    setBackground(initial.backgroundUrl || "")
    setAudio(initial.audioUrl || "")
    setAudioTitle(initial.audioTitle || "")
    setAudioEnabled(initial.audioEnabled)
    setAudioAutoplay(initial.audioAutoplay)
    setPostView(initial.postView || "grid")
  }, [open, initial.backgroundUrl, initial.audioUrl, initial.audioTitle, initial.audioEnabled, initial.audioAutoplay, initial.postView])

  const upload = async (file: File, kind: "background" | "audio") => {
    setUploading(kind)
    try {
      // A background is a picture, a GIF or a short video, so the upload type
      // follows the file instead of forcing everything through the image path.
      const backgroundType = file.type.startsWith("video/") || isVideoProfileBackground(file.name) ? "video" : "image"
      const result = await uploadMediaFile(file, {
        type: kind === "audio" ? "audio" : backgroundType,
        folder: "profile-atmosphere",
        authHeaders: getAuthHeader(),
      })
      if (kind === "audio") {
        setAudio(result.url)
        if (!audioTitle.trim()) setAudioTitle(file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 80))
        setAudioEnabled(true)
      } else {
        setBackground(result.url)
      }
      toast({ description: `${kind === "audio" ? "Soundtrack" : "Background"} uploaded` })
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(null)
    }
  }

  const save = async () => {
    if (saving) return
    if (audioEnabled && !audio.trim()) {
      toast({ title: "Add a soundtrack", description: "Upload a track or switch profile sound off.", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const response = await fetch("/api/users/profile-atmosphere", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          profile_background: background.trim(),
          profile_audio: audio.trim(),
          profile_audio_title: audioTitle.trim(),
          profile_audio_enabled: audioEnabled,
          profile_audio_autoplay: audioAutoplay,
          profile_post_view: postView,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not save your atmosphere.")
      onSaved((data.theme_preferences || {}) as Record<string, unknown>)
      await refreshUser()
      toast({ title: "Profile atmosphere saved", description: "Visitors will see it right away." })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: "Could not save",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-16px)] max-w-2xl overflow-y-auto rounded-2xl p-0 sm:w-[calc(100vw-32px)]">
        <div className="border-b border-border/70 px-5 py-4">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Music2 className="h-4 w-4" />
              </span>
              Profile atmosphere
            </DialogTitle>
            <DialogDescription>
              Set the background media, soundtrack and default post layout for everyone who visits your profile.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 px-5 py-4">
          {/* Background */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <ImageIcon className="h-4 w-4 text-muted-foreground" /> Background media
              </Label>
              <div className="flex items-center gap-1">
                <input
                  ref={backgroundInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) void upload(file, "background")
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full text-xs"
                  disabled={uploading !== null}
                  onClick={() => backgroundInputRef.current?.click()}
                >
                  {uploading === "background" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  Upload
                </Button>
                {background ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full text-muted-foreground"
                    aria-label="Remove background"
                    onClick={() => setBackground("")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="relative h-28 overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
              {background ? (
                isVideoProfileBackground(background) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video
                    key={background}
                    src={background}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={background} alt="Profile background preview" className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground">
                  <Film className="h-5 w-5" />
                  Painted behind your whole profile
                </div>
              )}
            </div>
            <Input
              value={background}
              onChange={(event) => setBackground(event.target.value)}
              placeholder="…or paste an image, GIF or video URL"
              className="h-9 text-xs"
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              A still image, an animated GIF or a short looping video. Video plays muted, like the home page
              backdrop, and holds its first frame for visitors who reduce motion.
            </p>
          </section>

          {/* Soundtrack */}
          <section className="space-y-2.5 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Music2 className="h-4 w-4 text-muted-foreground" /> Soundtrack
              </Label>
              <div className="flex items-center gap-1">
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ""
                    if (file) void upload(file, "audio")
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-full text-xs"
                  disabled={uploading !== null}
                  onClick={() => audioInputRef.current?.click()}
                >
                  {uploading === "audio" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                  Upload
                </Button>
                {audio ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-full text-muted-foreground"
                    aria-label="Remove soundtrack"
                    onClick={() => setAudio("")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            {audio ? (
              <audio src={audio} controls preload="metadata" className="h-9 w-full" />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Music plays softly on loop. Visitors can always mute it, and their choice is remembered.
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={audioTitle}
                onChange={(event) => setAudioTitle(event.target.value.slice(0, 80))}
                placeholder="Track title"
                className="h-9 text-xs"
              />
              <Input
                value={audio}
                onChange={(event) => setAudio(event.target.value)}
                placeholder="…or paste an audio URL"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-2 rounded-lg bg-background/60 p-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">Profile sound</p>
                  <p className="text-[11px] text-muted-foreground">Turn the soundtrack off for everyone.</p>
                </div>
                <Switch checked={audioEnabled} onCheckedChange={setAudioEnabled} aria-label="Profile sound" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium">Play automatically</p>
                  <p className="text-[11px] text-muted-foreground">
                    Off means visitors hear it only after tapping the sound pill.
                  </p>
                </div>
                <Switch
                  checked={audioAutoplay}
                  onCheckedChange={setAudioAutoplay}
                  disabled={!audioEnabled}
                  aria-label="Play soundtrack automatically"
                />
              </div>
            </div>
          </section>

          {/* Post presentation */}
          <section className="space-y-2">
            <div>
              <Label className="text-sm">Default post layout</Label>
              <p className="text-[11px] text-muted-foreground">
                What visitors see first. Anyone can switch views while browsing.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {POST_VIEW_OPTIONS.map((option) => {
                const Icon = option.icon
                const active = postView === option.id
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPostView(option.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors",
                      active
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/70 text-muted-foreground hover:border-border hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", active && "text-primary")} />
                    <span className="text-xs font-semibold">{option.label}</span>
                    <span className="text-[10px] leading-tight text-muted-foreground">{option.hint}</span>
                  </button>
                )
              })}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/70 px-5 py-3">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-full" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            {saving ? "Saving…" : "Save atmosphere"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

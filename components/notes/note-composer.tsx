"use client"

/**
 * Write the 60-character line under your name.
 *
 * The composer is where "shows everywhere" stops being an assumption: three
 * switches decide whether the note sits on your profile, rides along with your
 * posts, and appears in community threads. A note that is switched off
 * everywhere is just a deleted note, so the API refuses that combination and
 * the UI offers Delete instead.
 */

import { useEffect, useState } from "react"
import { MessageCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import {
  NOTE_MAX_LENGTH,
  NOTE_SURFACES,
  type NoteSurface,
  type NoteVisibility,
  type ProfileNote,
  isNoteLengthValid,
  sanitizeNoteText,
  surfaceLabel,
  visibilityFromRow,
} from "@/lib/profile-note"
import { deleteProfileNote, saveProfileNote } from "@/hooks/use-profile-note"

const DEFAULT_VISIBILITY: NoteVisibility = { profile: true, posts: true, communities: true }

export function NoteComposer({
  userId,
  note,
  onSaved,
}: {
  userId: string
  note: ProfileNote | null
  onSaved?: (note: ProfileNote | null) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState("")
  const [visibility, setVisibility] = useState<NoteVisibility>(DEFAULT_VISIBILITY)
  const [saving, setSaving] = useState(false)

  // Re-seed the form each time it opens so it always reflects the live note.
  useEffect(() => {
    if (!open) return
    setContent(note?.content || "")
    setVisibility(note ? visibilityFromRow(note) : DEFAULT_VISIBILITY)
  }, [open, note])

  const text = sanitizeNoteText(content)
  const canSave = isNoteLengthValid(content) && Object.values(visibility).some(Boolean)
  const hasExisting = Boolean(note)

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true)
    const result = await saveProfileNote(text, visibility)
    setSaving(false)

    if (!result.ok) {
      toast({ title: "Couldn't save note", description: result.error, variant: "destructive" })
      return
    }
    toast({ description: "Note is live for the next 24 hours." })
    onSaved?.(result.note || null)
    setOpen(false)
  }

  async function handleDelete() {
    if (saving) return
    setSaving(true)
    const result = await deleteProfileNote(userId)
    setSaving(false)

    if (!result.ok) {
      toast({ title: "Couldn't delete note", description: result.error, variant: "destructive" })
      return
    }
    toast({ description: "Note deleted." })
    onSaved?.(null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={hasExisting ? "outline" : "default"}
          size="sm"
          className="gap-1.5 rounded-full border-indigo-400/35 bg-indigo-500/15 shadow-sm backdrop-blur-sm hover:bg-indigo-500/25"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {hasExisting ? "Edit note" : "Add note"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hasExisting ? "Edit your note" : "Add a note"}</DialogTitle>
          <DialogDescription>
            Up to {NOTE_MAX_LENGTH} characters. Your note disappears after 24 hours — no archive, no
            history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Shipping something with a friend tonight…"
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              className="resize-none"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Keep it to one line.</span>
              <span className={content.length > NOTE_MAX_LENGTH ? "text-destructive" : ""}>
                {content.length}/{NOTE_MAX_LENGTH}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Where it shows</p>
            {NOTE_SURFACES.map((surface: NoteSurface) => (
              <div key={surface} className="flex items-center justify-between gap-4">
                <Label htmlFor={`note-surface-${surface}`} className="text-sm text-muted-foreground">
                  {surfaceLabel(surface)}
                </Label>
                <Switch
                  id={`note-surface-${surface}`}
                  checked={visibility[surface]}
                  onCheckedChange={(checked) =>
                    setVisibility((previous) => ({ ...previous, [surface]: checked }))
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Everywhere is the default. Switch off any place you&apos;d rather keep note-free.
            </p>
          </div>
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div>
            {hasExisting && (
              <Button variant="ghost" onClick={handleDelete} disabled={saving} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete note
              </Button>
            )}
          </div>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving…" : hasExisting ? "Update note" : "Post note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

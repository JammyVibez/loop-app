"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Zap, Clapperboard, Timer, Coins, Upload, Loader2, Hash } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import { MentionTextarea } from "@/components/mentions/mention-textarea"
import { uploadMediaFile } from "@/lib/client-media-upload"
import { cn } from "@/lib/utils"

interface CreateClutchDuelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDuelCreated?: () => void
}

const WINDOW_OPTIONS = [
  { seconds: 10, label: "10s — Quick" },
  { seconds: 20, label: "20s — Standard" },
  { seconds: 30, label: "30s" },
  { seconds: 60, label: "60s — Spicy" },
  { seconds: 120, label: "2 min" },
]

export function CreateClutchDuelDialog({ open, onOpenChange, onDuelCreated }: CreateClutchDuelDialogProps) {
  const [question, setQuestion] = useState("")
  const [clipFile, setClipFile] = useState<File | null>(null)
  const [clipUrl, setClipUrl] = useState("")
  const [clipPreview, setClipPreview] = useState<string | null>(null)
  const [windowSeconds, setWindowSeconds] = useState(20)
  const [stakeCoins, setStakeCoins] = useState(0)
  const [context, setContext] = useState("")
  const [hashtags, setHashtags] = useState("")
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  const { getAuthHeader } = useAuth()
  const { toast } = useToast()

  const pickFile = async (file: File | null) => {
    if (!file) return
    if (!file.type.startsWith("video/")) {
      toast({ title: "Not a video", description: "Clutch Duels need a video clip — the reveal only works with motion.", variant: "destructive" })
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Clip too large", description: "Keep the clip under 50MB.", variant: "destructive" })
      return
    }
    setClipFile(file)
    setClipPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) {
      toast({ title: "Missing question", description: "Ask the yes/no prediction question (e.g. “Does he land the clutch?”)." })
      return
    }

    setLoading(true)
    try {
      let finalClipUrl = clipUrl
      if (clipFile && !finalClipUrl) {
        setUploading(true)
        try {
          const result = await uploadMediaFile(clipFile, {
            type: "video",
            folder: "clutch-duels",
            authHeaders: getAuthHeader(),
          })
          finalClipUrl = result.url
        } finally {
          setUploading(false)
        }
      }

      if (!finalClipUrl) {
        toast({ title: "Clip required", description: "Upload the gaming clip so viewers can predict the outcome.", variant: "destructive" })
        return
      }

      const res = await fetch("/api/duels/clutch", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          clipUrl: finalClipUrl,
          question: question.trim(),
          predictionWindowSeconds: windowSeconds,
          stakeCoins,
          content: context.trim(),
          hashtags: hashtags
            .split(/[,\s]+/)
            .map((h) => h.replace(/^#/, "").trim())
            .filter(Boolean)
            .slice(0, 8),
        }),
      })
      const data = await res.json()
      if (res.ok && (data.duel || data.loop)) {
        toast({
          title: "Clutch Duel launched! ⚡",
          description: `Predictions are open for ${windowSeconds}s — let the community call it.`,
        })
        onOpenChange(false)
        setQuestion("")
        setClipFile(null)
        setClipUrl("")
        setClipPreview(null)
        setContext("")
        setHashtags("")
        setStakeCoins(0)
        if (onDuelCreated) onDuelCreated()
        else window.location.reload()
      } else {
        toast({ title: "Failed to launch", description: data.error || "Unknown error", variant: "destructive" })
      }
    } catch (err) {
      console.error("Clutch duel create failed:", err)
      toast({ title: "Failed to launch", description: "Could not create the clutch duel.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border-violet-500/30 bg-card text-card-foreground dark:bg-[#0d0a1e] dark:text-white p-6 shadow-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-amber-400">
            <Zap className="h-6 w-6 fill-amber-400" /> Launch a Clutch Duel
          </DialogTitle>
          <p className="text-xs text-muted-foreground dark:text-slate-400">
            Upload a gaming clip, hide the outcome, and let the community stake coins on yes or no before the reveal.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Clip upload */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-semibold text-foreground dark:text-slate-300">
              <Clapperboard className="h-3.5 w-3.5 text-violet-400" /> The Clip (the reveal)
            </label>
            {clipPreview ? (
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                <video src={clipPreview} muted loop playsInline className="max-h-52 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setClipFile(null)
                    setClipPreview(null)
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/80 px-2.5 py-1 text-xs text-white hover:bg-rose-600"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-violet-500/30 bg-violet-500/5 px-4 py-8 text-center transition hover:border-violet-400/60 hover:bg-violet-500/10">
                <Upload className="h-6 w-6 text-violet-400" />
                <span className="text-sm font-semibold text-slate-300">Tap to upload a video clip</span>
                <span className="text-[11px] text-slate-500">MP4/WebM · up to 50MB · the outcome plays after betting closes</span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => void pickFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          {/* Prediction question */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground dark:text-slate-300">Yes/No prediction question</label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Does he land the 1v4 clutch?"
              className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white placeholder:text-muted-foreground rounded-xl"
            />
          </div>

          {/* Window + optional creator bonus */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-foreground dark:text-slate-300">
                <Timer className="h-3.5 w-3.5 text-cyan-400" /> Prediction window
              </label>
              <select
                value={windowSeconds}
                onChange={(e) => setWindowSeconds(Number(e.target.value))}
                className="w-full h-10 bg-background dark:bg-slate-900 border border-input rounded-xl px-3 text-sm text-foreground dark:text-white focus:outline-none"
              >
                {WINDOW_OPTIONS.map((opt) => (
                  <option key={opt.seconds} value={opt.seconds}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 text-xs font-semibold text-foreground dark:text-slate-300">
                <Coins className="h-3.5 w-3.5 text-amber-400" /> Bonus pool (optional)
              </label>
              <Input
                type="number"
                min={0}
                max={1000}
                value={stakeCoins || ""}
                onChange={(e) => setStakeCoins(Number(e.target.value || 0))}
                placeholder="0"
                className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white rounded-xl"
              />
            </div>
          </div>

          {/* Context + hashtags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground dark:text-slate-300">Context (optional) — use @ to tag players</label>
            <MentionTextarea
              value={context}
              onChange={setContext}
              placeholder="Add trash talk or setup… Type @ to tag users"
              rows={2}
              className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white placeholder:text-muted-foreground rounded-xl min-h-[60px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-1 text-xs font-semibold text-foreground dark:text-slate-300">
              <Hash className="h-3.5 w-3.5 text-cyan-400" /> Hashtags
            </label>
            <Input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="valorant clutch clips (space or comma separated)"
              className="bg-background dark:bg-slate-900 border-input text-foreground dark:text-white placeholder:text-muted-foreground rounded-xl"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || uploading || !question.trim()}
              className={cn(
                "bg-gradient-to-r from-amber-500 to-orange-500 font-black text-slate-950 shadow-lg shadow-amber-900/40",
                "hover:from-amber-400 hover:to-orange-400",
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Uploading clip…
                </>
              ) : loading ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Launching…
                </>
              ) : (
                <>
                  <Zap className="mr-1.5 h-4 w-4 fill-current" /> Launch Clutch Duel
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

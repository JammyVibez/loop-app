"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader2, AlertTriangle, Check } from "lucide-react"

const REPORT_REASONS = [
  { id: "spam", label: "Spam or misleading content" },
  { id: "harassment", label: "Harassment or bullying" },
  { id: "inappropriate", label: "Inappropriate or offensive content" },
  { id: "misinformation", label: "False information" },
  { id: "other", label: "Other" },
]

interface ReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  postId: number
  communityId: string
}

export function ReportModal({ open, onOpenChange, postId, communityId }: ReportModalProps) {
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!reason) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(`/api/circles/${communityId}/posts/${postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "report", reason, details }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to submit report")
      }
      setSubmitted(true)
      setTimeout(() => {
        onOpenChange(false)
        setSubmitted(false)
        setReason("")
        setDetails("")
      }, 1500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Report Post
          </DialogTitle>
          <DialogDescription>
            Help us understand what's wrong with this post.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <Check className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold">Report submitted</p>
            <p className="text-xs text-muted-foreground">Our moderation team will review this.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((r) => (
                <div key={r.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.id} id={r.id} />
                  <Label htmlFor={r.id} className="text-sm cursor-pointer">
                    {r.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>

            {reason && (
              <div>
                <Label htmlFor="details" className="text-sm">Additional details (optional)</Label>
                <Textarea
                  id="details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide more context..."
                  className="mt-1.5 min-h-[80px] rounded-xl text-sm"
                  maxLength={500}
                />
              </div>
            )}

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={handleSubmit}
                disabled={!reason || submitting}
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                Submit Report
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

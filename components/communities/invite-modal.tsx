"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Copy, Check, Share2, Link, Loader2, Mail } from "lucide-react"

interface InviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  communityId: string
  communityName: string
}

export function InviteModal({ open, onOpenChange, communityId, communityName }: InviteModalProps) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [inviteLink, setInviteLink] = useState("")

  const generateLink = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/circles/${communityId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate_invite" }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.invite_link) {
          setInviteLink(data.invite_link)
        } else {
          setInviteLink(`${window.location.origin}/communities/${communityId}?invite=true`)
        }
      } else {
        setInviteLink(`${window.location.origin}/communities/${communityId}?invite=true`)
      }
    } catch {
      setInviteLink(`${window.location.origin}/communities/${communityId}?invite=true`)
    }
    setGenerating(false)
  }

  const copyLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const share = async () => {
    if (!inviteLink) return
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${communityName} on Loop`,
          text: `Join ${communityName} on Loop Social OS`,
          url: inviteLink,
        })
      } else {
        copyLink()
      }
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (v && !inviteLink) generateLink() }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-500" />
            Invite to {communityName}
          </DialogTitle>
          <DialogDescription>
            Share this link to invite others to join your community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {generating ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={inviteLink}
                  readOnly
                  className="rounded-xl text-sm font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl shrink-0"
                  onClick={copyLink}
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1 rounded-xl" onClick={share}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 mr-2 text-emerald-500" /> : <Link className="h-4 w-4 mr-2" />}
                  {copied ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { QrCode, Share2, Copy } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { VideoAvatar } from "@/components/cosmetics/video-avatar"
import { QRCodeSVG } from "qrcode.react"

interface ProfileShareCardProps {
  username: string
  displayName: string
  bio?: string
  avatarUrl?: string
  triggerClassName?: string
}

export function ProfileShareCard({ username, displayName, bio, avatarUrl, triggerClassName }: ProfileShareCardProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const cardRef = useRef<HTMLDivElement>(null)
  const profileUrl = useMemo(() => {
    if (typeof window === "undefined") return `https://loopapp.me/profile/${username}`
    return `${window.location.origin}/profile/${username}`
  }, [username])

  const copyLink = async () => {
    await navigator.clipboard.writeText(profileUrl)
    toast({ title: "Link copied", description: "Profile link is on your clipboard." })
  }

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: `${displayName} on Loop`, text: bio || `Check out @${username}`, url: profileUrl })
      return
    }
    await copyLink()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className={triggerClassName || "border-border bg-muted"}>
          <Share2 className="mr-2 h-4 w-4" />
          Share profile
        </Button>
      </DialogTrigger>
      <DialogContent className="border-border bg-popover text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-cyan-300" />
            Share card
          </DialogTitle>
        </DialogHeader>

        <div ref={cardRef} className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/20 via-[#0b1220] to-cyan-500/20 p-5">
          <div className="mb-4 flex items-center gap-3">
            <Avatar className="h-14 w-14">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{(displayName || username || "?").charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">{displayName}</p>
              <p className="text-sm text-muted-foreground">@{username}</p>
            </div>
          </div>
          {bio && <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">{bio}</p>}
          <div className="flex items-center justify-between gap-3">
            <div className="flex h-[120px] w-[120px] items-center justify-center rounded-xl border border-cyan-500/30 bg-white p-2 shrink-0 shadow-md">
              <QRCodeSVG value={profileUrl} size={104} fgColor="#090d16" bgColor="#ffffff" level="M" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-bold">Scan QR or Copy</p>
              <Input readOnly value={profileUrl} className="border-white/10 bg-white/5 text-xs font-mono" />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={copyLink} variant="outline" className="flex-1 border-border font-bold">
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
          <Button onClick={nativeShare} className="flex-1 bg-gradient-to-r from-violet-600 to-cyan-500 font-bold">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

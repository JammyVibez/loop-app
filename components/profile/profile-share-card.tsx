"use client"

import { useMemo, useState } from "react"
import { BadgeCheck, Check, Copy, ExternalLink, Link2, QrCode, Share2, UserPlus } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { QRCodeSVG } from "qrcode.react"
import { cn } from "@/lib/utils"
import { isVideoProfileBackground } from "@/lib/profile-theme"

export interface ProfileShareTheme {
  name?: string | null
  backgroundUrl?: string | null
  colors?: {
    primary?: string | null
    secondary?: string | null
    accent?: string | null
    background?: string | null
    text?: string | null
  } | null
}

interface ProfileShareCardProps {
  username: string
  displayName: string
  bio?: string
  avatarUrl?: string
  triggerClassName?: string
  /** Icon-only trigger, for dense action rows on a profile header. */
  iconOnly?: boolean
  /** The equipped profile theme, so the invite carries the actual look. */
  theme?: ProfileShareTheme | null
  stats?: { loops?: number; followers?: number; likes?: number }
  isOwner?: boolean
}

function formatCount(value: number | undefined) {
  if (!value) return "0"
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`
  return String(value)
}

/**
 * Share a profile — theme included.
 *
 * A profile is the one page where the design *is* the content, so the invite
 * shows the real background (image, GIF or muted video), the equipped theme's
 * name and colours, and the stats a visitor would see. The link carries
 * `?invite=1`, which renders a join banner for guests on the profile itself.
 */
export function ProfileShareCard({
  username,
  displayName,
  bio,
  avatarUrl,
  triggerClassName,
  iconOnly = false,
  theme,
  stats,
  isOwner = false,
}: ProfileShareCardProps) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState<"invite" | "profile" | null>(null)
  const { toast } = useToast()

  const origin = typeof window === "undefined" ? "https://loopapp.me" : window.location.origin
  const profileUrl = `${origin}/profile/${username}`
  const inviteUrl = `${profileUrl}?invite=1`
  const themeName = theme?.name?.trim() || null
  const backgroundUrl = theme?.backgroundUrl || null
  const isVideo = isVideoProfileBackground(backgroundUrl)
  const accent = theme?.colors?.accent || theme?.colors?.primary || "#a78bfa"
  const secondary = theme?.colors?.secondary || theme?.colors?.primary || accent

  const shareText = useMemo(() => {
    const look = themeName ? ` is wearing the ${themeName} theme on Loop` : " has a Loop profile worth seeing"
    return `${displayName}${look}. Take a look — and join if you want one like it.`
  }, [displayName, themeName])

  const copy = async (value: string, kind: "invite" | "profile") => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1800)
      toast({
        title: kind === "invite" ? "Invite link copied" : "Profile link copied",
        description: kind === "invite" ? "Anyone who opens it lands on the themed profile." : "Link is on your clipboard.",
      })
    } catch {
      toast({ title: "Couldn't copy", description: "Copy the link from the field instead.", variant: "destructive" })
    }
  }

  const nativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: themeName ? `${displayName} — ${themeName} on Loop` : `${displayName} on Loop`,
          text: shareText,
          url: inviteUrl,
        })
        return
      }
      await copy(inviteUrl, "invite")
    } catch {
      // The share sheet was dismissed; nothing to report.
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          aria-label={iconOnly ? "Share profile" : undefined}
          title={iconOnly ? "Share profile" : undefined}
          className={triggerClassName || "border-border bg-muted"}
        >
          <Share2 className={iconOnly ? "h-4 w-4" : "mr-2 h-4 w-4"} />
          {iconOnly ? <span className="sr-only">Share profile</span> : isOwner ? "Share profile" : "Share"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] overflow-y-auto border-border bg-popover p-4 text-foreground sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" style={{ color: accent }} />
            {isOwner ? "Invite someone to see your profile" : `Share ${displayName}'s profile`}
          </DialogTitle>
        </DialogHeader>

        {/* The invite preview is the profile's real look: media background,
            theme name, avatar and stats — not a generic gradient card. */}
        <div className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#0a0910]">
          <div className="relative aspect-[16/10] w-full overflow-hidden">
            {backgroundUrl ? (
              isVideo ? (
                <video
                  src={backgroundUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover object-top"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
              )
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(120% 100% at 18% 0%, ${accent}55, transparent 62%), radial-gradient(100% 90% at 90% 100%, ${secondary}44, transparent 64%), #0a0910`,
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/35 to-black/85" />

            <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/90 backdrop-blur-sm">
                <BadgeCheck className="h-2.5 w-2.5" />
                {themeName || "Loop profile"}
              </span>
              <span className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[9px] font-semibold text-white/70 backdrop-blur-sm">
                loopapp.me
              </span>
            </div>

            <div className="absolute inset-x-3 bottom-3 flex items-end gap-3">
              <Avatar className="h-14 w-14 shrink-0 border-2 border-white/20 shadow-lg">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback>{(displayName || username || "?").charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold leading-tight text-white">{displayName}</p>
                <p className="truncate text-[11px] text-white/65">@{username}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] font-medium text-white/70">
                  <span>{formatCount(stats?.loops)} loops</span>
                  <span aria-hidden>·</span>
                  <span>{formatCount(stats?.followers)} followers</span>
                  <span aria-hidden>·</span>
                  <span style={{ color: accent }}>{formatCount(stats?.likes)} likes</span>
                </div>
              </div>
            </div>
          </div>

          {bio ? (
            <p className="border-t border-white/10 px-3 py-2 text-[11px] leading-relaxed text-white/65 line-clamp-2">
              {bio}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3 py-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{inviteUrl}</span>
            <button
              type="button"
              onClick={() => void copy(inviteUrl, "invite")}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-semibold text-background"
            >
              {copied === "invite" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied === "invite" ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-[104px] w-[104px] shrink-0 items-center justify-center rounded-xl border border-border/70 bg-white p-1.5">
              <QRCodeSVG value={inviteUrl} size={88} fgColor="#0b0a10" bgColor="#ffffff" level="M" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] font-semibold text-foreground">
                {themeName ? `Invite them into the ${themeName} look.` : "Send a themed invite."}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Guests land on this profile with a join banner — theme, cover and posts included — so they can see
                what Loop looks like before signing up.
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: accent }}>
                <QrCode className="h-3 w-3" />
                Scan with a phone camera
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={nativeShare} className="flex-1 rounded-full font-semibold" style={{ backgroundColor: accent, color: "#0b0a10" }}>
            <Share2 className="mr-2 h-4 w-4" /> Share invite
          </Button>
          <Button variant="outline" onClick={() => void copy(profileUrl, "profile")} className="rounded-full">
            {copied === "profile" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            Plain link
          </Button>
          <Button asChild variant="outline" className={cn("rounded-full", "hidden sm:inline-flex")}>
            <a href={profileUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

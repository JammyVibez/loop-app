"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, Copy, Link2, MessageCircle, Send, Share2, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ShareToDmModal } from "@/components/messages/share-to-dm-modal"

interface ReelShareSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reel: {
    id: string
    title?: string
    description?: string
    content_url?: string
    author?: { username?: string }
  } | null
  onShared?: () => void
}

/**
 * Share sheet with the app's DM flow first, then native share and the usual
 * social targets. Every option reports back so the share count can update.
 */
export function ReelShareSheet({ open, onOpenChange, reel, onShared }: ReelShareSheetProps) {
  const { toast } = useToast()
  const [dmOpen, setDmOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!open || !reel) return null

  const link =
    typeof window !== "undefined" ? `${window.location.origin}/reels?focus=${encodeURIComponent(reel.id)}` : ""

  // Radix renders the DM modal in a portal above page content, so the share
  // sheet drops out of the way while the picker is open.
  if (dmOpen) {
    return (
      <ShareToDmModal
        open
        onOpenChange={(next) => {
          if (!next) {
            setDmOpen(false)
            onOpenChange(false)
          }
        }}
        item={{
          id: reel.id,
          type: "reel",
          title: reel.title,
          text: reel.description,
          authorName: reel.author?.username,
          mediaUrl: reel.content_url,
          mediaType: "video",
          url: link,
        }}
      />
    )
  }

  const report = () => onShared?.()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      report()
      toast({ title: "Link copied" })
      setTimeout(() => setCopied(false), 1600)
    } catch {
      toast({ title: "Could not copy link", variant: "destructive" })
    }
  }

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) return copy()
    try {
      await navigator.share({ title: reel.title || "Loop reel", url: link })
      report()
      onOpenChange(false)
    } catch {
      /* user dismissed */
    }
  }

  const targets = [
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${reel.title || "Watch this reel on Loop"} ${link}`)}`,
    },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(link)}&text=${encodeURIComponent(reel.title || "Loop reel")}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(reel.title || "Loop reel")}` },
  ]

  return (
    <div className="fixed inset-0 z-[70]">
      <button type="button" aria-label="Close share" className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border-t border-white/10 bg-[#111111] pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-3">
          <div className="mx-auto h-1 w-10 rounded-full bg-white/20" />
          <button type="button" onClick={() => onOpenChange(false)} className="absolute right-4 rounded-full p-1.5 text-white/60 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 pb-2">
          <h2 className="text-sm font-semibold">Share to</h2>
        </div>

        <div className="grid grid-cols-4 gap-3 px-5 pb-5">
          <button
            type="button"
            onClick={() => {
              report()
              setDmOpen(true)
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
              <MessageCircle className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-white/70">Send in DM</span>
          </button>

          <button type="button" onClick={() => void copy()} className="flex flex-col items-center gap-1.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              {copied ? <Check className="h-5 w-5 text-emerald-400" /> : <Copy className="h-5 w-5" />}
            </span>
            <span className="text-[10px] text-white/70">Copy link</span>
          </button>

          <button type="button" onClick={() => void nativeShare()} className="flex flex-col items-center gap-1.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Share2 className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-white/70">More</span>
          </button>

          <a
            href={`${link}`}
            onClick={report}
            className="flex flex-col items-center gap-1.5"
            aria-label="Open reel link"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
              <Link2 className="h-5 w-5" />
            </span>
            <span className="text-[10px] text-white/70">Open</span>
          </a>

          {targets.map((target) => (
            <a
              key={target.label}
              href={target.href}
              target="_blank"
              rel="noreferrer"
              onClick={report}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                <Send className="h-5 w-5" />
              </span>
              <span className="text-[10px] text-white/70">{target.label}</span>
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

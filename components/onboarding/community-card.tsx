"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, Crown, Loader2, Lock, Users } from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

/**
 * Onboarding "Communities" card.
 *
 * The old version was a flat grey box — name, member count, join button — even
 * though every circle in the database carries a banner/cover image, an accent
 * colour and a category. This card leads with that identity:
 *   • a cover strip (real image when the circle has one, otherwise a
 *     deterministic gradient generated from the circle id so every card looks
 *     distinct without any data change),
 *   • the avatar overlapping the cover with a ring,
 *   • category + member chips, a joined state with a glowing check badge,
 *   • staggered entrance motion and a lift on hover.
 */

export interface CommunityCardData {
  id: string
  name: string
  description?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  cover_url?: string | null
  accent_color?: string | null
  category?: string | null
  member_count?: number
  is_private?: boolean
  is_premium?: boolean
}

interface CommunityCardProps {
  community: CommunityCardData
  /** Position in the grid — drives the staggered entrance delay. */
  index?: number
  joined: boolean
  pending: boolean
  onJoin: () => void
}

/** Tasteful gradient pairs (start → end) used when a circle has no imagery. */
const GRADIENTS: Array<[string, string]> = [
  ["#6366f1", "#a855f7"], // indigo → purple
  ["#06b6d4", "#3b82f6"], // cyan → blue
  ["#f59e0b", "#f43f5e"], // amber → rose
  ["#10b981", "#14b8a6"], // emerald → teal
  ["#8b5cf6", "#ec4899"], // violet → pink
  ["#f43f5e", "#fb923c"], // rose → orange
]

function gradientFor(id: string): [string, string] {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return GRADIENTS[Math.abs(hash) % GRADIENTS.length]
}

function categoryLabel(category?: string | null) {
  if (!category) return null
  const cleaned = category.trim()
  if (!cleaned || cleaned === "custom") return null
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

export function CommunityCard({ community, index = 0, joined, pending, onJoin }: CommunityCardProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [start, end] = gradientFor(community.id)

  const coverUrl = community.banner_url || community.cover_url || community.avatar_url || null
  const showImage = Boolean(coverUrl) && !imageFailed && /^https?:\/\//i.test(coverUrl as string)
  const accent = community.accent_color || start
  const label = categoryLabel(community.category)

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.06, 0.4), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
        joined ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:border-primary/30",
      )}
    >
      {/* Cover */}
      <div className="relative h-20 w-full overflow-hidden">
        {showImage ? (
          <img
            src={coverUrl as string}
            alt=""
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full scale-[1.35] object-cover transition-transform duration-500 group-hover:scale-[1.45]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(120deg, ${start} 0%, ${end} 100%)`,
            }}
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 22% 20%, rgba(255,255,255,0.35) 0, transparent 42%), radial-gradient(circle at 82% 80%, rgba(255,255,255,0.22) 0, transparent 40%)",
              }}
            />
          </div>
        )}
        {/* Scrim so the cover blends into the card body */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/25 to-transparent" />

        {joined && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40"
            aria-label="Joined"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </motion.span>
        )}
      </div>

      {/* Body */}
      <div className="relative -mt-7 flex flex-col gap-2.5 p-3.5">
        <div className="flex items-end gap-2.5">
          <div className="rounded-xl bg-card p-0.5 shadow-md shadow-foreground/10">
            <Avatar className="h-11 w-11 rounded-[10px] border border-border">
              <AvatarImage src={community.avatar_url || undefined} alt={community.name} />
              <AvatarFallback
                className="rounded-[10px] text-sm font-black text-white"
                style={{ background: `linear-gradient(135deg, ${start}, ${end})` }}
              >
                {community.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="min-w-0 flex-1 pb-0.5">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold leading-tight tracking-tight">{community.name}</p>
              {community.is_private && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {label && (
                <span
                  className="rounded-full px-1.5 py-px text-[10px] font-bold uppercase tracking-wide"
                  style={{ backgroundColor: `${accent}1f`, color: accent }}
                >
                  {label}
                </span>
              )}
              <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Users className="h-3 w-3" />
                {(community.member_count || 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {community.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{community.description}</p>
        )}

        <Button
          size="sm"
          variant={joined || pending ? "outline" : "default"}
          disabled={joined || pending}
          onClick={onJoin}
          aria-pressed={joined}
          className={cn(
            "mt-auto w-full gap-1.5 rounded-xl font-semibold transition-all",
            joined && "border-primary/40 bg-primary/10 text-primary",
            pending && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
            !joined && !pending && "shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30",
          )}
        >
          {joined ? (
            <>
              <Check className="h-3.5 w-3.5" /> Joined
            </>
          ) : pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5" /> Requested
            </>
          ) : community.is_premium ? (
            <>
              <Crown className="h-3.5 w-3.5" /> Join Pro space
            </>
          ) : (
            <>Join</>
          )}
        </Button>
      </div>
    </motion.div>
  )
}

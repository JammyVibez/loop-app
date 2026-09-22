"use client"

import { useState, useRef, useEffect, useCallback, memo } from "react"
import { useRouter } from "next/navigation"
import { Heart } from "lucide-react"
import { Card, CardContent } from "./ui/card"
import { AnimatedCardFrame } from "@/components/cosmetics/animated-card-frame"
import { cardEffectStyle } from "@/lib/cosmetics"
import { ensureCosmeticFonts } from "@/lib/cosmetic-fonts"
import { useTheme3D } from "../providers/theme-3d-provider"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/components/ui/use-toast"
import { normalizeLoop } from "@/lib/normalize-loop"
import { supabase } from "@/lib/supabase"
import { hapticPress, hapticSuccess } from "@/lib/haptics"
import { useLoginGate } from "@/hooks/use-login-gate"

// Sub-components
import { LoopCardHeader } from "./loop-card/loop-card-header"
import { LoopCardMedia } from "./loop-card/loop-card-media"
import { LoopCardContent } from "./loop-card/loop-card-content"
import { LoopCardActions } from "./loop-card/loop-card-actions"
import { LoopCardBoostBar } from "./loop-card/loop-card-boost-bar"
import { LoopCardModals } from "./loop-card/loop-card-modals"

interface LoopCardProps {
  loop: any
  interacting?: string | null
  onInteraction?: (loopId: string, type: "like" | "save") => void
  onDeleted?: (loopId: string) => void
  onEdited?: (loop: any) => void
  onLike?: () => void
  onBookmark?: () => void
  isChild?: boolean
  className?: string
}

export const LoopCard = memo(function LoopCard({
  loop: rawLoop,
  interacting = null,
  onInteraction,
  onDeleted,
  onEdited,
  className = "",
}: LoopCardProps) {
  const normalized = normalizeLoop(rawLoop)
  const [loop, setLoop] = useState(normalized)
  const [showGiftModal, setShowGiftModal] = useState(false)
  const [showBranchDialog, setShowBranchDialog] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const { currentTheme } = useTheme3D()
  const router = useRouter()
  const [isAnimating, setIsAnimating] = useState(false)
  const [doubleTapHeart, setDoubleTapHeart] = useState(false)
  const [localInteracting, setLocalInteracting] = useState<string | null>(null)
  const [forking, setForking] = useState(false)
  const [chainDialogOpen, setChainDialogOpen] = useState(false)
  const [branchSettingsOpen, setBranchSettingsOpen] = useState(false)
  const [togglingLinkPreview, setTogglingLinkPreview] = useState(false)
  const [boostDialogOpen, setBoostDialogOpen] = useState(false)
  const [shareDmOpen, setShareDmOpen] = useState(false)
  const [shareCircleOpen, setShareCircleOpen] = useState(false)
  const [shareImageOpen, setShareImageOpen] = useState(false)
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [boostCoinsCurrent, setBoostCoinsCurrent] = useState<number>(
    rawLoop?.boost_coins_current || 0
  )
  const [isBoosted, setIsBoosted] = useState<boolean>(rawLoop?.is_boosted || false)
  const cardRef = useRef<HTMLDivElement>(null)
  const viewedRef = useRef(false)
  const lastTapRef = useRef(0)
  const { user: currentUser, getAuthHeader } = useAuth()
  const { toast } = useToast()
  const { requireAuth, LoginGateDialog } = useLoginGate()
  const activeInteracting = interacting ?? localInteracting

  useEffect(() => {
    setLoop(normalizeLoop(rawLoop))
    viewedRef.current = false
    if (typeof rawLoop?.boost_coins_current === "number") {
      setBoostCoinsCurrent(rawLoop.boost_coins_current)
    }
  }, [
    rawLoop?.id,
    rawLoop?.content,
    rawLoop?.content_text,
    rawLoop?.user_interactions?.is_liked,
    rawLoop?.user_interactions?.is_saved,
    rawLoop?.stats?.likes_count,
    rawLoop?.likes,
    rawLoop?.boost_coins_current,
  ])

  // Realtime subscription for crowd-funded boost progress bar updates
  useEffect(() => {
    if (!loop?.id) return
    const channel = supabase
      .channel(`loop-boost-${loop.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loops",
          filter: `id=eq.${loop.id}`,
        },
        (payload) => {
          if (typeof payload.new?.boost_coins_current === "number") {
            setBoostCoinsCurrent(payload.new.boost_coins_current)
          }
          if (typeof payload.new?.is_boosted === "boolean") {
            setIsBoosted(payload.new.is_boosted)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loop?.id])

  // View tracking via IntersectionObserver
  useEffect(() => {
    if (!currentUser || !cardRef.current || viewedRef.current) return
    const el = cardRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.55 || viewedRef.current)
          return
        viewedRef.current = true
        void fetch(`/api/loops/${loop.id}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ interaction_type: "view" }),
        })
          .then(async (res) => {
            if (!res.ok) return
            const data = await res.json().catch(() => ({}))
            if (typeof data.stats?.views_count === "number") {
              setLoop((prev) => ({
                ...prev,
                stats: { ...prev.stats, views_count: data.stats.views_count },
              }))
            }
          })
          .catch(() => {})
        observer.disconnect()
      },
      { threshold: [0.55] }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.id, currentUser?.id])

  const content = typeof loop.content === "string" ? loop.content : ""
  const hashtags = Array.isArray(loop.hashtags) ? loop.hashtags : []
  const contentPreview = content.length > 200 ? content.substring(0, 200) + "..." : content

  useEffect(() => {
    ensureCosmeticFonts((loop.author?.cosmetics || loop.author?.active_cosmetics)?.font)
  }, [loop.author?.cosmetics, loop.author?.active_cosmetics])

  // ── Interaction handlers ──

  const runInteraction = async (type: "like" | "save") => {
    if (type === "save") hapticSuccess()
    if (onInteraction) {
      if (!currentUser && !requireAuth(type === "like" ? "like" : "save")) return
      onInteraction(loop.id, type)
      return
    }

    if (!requireAuth(type === "like" ? "like" : "save")) return

    const snapshot = {
      is_liked: Boolean(loop.user_interactions.is_liked),
      is_saved: Boolean(loop.user_interactions.is_saved),
      likes_count: Number(loop.stats.likes_count || 0),
    }

    setLoop((prev) => {
      const next = {
        ...prev,
        user_interactions: { ...prev.user_interactions },
        stats: { ...prev.stats },
      }
      if (type === "like") {
        const liked = !snapshot.is_liked
        next.user_interactions.is_liked = liked
        next.stats.likes_count = Math.max(0, snapshot.likes_count + (liked ? 1 : -1))
      } else {
        next.user_interactions.is_saved = !snapshot.is_saved
      }
      return next
    })

    setLocalInteracting(`${loop.id}-${type}`)
    try {
      const response = await fetch(`/api/loops/${loop.id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ interaction_type: type }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || data.success === false) {
        throw new Error(data.error || "Interaction failed")
      }

      setLoop((prev) => {
        const next = {
          ...prev,
          user_interactions: { ...prev.user_interactions },
          stats: { ...prev.stats },
        }
        if (type === "like") {
          const liked = Boolean(data.is_liked ?? data.is_active)
          next.user_interactions.is_liked = liked
          next.stats.likes_count = Number(
            data.stats?.likes_count ?? Math.max(0, prev.stats.likes_count)
          )
        }
        if (type === "save") {
          const saved = Boolean(data.is_saved ?? data.is_active)
          next.user_interactions.is_saved = saved
          toast({
            title: saved ? "Saved to Bookmarks" : "Removed from Bookmarks",
            description: saved ? "Find it anytime in Bookmarks." : undefined,
          })
        }
        return next
      })
    } catch (error: any) {
      setLoop((prev) => ({
        ...prev,
        user_interactions: {
          ...prev.user_interactions,
          is_liked: snapshot.is_liked,
          is_saved: snapshot.is_saved,
        },
        stats: { ...prev.stats, likes_count: snapshot.likes_count },
      }))
      toast({
        title: "Could not update",
        description: error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setLocalInteracting(null)
    }
  }

  const handleLike = (opts?: { fromDoubleTap?: boolean }) => {
    hapticPress()
    if (opts?.fromDoubleTap && loop.user_interactions.is_liked) {
      setDoubleTapHeart(true)
      setTimeout(() => setDoubleTapHeart(false), 700)
      return
    }
    void runInteraction("like")
    if (!loop.user_interactions.is_liked || opts?.fromDoubleTap) {
      setIsAnimating(true)
      setDoubleTapHeart(true)
      setTimeout(() => {
        setIsAnimating(false)
        setDoubleTapHeart(false)
      }, 700)
    }
  }

  const handleBranch = () => {
    if (!requireAuth("branch")) return
    setShowBranchDialog(true)
  }

  const handleFork = async () => {
    if (!requireAuth("branch")) return
    if (currentUser!.id === loop.author_id) {
      toast({
        title: "That's your loop",
        description: "Fork someone else's code to remix it.",
      })
      return
    }
    setForking(true)
    try {
      const res = await fetch(`/api/loops/${loop.id}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Fork failed")
      setLoop((prev: any) => ({
        ...prev,
        content_metadata: {
          ...(prev.content_metadata || {}),
          forks_count:
            data.forks_count ?? Number(prev.content_metadata?.forks_count || 0) + 1,
        },
      }))
      toast({
        title: "Forked!",
        description: "A copy is now on your profile. Like, comment, or branch it next.",
      })
    } catch (error: any) {
      toast({ title: "Couldn't fork", description: error.message, variant: "destructive" })
    } finally {
      setForking(false)
    }
  }

  const handleEdit = () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return
    setEditContent(content)
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return
    if (!editContent.trim() || editContent.trim() === content.trim()) {
      setEditOpen(false)
      return
    }
    setSavingEdit(true)
    const response = await fetch(`/api/loops/${loop.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.access_token || currentUser.token}`,
      },
      body: JSON.stringify({ content: editContent }),
    })
    const data = await response.json().catch(() => ({}))
    setSavingEdit(false)

    if (!response.ok) {
      toast({
        title: "Could not update loop",
        description: data.error || "Please try again.",
        variant: "destructive",
      })
      return
    }

    onEdited?.(data.loop)
    setEditOpen(false)
    toast({ title: "Loop updated" })
  }

  const handleDelete = () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return
    setDeleteOpen(true)
  }

  const [togglingPin, setTogglingPin] = useState(false)
  const handleTogglePin = async () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id || togglingPin) return
    setTogglingPin(true)
    const nextPinned = !loop.is_pinned
    try {
      const response = await fetch(`/api/loops/${loop.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.access_token || currentUser.token}`,
        },
        body: JSON.stringify({ is_pinned: nextPinned }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not update pin")
      onEdited?.(data.loop)
      toast({
        title: nextPinned ? "Pinned to profile" : "Unpinned from profile",
        description: nextPinned ? "Shows at the top of your profile." : undefined,
      })
    } catch (error: any) {
      toast({
        title: "Couldn't update pin",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setTogglingPin(false)
    }
  }

  // Author-controlled link previews: the flag lives on the post, so turning
  // it on/off changes what every viewer sees.
  const handleToggleLinkPreview = async () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id || togglingLinkPreview) return
    setTogglingLinkPreview(true)
    const next = !loop.link_preview_disabled
    try {
      const response = await fetch(`/api/loops/${loop.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.access_token || currentUser.token}`,
        },
        body: JSON.stringify({ link_preview_disabled: next }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not update link preview")
      setLoop((prev) => ({
        ...prev,
        link_preview_disabled: Boolean(data.loop?.link_preview_disabled ?? next),
      }))
      onEdited?.(data.loop)
      toast({
        title: next ? "Link preview hidden" : "Link preview shown",
        description: next
          ? "Nobody sees the embedded link card until you show it again."
          : "Viewers can see the embedded link card again.",
      })
    } catch (error: any) {
      toast({
        title: "Couldn't update link preview",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setTogglingLinkPreview(false)
    }
  }

  const handleBranchSettingsSaved = (updated: any) => {
    if (!updated) return
    setLoop((prev) => ({
      ...prev,
      max_branch_depth: updated.max_branch_depth ?? null,
      max_branches_per_user: updated.max_branches_per_user ?? null,
    }))
    onEdited?.(updated)
  }

  const confirmDelete = async () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return

    const response = await fetch(`/api/loops/${loop.id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${currentUser.access_token || currentUser.token}`,
      },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast({
        title: "Could not delete loop",
        description: data.error || "Please try again.",
        variant: "destructive",
      })
      return
    }

    setDeleteOpen(false)
    onDeleted?.(loop.id)
    toast({ title: "Loop deleted" })
  }

  // ── Derived state ──

  const isCoLoop = Boolean(
    loop.is_co_loop || (loop.co_authors && loop.co_authors.length > 0)
  )
  const coAuthors = loop.co_authors || []

  const getCardStyle = () => {
    // Borderless, X-style row. Posts sit directly on the page background with
    // no card chrome or drop shadow, separated only by the feed's hairline
    // divider. Premium card effects still render through AnimatedCardFrame,
    // and callers can layer their own container styles via `className`
    // (e.g. the profile passes `rounded-none border-0 shadow-none`).
    const baseStyle =
      "relative overflow-hidden rounded-none border-0 bg-transparent text-card-foreground shadow-none transition-colors duration-200"
    const themeStyle = currentTheme?.effects?.glow
      ? `shadow-lg shadow-[var(--theme-primary)]/20`
      : ""
    // Subtle row highlight instead of a lift + shadow — X's press/hover wash.
    const hoverStyle = isHovered ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.03]"
    const featuredStyle = loop.is_featured
      ? "border-l-2 border-l-yellow-400/70 bg-gradient-to-r from-yellow-500/[0.06] to-transparent"
      : ""
    const coLoopStyle = isCoLoop
      ? "border-l-2 border-l-cyan-400/60 bg-gradient-to-r from-cyan-500/[0.06] to-transparent"
      : ""

    return `${baseStyle} ${className} ${themeStyle} ${hoverStyle} ${featuredStyle} ${coLoopStyle}`
  }

  /**
   * Feed avatars carry no decorative ring. A cosmetic frame the author
   * actually equipped still renders (AvatarWithFrame handles that from
   * `equipped_frame_id`), but Pro status and the active theme no longer add a
   * ring to every post — that belongs on the profile and the shop showcase.
   */
  const getAvatarStyle = () => ""

  return (
    <>
      {LoginGateDialog}
      <AnimatedCardFrame
        effect={(loop.author.cosmetics || loop.author.active_cosmetics)?.cardEffect}
        rounded="rounded-2xl"
        className="h-full"
      >
        <Card
          ref={cardRef}
          className={getCardStyle()}
          style={cardEffectStyle(
            (loop.author.cosmetics || loop.author.active_cosmetics)?.cardEffect
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Featured badge */}
          {Boolean(loop.is_featured) && (
            <div className="absolute top-2 right-2 z-10">
              <div className="inline-flex items-center gap-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                &#9733; Featured
              </div>
            </div>
          )}

          {/* Theme particles */}
          {currentTheme?.effects?.particles && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 left-4 w-1 h-1 bg-[var(--theme-primary)] rounded-full animate-pulse opacity-60"></div>
              <div className="absolute top-8 right-8 w-1 h-1 bg-[var(--theme-secondary)] rounded-full animate-pulse opacity-40 animation-delay-1000"></div>
              <div className="absolute bottom-6 left-6 w-1 h-1 bg-[var(--theme-primary)] rounded-full animate-pulse opacity-50 animation-delay-2000"></div>
            </div>
          )}

          {/* ── Header ── */}
          <LoopCardHeader
            loop={loop}
            isCoLoop={isCoLoop}
            coAuthors={coAuthors}
            isHovered={isHovered}
            boostCoinsCurrent={boostCoinsCurrent}
            isBoosted={isBoosted}
            togglingPin={togglingPin}
            onTogglePin={handleTogglePin}
            onToggleLinkPreview={handleToggleLinkPreview}
            togglingLinkPreview={togglingLinkPreview}
            onOpenBranchSettings={() => setBranchSettingsOpen(true)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onGift={() => setShowGiftModal(true)}
            onSetRosterOpen={setRosterOpen}
            getAvatarStyle={getAvatarStyle}
          />

          {/* ── Content + Media + Actions ── */}
          <CardContent className="px-3.5 pb-2 pt-0 sm:px-5">
            <LoopCardContent
              loop={loop}
              rawLoop={rawLoop}
              content={content}
              contentPreview={contentPreview}
              hashtags={hashtags}
              onLike={handleLike}
              onFork={handleFork}
              forking={forking}
            />

            <LoopCardMedia
              mediaType={loop.media_type}
              mediaUrl={loop.media_url}
              mediaUrls={loop.media_urls}
              doubleTapHeart={doubleTapHeart}
              onDoubleTapLike={() => handleLike({ fromDoubleTap: true })}
              onOpenViewer={() => setViewerOpen(true)}
              isSpoiler={Boolean(loop.is_spoiler)}
            />

            {/* Gift indicators */}
            {Number(loop.gifts_received) > 0 && (
              <div className="flex items-center space-x-2 mt-2">
                <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full">
                  <span className="text-purple-600">&#127873;</span>
                  <span className="text-xs font-medium text-purple-600">
                    {loop.gifts_received}
                  </span>
                </div>
                {Number(loop.total_gift_value) > 0 && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                    <span className="text-amber-600 dark:text-amber-400">&#127873;</span>
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      {loop.total_gift_value}
                    </span>
                  </div>
                )}
              </div>
            )}

            <LoopCardBoostBar
              boostCoinsCurrent={boostCoinsCurrent}
              boostCoinsTarget={rawLoop?.boost_coins_target || 1000}
              isBoosted={isBoosted}
              onClick={() => setBoostDialogOpen(true)}
            />

            <LoopCardActions
              loop={loop}
              rawLoop={rawLoop}
              isLiked={loop.user_interactions.is_liked}
              isSaved={loop.user_interactions.is_saved}
              likesCount={loop.stats.likes_count}
              commentsCount={loop.stats.comments_count}
              branchesCount={loop.stats.branches_count}
              sharesCount={loop.stats.shares_count}
              activeInteracting={activeInteracting}
              isAnimating={isAnimating}
              isBoosted={isBoosted}
              boostCoinsCurrent={boostCoinsCurrent}
              forking={forking}
              onLike={() => handleLike()}
              onBookmark={() => void runInteraction("save")}
              onBranch={handleBranch}
              onFork={handleFork}
              onBoost={() => setBoostDialogOpen(true)}
              onGift={() => setShowGiftModal(true)}
              onShareDmOpen={() => setShareDmOpen(true)}
              onShareCircleOpen={() => setShareCircleOpen(true)}
              onShareSheetOpen={() => setShareSheetOpen(true)}
              onShareImageOpen={() => setShareImageOpen(true)}
            />
          </CardContent>
        </Card>
      </AnimatedCardFrame>

      {/* ── All Modals ── */}
      <LoopCardModals
        loop={loop}
        rawLoop={rawLoop}
        content={content}
        showGiftModal={showGiftModal}
        setShowGiftModal={setShowGiftModal}
        showBranchDialog={showBranchDialog}
        setShowBranchDialog={setShowBranchDialog}
        deleteOpen={deleteOpen}
        setDeleteOpen={setDeleteOpen}
        confirmDelete={confirmDelete}
        editOpen={editOpen}
        setEditOpen={setEditOpen}
        editContent={editContent}
        setEditContent={setEditContent}
        savingEdit={savingEdit}
        saveEdit={saveEdit}
        viewerOpen={viewerOpen}
        setViewerOpen={setViewerOpen}
        currentMediaIndex={currentMediaIndex}
        setCurrentMediaIndex={setCurrentMediaIndex}
        rosterOpen={rosterOpen}
        setRosterOpen={setRosterOpen}
        coAuthors={coAuthors}
        chainDialogOpen={chainDialogOpen}
        setChainDialogOpen={setChainDialogOpen}
        branchSettingsOpen={branchSettingsOpen}
        setBranchSettingsOpen={setBranchSettingsOpen}
        onBranchSettingsSaved={handleBranchSettingsSaved}
        boostDialogOpen={boostDialogOpen}
        setBoostDialogOpen={setBoostDialogOpen}
        boostCoinsCurrent={boostCoinsCurrent}
        setBoostCoinsCurrent={setBoostCoinsCurrent}
        setIsBoosted={setIsBoosted}
        shareDmOpen={shareDmOpen}
        setShareDmOpen={setShareDmOpen}
        shareCircleOpen={shareCircleOpen}
        setShareCircleOpen={setShareCircleOpen}
        shareImageOpen={shareImageOpen}
        setShareImageOpen={setShareImageOpen}
        shareSheetOpen={shareSheetOpen}
        setShareSheetOpen={setShareSheetOpen}
      />
    </>
  )
})

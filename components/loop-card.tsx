"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  MoreHorizontal,
  GitBranch,
  GitFork,
  Volume2,
  Gift,
  Crown,
  Star,
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Edit,
  Trash2,
  Users,
  Sparkles,
  Rocket,
  Coins,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Badge } from "./ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { CosmeticAvatar } from "@/components/profile/cosmetic-avatar";
import type { ActiveCosmetics } from "@/lib/cosmetics";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { GiftModal } from "./gifting/gift-modal";
import { useTheme3D } from "../providers/theme-3d-provider";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/use-toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ReportContentButton } from "@/components/moderation/report-content-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CreateBranchDialog } from "@/components/create-branch-dialog";
import { normalizeLoop } from "@/lib/normalize-loop";
import { supabase } from "@/lib/supabase";
import { CodeBlock } from "@/components/loops/code-block";
import { isCodeLoop } from "@/lib/pro-features";
import { RichContent } from "@/components/content/rich-content";
import { useLoginGate } from "@/hooks/use-login-gate";
import { UserBadges } from "@/components/user-badge";
import { FreshnessTimestamp } from "@/components/ui/freshness-timestamp";
import { LoopChainDialog } from "@/components/loops/loop-chain-dialog";
import { BoostLoopDialog } from "@/components/loops/boost-loop-dialog";
import { PollCardWidget } from "@/components/polls/poll-card-widget";
import { LoopDuelCard } from "@/components/duels/loop-duel-card";

interface LoopAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_verified?: boolean;
  is_team_member?: boolean;
  is_sponsor?: boolean;
  is_premium?: boolean;
  level?: number;
  cosmetics?: ActiveCosmetics | null;
  active_cosmetics?: ActiveCosmetics | null;
}

interface LoopStats {
  likes_count: number;
  comments_count: number;
  branches_count: number;
  shares_count: number;
  views_count: number;
}

interface Loop {
  id: string;
  author_id: string;
  content: string;
  media_type: string;
  media_url?: string;
  media_urls?: string[];
  hashtags?: string[];
  created_at: string;
  author: LoopAuthor;
  stats: LoopStats;
  user_interactions: {
    is_liked: boolean;
    is_saved: boolean;
  };
  is_featured?: boolean;
  engagement_score?: number;
  gifts_received?: number;
  total_gift_value?: number;
  parent_loop_id?: string | null;
  content_metadata?: Record<string, any> | null;
  content_title?: string | null;
  content_type?: string;
  category?: string;
}

interface LoopCardProps {
  loop: any;
  interacting?: string | null;
  onInteraction?: (loopId: string, type: "like" | "save") => void;
  onDeleted?: (loopId: string) => void;
  onEdited?: (loop: any) => void;
  onLike?: () => void;
  onBookmark?: () => void;
  isChild?: boolean;
  className?: string;
}

export function LoopCard({
  loop: rawLoop,
  interacting = null,
  onInteraction,
  onDeleted,
  onEdited,
  className = "",
}: LoopCardProps) {
  const normalized = normalizeLoop(rawLoop)
  const [loop, setLoop] = useState(normalized)
  const [showFullContent, setShowFullContent] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { currentTheme } = useTheme3D();
  const [isAnimating, setIsAnimating] = useState(false);
  const [doubleTapHeart, setDoubleTapHeart] = useState(false);
  const [localInteracting, setLocalInteracting] = useState<string | null>(null);
  const [forking, setForking] = useState(false);
  const [chainDialogOpen, setChainDialogOpen] = useState(false);
  const [boostDialogOpen, setBoostDialogOpen] = useState(false);
  const [boostCoinsCurrent, setBoostCoinsCurrent] = useState<number>(rawLoop?.boost_coins_current || 0);
  const [isBoosted, setIsBoosted] = useState<boolean>(rawLoop?.is_boosted || false);
  const cardRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false);
  const lastTapRef = useRef(0);
  const { user: currentUser, getAuthHeader } = useAuth();
  const { toast } = useToast();
  const { requireAuth, LoginGateDialog } = useLoginGate();
  const activeInteracting = interacting ?? localInteracting;

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

  // Instagram/X: count a view when the card is meaningfully on screen
  useEffect(() => {
    if (!currentUser || !cardRef.current || viewedRef.current) return
    const el = cardRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.55 || viewedRef.current) return
        viewedRef.current = true
        void fetch(`/api/loops/${loop.id}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ interaction_type: "view" }),
        }).then(async (res) => {
          if (!res.ok) return
          const data = await res.json().catch(() => ({}))
          if (typeof data.stats?.views_count === "number") {
            setLoop((prev) => ({
              ...prev,
              stats: { ...prev.stats, views_count: data.stats.views_count },
            }))
          }
        }).catch(() => {})
        observer.disconnect()
      },
      { threshold: [0.55] },
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.id, currentUser?.id])

  // Defensive fallback for content and hashtags
  const content = typeof loop.content === "string" ? loop.content : "";
  const hashtags = Array.isArray(loop.hashtags) ? loop.hashtags : [];

  const contentPreview =
    content.length > 200 ? content.substring(0, 200) + "..." : content;

  const runInteraction = async (type: "like" | "save") => {
    if (onInteraction) {
      if (!currentUser && !requireAuth(type === "like" ? "like" : "save")) return
      onInteraction(loop.id, type)
      return
    }

    if (!requireAuth(type === "like" ? "like" : "save")) return

    setLocalInteracting(`${loop.id}-${type}`)
    try {
      const response = await fetch(`/api/loops/${loop.id}/interactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
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
          next.stats.likes_count = Number(data.stats?.likes_count ?? Math.max(0, prev.stats.likes_count + (liked ? 1 : -1)))
        }
        if (type === "save") {
          next.user_interactions.is_saved = Boolean(data.is_saved ?? data.is_active)
        }
        return next
      })
    } catch (error: any) {
      toast({
        title: "Could not update",
        description: error?.message || "Try again",
        variant: "destructive",
      })
    } finally {
      setLocalInteracting(null)
    }
  }

  // Share: native share when available + analytics
  const handleShare = async () => {
    const url = `${window.location.origin}/loop/${loop.id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: `@${loop.author?.username || "loop"} on Loop`,
          text: content.slice(0, 120) || "Check out this loop",
          url,
        })
      } else {
        await navigator.clipboard.writeText(url)
        toast({
          title: "Link copied",
          description: "Loop link is on your clipboard.",
        })
      }
    } catch (error: any) {
      if (error?.name === "AbortError") return
      await navigator.clipboard.writeText(url).catch(() => {})
      toast({ title: "Link copied" })
    }

    if (currentUser) {
      try {
        const res = await fetch(`/api/loops/${loop.id}/interactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
          body: JSON.stringify({ interaction_type: "share" }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && typeof data.stats?.shares_count === "number") {
          setLoop((prev) => ({
            ...prev,
            stats: { ...prev.stats, shares_count: data.stats.shares_count },
          }))
        }
      } catch {
        /* non-blocking */
      }
    }
  }

  // Enhanced like animation with gift effects
  const handleLike = (opts?: { fromDoubleTap?: boolean }) => {
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

  const handleMediaDoubleTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current < 320) {
      handleLike({ fromDoubleTap: true })
      lastTapRef.current = 0
      return
    }
    lastTapRef.current = now
  }

  // Handle branch creation
  const handleBranch = () => {
    if (!requireAuth("branch")) return
    setShowBranchDialog(true);
  };

  const handleFork = async () => {
    if (!requireAuth("branch")) return
    if (currentUser!.id === loop.author_id) {
      toast({ title: "That's your loop", description: "Fork someone else's code to remix it." })
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
          forks_count: data.forks_count ?? Number(prev.content_metadata?.forks_count || 0) + 1,
        },
      }))
      toast({
        title: "Forked!",
        description: "A copy is now on your profile. Like, comment, or branch it next.",
      })
    } catch (error: any) {
      toast({ title: "Couldn’t fork", description: error.message, variant: "destructive" })
    } finally {
      setForking(false)
    }
  }

  const handleEdit = () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return;
    setEditContent(content);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return;
    if (!editContent.trim() || editContent.trim() === content.trim()) {
      setEditOpen(false);
      return;
    }
    setSavingEdit(true);
    const response = await fetch(`/api/loops/${loop.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${currentUser.access_token || currentUser.token}`,
      },
      body: JSON.stringify({ content: editContent }),
    });
    const data = await response.json().catch(() => ({}));
    setSavingEdit(false);

    if (!response.ok) {
      toast({
        title: "Could not update loop",
        description: data.error || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    onEdited?.(data.loop);
    setEditOpen(false);
    toast({ title: "Loop updated" });
  };

  const handleDelete = () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return;
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!currentUser?.token || currentUser.id !== loop.author_id) return;

    const response = await fetch(`/api/loops/${loop.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${currentUser.access_token || currentUser.token}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast({
        title: "Could not delete loop",
        description: data.error || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    setDeleteOpen(false);
    onDeleted?.(loop.id);
    toast({ title: "Loop deleted" });
  };

  const isCoLoop = Boolean(loop.is_co_loop || (loop.co_authors && loop.co_authors.length > 0))
  const coAuthors = loop.co_authors || []

  const getCardStyle = () => {
    const baseStyle =
      "relative overflow-hidden transition-all duration-300 transform-gpu";
    const themeStyle = currentTheme?.effects?.glow
      ? `shadow-lg shadow-[var(--theme-primary)]/20`
      : "";
    const hoverStyle = isHovered
      ? "scale-[1.02] shadow-2xl"
      : "hover:shadow-lg";
    const featuredStyle = loop.is_featured
      ? "ring-2 ring-yellow-400/50 bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/10 dark:to-orange-900/10"
      : "";
    const coLoopStyle = isCoLoop
      ? "border-cyan-500/40 bg-gradient-to-br from-cyan-950/10 via-card to-purple-950/10 dark:from-cyan-950/30 dark:to-purple-950/20 shadow-cyan-500/5 shadow-lg border"
      : "";

    return `${baseStyle} ${themeStyle} ${hoverStyle} ${featuredStyle} ${coLoopStyle}`;
  };

  const getAvatarStyle = () => {
    if (loop.author.is_premium) {
      return "ring-2 ring-gradient-to-r from-purple-400 to-pink-400 ring-offset-2";
    }
    if (currentTheme?.effects?.glow) {
      return "ring-2 ring-[var(--theme-primary)]/30 ring-offset-2";
    }
    return "";
  };

  const renderMedia = () => {
    const mediaUrls =
      loop.media_urls || (loop.media_url ? [loop.media_url] : []);
    if (mediaUrls.length === 0) return null;

    const mediaContainerStyle = currentTheme?.effects?.glow
      ? "shadow-lg shadow-[var(--theme-primary)]/10"
      : "";

    if (mediaUrls.length === 1) {
      const mediaUrl = mediaUrls[0];
      switch (loop.media_type) {
        case "image":
          return (
            <div
              className={`mt-3 rounded-lg overflow-hidden ${mediaContainerStyle}`}
            >
              <img
                src={mediaUrl || "/placeholder.svg"}
                alt="Loop media"
                onClick={() => setViewerOpen(true)}
                className="w-full h-auto max-h-96 cursor-zoom-in object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
          );
        case "video":
          return (
            <div
              className={`mt-3 rounded-lg overflow-hidden bg-black relative ${mediaContainerStyle}`}
              onClick={() => setViewerOpen(true)}
            >
              <video
                controls
                className="w-full h-auto max-h-96"
                poster="/placeholder.svg?height=300&width=500"
              >
                <source src={mediaUrl} type="video/mp4" />
              </video>
            </div>
          );
        case "audio":
          return (
            <div
              className={`mt-3 p-4 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg ${mediaContainerStyle}`}
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-600 rounded-full">
                  <Volume2 className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Audio Loop</p>
                  <audio controls className="w-full mt-2" src={mediaUrl} preload="metadata">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              </div>
            </div>
          );
        default:
          return null;
      }
    }

    return (
      <div
        className={`mt-3 rounded-lg overflow-hidden relative ${mediaContainerStyle}`}
      >
        <div className="absolute top-2 right-2 z-10">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        </div>

        <div
          className="relative cursor-zoom-in"
          onClick={() => setViewerOpen(true)}
          onDoubleClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleLike({ fromDoubleTap: true })
          }}
          onTouchEnd={(e) => {
            // Mobile double-tap like without opening viewer immediately
            const now = Date.now()
            if (now - lastTapRef.current < 320) {
              e.preventDefault()
              e.stopPropagation()
              handleLike({ fromDoubleTap: true })
              lastTapRef.current = 0
              return
            }
            lastTapRef.current = now
          }}
        >
          {doubleTapHeart && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <Heart className="h-20 w-20 fill-white text-white drop-shadow-xl animate-in zoom-in-50 fade-in duration-300" />
            </div>
          )}
          {loop.media_type === "image" ? (
            <img
              src={mediaUrls[currentMediaIndex] || "/placeholder.svg"}
              alt={`Loop media ${currentMediaIndex + 1}`}
              className="w-full h-auto max-h-96 object-cover"
            />
          ) : loop.media_type === "video" ? (
            <video
              controls
              className="w-full h-auto max-h-96"
              key={currentMediaIndex}
              onClick={(e) => e.stopPropagation()}
            >
              <source src={mediaUrls[currentMediaIndex]} type="video/mp4" />
            </video>
          ) : null}

          {mediaUrls.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                onClick={() =>
                  setCurrentMediaIndex((prev) =>
                    prev > 0 ? prev - 1 : mediaUrls.length - 1
                  )
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white hover:bg-black/70"
                onClick={() =>
                  setCurrentMediaIndex((prev) =>
                    prev < mediaUrls.length - 1 ? prev + 1 : 0
                  )
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {mediaUrls.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {mediaUrls.map((_: string, index: number) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentMediaIndex ? "bg-white" : "bg-white/50"
                }`}
                onClick={() => setCurrentMediaIndex(index)}
              />
            ))}
          </div>
        )}

        {mediaUrls.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
            {currentMediaIndex + 1} / {mediaUrls.length}
          </div>
        )}
      </div>
    );
  };

  const renderGiftIndicators = () => {
    if (!loop.gifts_received || loop.gifts_received === 0) return null;

    return (
      <div className="flex items-center space-x-2 mt-2">
        <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-full">
          <Gift className="h-3 w-3 text-purple-600" />
          <span className="text-xs font-medium text-purple-600">
            {loop.gifts_received}
          </span>
        </div>
        {loop.total_gift_value && loop.total_gift_value > 0 && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
            <Gift className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {loop.total_gift_value}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {LoginGateDialog}
      <Card
        ref={cardRef}
        className={getCardStyle()}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {loop.is_featured && (
          <div className="absolute top-2 right-2 z-10">
            <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
              <Star className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          </div>
        )}

        {currentTheme?.effects?.particles && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-4 left-4 w-1 h-1 bg-[var(--theme-primary)] rounded-full animate-pulse opacity-60"></div>
            <div className="absolute top-8 right-8 w-1 h-1 bg-[var(--theme-secondary)] rounded-full animate-pulse opacity-40 animation-delay-1000"></div>
            <div className="absolute bottom-6 left-6 w-1 h-1 bg-[var(--theme-primary)] rounded-full animate-pulse opacity-50 animation-delay-2000"></div>
          </div>
        )}

        <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
          {isCoLoop && (
            <div className="mb-2 flex items-center justify-between">
              <Badge className="bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 text-white font-bold text-[10px] px-2.5 py-0.5 rounded-full shadow-md shadow-cyan-500/20 border border-cyan-400/40 flex items-center gap-1">
                <Sparkles className="h-3 w-3 animate-pulse text-cyan-200" />
                Co-Loop Studio Collaboration
              </Badge>
              <button
                type="button"
                onClick={() => setRosterOpen(true)}
                className="text-[11px] font-semibold text-cyan-400 hover:underline flex items-center gap-1"
              >
                <Users className="h-3 w-3" />
                View {coAuthors.length + 1} Co-Authors
              </button>
            </div>
          )}

          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              {isCoLoop ? (
                <div
                  onClick={() => setRosterOpen(true)}
                  className="flex items-center cursor-pointer group flex-shrink-0"
                  title="Click to view Co-Authors roster"
                >
                  <div className="relative z-10">
                    <CosmeticAvatar
                      src={loop.author.avatar_url || "/placeholder.svg"}
                      alt={loop.author.display_name}
                      fallback={loop.author.display_name}
                      size="sm"
                      cosmetics={loop.author.cosmetics || loop.author.active_cosmetics}
                      className="ring-2 ring-cyan-500 ring-offset-2 ring-offset-background group-hover:scale-105 transition-transform"
                    />
                  </div>
                  {coAuthors.slice(0, 3).map((ca: any, i: number) => (
                    <div
                      key={ca.id || i}
                      className="-ml-3 relative z-[9] transition-transform group-hover:scale-105"
                      style={{ zIndex: 8 - i }}
                    >
                      <CosmeticAvatar
                        src={ca.avatar_url || "/placeholder.svg"}
                        alt={ca.display_name || ca.username}
                        fallback={ca.display_name || ca.username}
                        size="sm"
                        className="ring-2 ring-cyan-400 ring-offset-2 ring-offset-background"
                      />
                    </div>
                  ))}
                  {coAuthors.length > 3 && (
                    <div className="-ml-3 relative z-0 flex h-8 w-8 items-center justify-center rounded-full bg-cyan-950 text-[10px] font-bold text-cyan-300 ring-2 ring-cyan-400">
                      +{coAuthors.length - 3}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href={`/profile/${loop.author.username}`}
                  className="flex-shrink-0"
                >
                  <CosmeticAvatar
                    src={loop.author.avatar_url || "/placeholder.svg"}
                    alt={loop.author.display_name}
                    fallback={loop.author.display_name}
                    size="sm"
                    cosmetics={loop.author.cosmetics || loop.author.active_cosmetics}
                    className={getAvatarStyle()}
                  />
                </Link>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1 flex-wrap">
                  {isCoLoop ? (
                    <div className="flex items-center gap-1 flex-wrap font-semibold text-sm sm:text-base">
                      <Link
                        href={`/profile/${loop.author.username}`}
                        className="hover:underline text-cyan-400"
                      >
                        @{loop.author.username}
                      </Link>
                      {coAuthors.map((ca: any) => (
                        <span key={ca.id || ca.username} className="flex items-center gap-1">
                          <span className="text-muted-foreground font-normal">×</span>
                          <Link
                            href={`/profile/${ca.username}`}
                            className="hover:underline text-purple-400"
                          >
                            @{ca.username}
                          </Link>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <Link
                      href={`/profile/${loop.author.username}`}
                      className="min-w-0"
                    >
                      <span className="font-semibold hover:underline text-sm sm:text-base truncate block max-w-[120px] sm:max-w-none">
                        {loop.author.display_name}
                      </span>
                    </Link>
                  )}
                  <UserBadges
                    is_verified={loop.author.is_verified}
                    is_team_member={loop.author.is_team_member}
                    is_sponsor={loop.author.is_sponsor}
                    username={loop.author.username}
                    size="sm"
                  />
                  {loop.author.is_premium && (
                    <Badge className="h-3 w-3 sm:h-4 sm:w-4 p-0 bg-amber-500 flex-shrink-0">
                      <Crown className="h-1.5 w-1.5 sm:h-2 sm:w-2 text-white" />
                    </Badge>
                  )}
                  {loop.author.level && loop.author.level > 1 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] sm:text-xs px-1 flex-shrink-0"
                    >
                      L{loop.author.level}
                    </Badge>
                  )}
                  {loop.media_urls && loop.media_urls.length > 1 && (
                    <Badge
                      variant="outline"
                      className="text-[10px] sm:text-xs px-1 flex-shrink-0 border-purple-500 text-purple-600"
                    >
                      {loop.media_urls.length} files
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
                  <span className="truncate max-w-[80px] sm:max-w-none">
                    @{loop.author.username}
                  </span>
                  <span>•</span>
                  <FreshnessTimestamp date={loop.created_at} showIcon />
                  {loop.engagement_score && loop.engagement_score > 80 && (
                    <>
                      <span>•</span>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-green-100 text-green-700"
                      >
                        <Zap className="h-2 w-2 mr-1" />
                        Hot
                      </Badge>
                    </>
                  )}
                  {loop.is_featured && (
                    <>
                      <span>•</span>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-yellow-100 text-yellow-700"
                      >
                        <Star className="h-2 w-2 mr-1" />
                        Featured
                      </Badge>
                    </>
                  )}
                  {(isBoosted || boostCoinsCurrent >= 100) && (
                    <>
                      <span>•</span>
                      <Badge
                        variant="secondary"
                        className="text-xs bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 text-white font-bold shadow-sm shadow-cyan-500/30 flex items-center gap-1 border border-cyan-400/30"
                      >
                        <Rocket className="h-3 w-3 text-cyan-200 animate-pulse" />
                        Boosted {boostCoinsCurrent >= 2000 ? "(Tier 3)" : boostCoinsCurrent >= 500 ? "(Tier 2)" : "(Tier 1)"}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 sm:h-8 sm:w-8 p-0 flex-shrink-0"
                >
                  <MoreHorizontal className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {currentUser?.id === loop.author_id && (
                  <>
                    <DropdownMenuItem onClick={handleEdit}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Loop
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-red-500 focus:text-red-500">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Loop
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => {
                    if (!requireAuth("gift")) return
                    setShowGiftModal(true)
                  }}
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Send Gift
                </DropdownMenuItem>
                <ReportContentButton contentType="loop" contentId={loop.id} label="Report Loop" />
                <DropdownMenuItem onClick={handleShare}>
                  Copy Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-0 px-3 sm:px-6">
          <div className="space-y-2 sm:space-y-3">
            <div
              onDoubleClick={() => handleLike({ fromDoubleTap: true })}
              onTouchEnd={handleMediaDoubleTap}
              className="relative"
            >
              {doubleTapHeart && !loop.media_url && !(loop.media_urls?.length) && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                  <Heart className="h-16 w-16 fill-rose-500 text-rose-500 animate-in zoom-in-50 fade-in duration-300" />
                </div>
              )}
              {isCodeLoop(loop) || isCodeLoop(rawLoop) ? (
                <div className="space-y-2">
                  {(loop as any).content_title || rawLoop?.content_title ? (
                    <p className="text-sm font-semibold">{(loop as any).content_title || rawLoop?.content_title}</p>
                  ) : null}
                  {(loop as any).content_metadata?.forked_from ? (
                    <Badge variant="outline" className="text-[10px]">
                      Forked loop
                    </Badge>
                  ) : null}
                  <CodeBlock
                    code={content}
                    language={
                      (loop as any).content_metadata?.language ||
                      rawLoop?.content_metadata?.language ||
                      "other"
                    }
                    title={(loop as any).content_title || rawLoop?.content_title}
                    forksCount={Number(
                      (loop as any).content_metadata?.forks_count ||
                        rawLoop?.content_metadata?.forks_count ||
                        0,
                    )}
                    onFork={() => void handleFork()}
                    forking={forking}
                    showFork={currentUser?.id !== loop.author_id}
                  />
                </div>
              ) : (
                <>
                  <RichContent
                    text={showFullContent ? content : contentPreview}
                    className="text-sm sm:text-base leading-relaxed"
                  />
                  {content.length > 200 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto text-[var(--theme-primary)] hover:text-[var(--theme-secondary)] text-xs sm:text-sm"
                      onClick={() => setShowFullContent(!showFullContent)}
                    >
                      {showFullContent ? "Show less" : "Show more"}
                    </Button>
                  )}
                </>
              )}
            </div>

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hashtags.slice(0, 3).map((tag: string) => (
                  <Link key={tag} href={`/hashtag/${tag}`}>
                    <Badge
                      variant="outline"
                      className="text-[var(--theme-primary)] hover:bg-[var(--theme-primary)]/10 border-[var(--theme-primary)]/30 text-xs"
                    >
                      #{tag}
                    </Badge>
                  </Link>
                ))}
                {hashtags.length > 3 && (
                  <Badge
                    variant="outline"
                    className="text-xs text-muted-foreground"
                  >
                    +{hashtags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Render Poll Widget if loop is a poll */}
            {(loop.poll || rawLoop?.poll || loop.post_type === "poll" || rawLoop?.post_type === "poll" || loop.media_type === "poll" || loop.category === "poll") && (
              <PollCardWidget poll={loop.poll || rawLoop?.poll} loopId={loop.id} />
            )}

            {/* Render Duel Card if loop is a duel */}
            {(loop.duel || rawLoop?.duel || loop.post_type === "duel" || rawLoop?.post_type === "duel" || loop.media_type === "duel" || loop.category === "duel") && (
              <LoopDuelCard duel={loop.duel || rawLoop?.duel} loopId={loop.id} />
            )}

            {renderMedia()}

            {renderGiftIndicators()}

            {/* Crowd-Funded Boost Progress Bar */}
            {boostCoinsCurrent > 0 && (
              <div
                onClick={() => setBoostDialogOpen(true)}
                className="mt-3 p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 hover:border-cyan-400/40 cursor-pointer transition-all space-y-1.5"
              >
                <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-cyan-300 tracking-tight">
                    <Rocket className="h-3.5 w-3.5 text-cyan-400 animate-pulse shrink-0" />
                    {isBoosted ? "⚡ BOOSTED IN FEED" : "BOOST PROGRESS"}
                  </span>
                  <span className="text-amber-300 flex items-center gap-1 font-mono">
                    <Coins className="h-3 w-3 shrink-0" /> {boostCoinsCurrent} / {rawLoop?.boost_coins_target || 1000} Coins
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_8px_#22d3ee]"
                    style={{ width: `${Math.min(100, Math.round((boostCoinsCurrent / (rawLoop?.boost_coins_target || 1000)) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 sm:pt-3 border-t">
              <div className="flex items-center space-x-1 sm:space-x-3 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`space-x-1 transition-all duration-300 ${
                    loop.user_interactions.is_liked
                      ? "text-red-500 scale-110" :"hover:text-red-500 hover:scale-105"
                  }`}
                  onClick={() => handleLike()}
                  disabled={activeInteracting === `${loop.id}-like`}
                >
                  {activeInteracting === `${loop.id}-like` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Heart
                      className={`h-4 w-4 transition-all duration-200 ${
                        loop.user_interactions.is_liked ? "fill-current" : ""
                      }`}
                    />
                  )}
                  <span className="font-medium">{loop.stats.likes_count}</span>
                </Button>

                {/* Comment button navigation */}
                <Link href={`/loop/${loop.id}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="space-x-1 hover:text-blue-500 hover:scale-105 transition-all duration-200 text-xs sm:text-sm p-1 sm:p-2"
                  >
                    <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden xs:inline">
                      {loop.stats.comments_count}
                    </span>
                  </Button>
                </Link>

                {/* Branch dropdown menu: Branch Loop & View Chain Tree */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="space-x-1 hover:text-green-500 hover:scale-105 transition-all duration-200 text-xs sm:text-sm p-1 sm:p-2"
                      title="Branch / View Chain"
                    >
                      <GitBranch className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">
                        {loop.stats.branches_count}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#0b1329] border-white/10 text-slate-100">
                    <DropdownMenuItem onClick={handleBranch} className="cursor-pointer hover:bg-slate-800">
                      <GitBranch className="h-4 w-4 mr-2 text-green-400" /> Branch this Loop
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setChainDialogOpen(true)} className="cursor-pointer hover:bg-slate-800">
                      <Sparkles className="h-4 w-4 mr-2 text-cyan-400" /> View Loop Chain Map
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Boost Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBoostDialogOpen(true)}
                  className="space-x-1 hover:text-cyan-400 hover:scale-105 transition-all duration-200 text-xs sm:text-sm p-1 sm:p-2 text-slate-400"
                  title="Boost Loop with Coins"
                >
                  <Rocket className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Boost</span>
                </Button>

                {(isCodeLoop(loop) || isCodeLoop(rawLoop)) && currentUser?.id !== loop.author_id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="space-x-1 hover:text-violet-500 hover:scale-105 transition-all duration-200 text-xs sm:text-sm p-1 sm:p-2"
                    onClick={() => void handleFork()}
                    disabled={forking}
                    title="Fork code"
                  >
                    {forking ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    ) : (
                      <GitFork className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                    <span className="hidden sm:inline">Fork</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center space-x-1 sm:space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hover:scale-105 transition-all duration-200 p-1 sm:p-2 ${
                    loop.user_interactions.is_saved
                      ? "text-blue-500" :"hover:text-blue-500"
                  }`}
                  onClick={() => void runInteraction("save")}
                  disabled={activeInteracting === `${loop.id}-save`}
                >
                  {activeInteracting === `${loop.id}-save` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bookmark
                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                        loop.user_interactions.is_saved ? "fill-current" : ""
                      }`}
                    />
                  )}
                </Button>

                {/* Restore gift modal handler */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-[var(--theme-primary)] hover:scale-105 transition-all duration-200 p-1 sm:p-2"
                  onClick={() => {
                    if (!requireAuth("gift")) return
                    setShowGiftModal(true)
                  }}
                >
                  <Gift className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>

                {/* Restore share button handler */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:text-blue-500 hover:scale-105 transition-all duration-200 p-1 sm:p-2"
                  onClick={handleShare}
                >
                  <Share className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <GiftModal
        open={showGiftModal}
        onOpenChange={setShowGiftModal}
        recipient={{
          id: loop.author.id,
          username: loop.author.username,
          display_name: loop.author.display_name,
          avatar_url: loop.author.avatar_url,
        }}
        context={{
          type: "post",
          id: loop.id,
          title: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
        }}
      />

      <CreateBranchDialog
        open={showBranchDialog}
        onOpenChange={setShowBranchDialog}
        parentLoop={loop}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this loop?"
        description="This cannot be undone. Branches from others may remain."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="border-white/10 bg-[#0a1020] text-slate-100">
          <DialogHeader>
            <DialogTitle>Edit loop</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[140px] border-white/10 bg-white/5"
          />
          <DialogFooter>
            <Button variant="outline" className="border-white/10" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-h-[100dvh] max-w-[100vw] border-0 bg-black/95 p-0 text-white sm:max-w-5xl">
          <div className="relative flex min-h-[70vh] items-center justify-center p-4">
            {(() => {
              const mediaUrls =
                loop.media_urls || (loop.media_url ? [loop.media_url] : [])
              const url = mediaUrls[currentMediaIndex]
              if (!url) return null
              if (loop.media_type === "video") {
                return (
                  <video src={url} controls autoPlay className="max-h-[85vh] max-w-full object-contain" />
                )
              }
              return (
                <img src={url} alt="Full media" className="max-h-[85vh] max-w-full object-contain" />
              )
            })()}
            {(loop.media_urls?.length || 0) > 1 && (
              <>
                <Button
                  variant="ghost"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-white"
                  onClick={() =>
                    setCurrentMediaIndex((prev) =>
                      prev > 0 ? prev - 1 : (loop.media_urls?.length || 1) - 1,
                    )
                  }
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white"
                  onClick={() =>
                    setCurrentMediaIndex((prev) =>
                      prev < (loop.media_urls?.length || 1) - 1 ? prev + 1 : 0,
                    )
                  }
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
        <DialogContent className="border-border/60 bg-card text-foreground sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              Co-Loop Contributors Roster
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {/* Primary Creator */}
            <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-cyan-500">
                  <AvatarImage src={loop.author.avatar_url} />
                  <AvatarFallback>{loop.author.display_name?.charAt(0) || "A"}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-xs sm:text-sm">{loop.author.display_name}</p>
                    <Badge className="bg-cyan-500 text-[9px] font-bold px-1.5 py-0 text-black">CREATOR</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">@{loop.author.username}</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-xl text-xs h-8">
                <Link href={`/profile/${loop.author.username}`}>Profile</Link>
              </Button>
            </div>

            {/* Co-Authors List */}
            {coAuthors.map((ca: any, idx: number) => (
              <div
                key={ca.id || idx}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 ring-2 ring-purple-500">
                    <AvatarImage src={ca.avatar_url} />
                    <AvatarFallback>{(ca.display_name || ca.username)?.charAt(0) || "C"}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-xs sm:text-sm">{ca.display_name || ca.username}</p>
                      <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                        {ca.role || "CO-AUTHOR"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">@{ca.username}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs h-8">
                  <Link href={`/profile/${ca.username}`}>Profile</Link>
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="w-full rounded-xl" onClick={() => setRosterOpen(false)}>
              Close Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loop Chain Branch Map Dialog */}
      <LoopChainDialog
        loopId={loop.id}
        open={chainDialogOpen}
        onOpenChange={setChainDialogOpen}
      />

      {/* Crowd-Funded Boost Dialog */}
      <BoostLoopDialog
        loopId={loop.id}
        loopTitle={content.slice(0, 40)}
        currentCoins={boostCoinsCurrent}
        targetCoins={rawLoop?.boost_coins_target || 1000}
        open={boostDialogOpen}
        onOpenChange={setBoostDialogOpen}
        onBoostSuccess={(newCurrent, isBoostedState) => {
          setBoostCoinsCurrent(newCurrent)
          setIsBoosted(isBoostedState)
        }}
      />
    </>
  );
}


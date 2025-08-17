"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  Share,
  Bookmark,
  MoreHorizontal,
  GitBranch,
  Volume2,
  Gift,
  Sparkles,
  Star,
  Zap,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
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

interface LoopAuthor {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  is_verified?: boolean;
  is_premium?: boolean;
  level?: number;
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
  parent_loop_id?: string;
}

interface LoopCardProps {
  loop: Loop;
  interacting: string | null;
  onInteraction: (loopId: string, type: "like" | "save") => void;
  className?: string;
}

export function LoopCard({
  loop,
  interacting,
  onInteraction,
  className = "",
}: LoopCardProps) {
  const [showFullContent, setShowFullContent] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const { currentTheme } = useTheme3D();
  const [isAnimating, setIsAnimating] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  // Defensive fallback for content and hashtags
  const content = typeof loop.content === "string" ? loop.content : "";
  const hashtags = Array.isArray(loop.hashtags) ? loop.hashtags : [];

  const contentPreview =
    content.length > 200 ? content.substring(0, 200) + "..." : content;

  // Handle share with analytics
  const handleShare = () => {
    // Copy link to clipboard
    const url = `${window.location.origin}/loop/${loop.id}`;
    navigator.clipboard.writeText(url);

    toast({
      title: "Link Copied!",
      description: "Loop link has been copied to your clipboard.",
    });
    // Optionally, you can call onInteraction for analytics
    // if (onInteraction) onInteraction(loop.id, "share");
  };

  // Enhanced like animation with gift effects
  const handleLike = () => {
    onInteraction(loop.id, "like");
    if (!loop.user_interactions.is_liked) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  // Handle branch creation
  const handleBranch = () => {
    if (onInteraction) {
      onInteraction(loop.id, "branch");
    }
  };

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

    return `${baseStyle} ${themeStyle} ${hoverStyle} ${featuredStyle}`;
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
                className="w-full h-auto max-h-96 object-cover transition-transform duration-300 hover:scale-105"
              />
            </div>
          );
        case "video":
          return (
            <div
              className={`mt-3 rounded-lg overflow-hidden bg-black relative ${mediaContainerStyle}`}
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
                  <audio controls className="w-full mt-2">
                    <source src={mediaUrl} type="audio/mpeg" />
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
            <Sparkles className="h-3 w-3 mr-1" />
            Premium
          </Badge>
        </div>

        <div className="relative">
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
            {mediaUrls.map((_, index) => (
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
          <div className="flex items-center space-x-1 px-2 py-1 bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-full">
            <Sparkles className="h-3 w-3 text-yellow-600" />
            <span className="text-xs font-medium text-yellow-600">
              {loop.total_gift_value}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
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
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
              <Link
                href={`/profile/${loop.author.username}`}
                className="flex-shrink-0"
              >
                <Avatar
                  className={`h-8 w-8 sm:h-10 sm:w-10 ${getAvatarStyle()}`}
                >
                  <AvatarImage
                    src={loop.author.avatar_url || "/placeholder.svg"}
                    alt={loop.author.display_name}
                  />
                  <AvatarFallback className="text-xs sm:text-sm">
                    {loop.author.display_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1 flex-wrap">
                  <Link
                    href={`/profile/${loop.author.username}`}
                    className="min-w-0"
                  >
                    <span className="font-semibold hover:underline text-sm sm:text-base truncate block max-w-[120px] sm:max-w-none">
                      {loop.author.display_name}
                    </span>
                  </Link>
                  {loop.author.is_verified && (
                    <Badge
                      variant="secondary"
                      className="h-3 w-3 sm:h-4 sm:w-4 p-0 bg-blue-500 flex-shrink-0"
                    >
                      <span className="text-white text-[10px] sm:text-xs">
                        ✓
                      </span>
                    </Badge>
                  )}
                  {loop.author.is_premium && (
                    <Badge className="h-3 w-3 sm:h-4 sm:w-4 p-0 bg-gradient-to-r from-purple-500 to-pink-500 flex-shrink-0">
                      <Sparkles className="h-1.5 w-1.5 sm:h-2 sm:w-2 text-white" />
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
                <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="truncate max-w-[80px] sm:max-w-none">
                    @{loop.author.username}
                  </span>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">
                    {formatDistanceToNow(new Date(loop.created_at), {
                      addSuffix: true,
                    })}
                  </span>
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
                <DropdownMenuItem onClick={() => setShowGiftModal(true)}>
                  <Gift className="h-4 w-4 mr-2" />
                  Send Gift
                </DropdownMenuItem>
                <DropdownMenuItem>Report Loop</DropdownMenuItem>
                <DropdownMenuItem>Hide from Feed</DropdownMenuItem>
                <DropdownMenuItem onClick={handleShare}>
                  Copy Link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-0 px-3 sm:px-6">
          <div className="space-y-2 sm:space-y-3">
            <div>
              <p className="text-sm sm:text-base leading-relaxed">
                {showFullContent ? content : contentPreview}
              </p>
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
            </div>

            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {hashtags.slice(0, 3).map((tag) => (
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

            {renderMedia()}

            {renderGiftIndicators()}

            <div className="flex items-center justify-between pt-2 sm:pt-3 border-t">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`space-x-1 transition-all duration-300 ${
                    loop.user_interactions.is_liked
                      ? "text-red-500 scale-110"
                      : "hover:text-red-500 hover:scale-105"
                  }`}
                  onClick={handleLike}
                  disabled={interacting === `${loop.id}-like`}
                >
                  {interacting === `${loop.id}-like` ? (
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

                {/* Restore comment button navigation */}
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

                {/* Restore branch button handler */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="space-x-1 hover:text-green-500 hover:scale-105 transition-all duration-200 text-xs sm:text-sm p-1 sm:p-2"
                  onClick={handleBranch}
                >
                  <GitBranch className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden xs:inline">
                    {loop.stats.branches_count}
                  </span>
                </Button>
              </div>

              <div className="flex items-center space-x-1 sm:space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`hover:scale-105 transition-all duration-200 p-1 sm:p-2 ${
                    loop.user_interactions.is_saved
                      ? "text-blue-500"
                      : "hover:text-blue-500"
                  }`}
                  onClick={() => onInteraction(loop.id, "save")}
                  disabled={interacting === `${loop.id}-save`}
                >
                  {interacting === `${loop.id}-save` ? (
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
                  onClick={() => setShowGiftModal(true)}
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
    </>
  );
}


"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  MapPin,
  LinkIcon,
  TreePine,
  Heart,
  MessageCircle,
  Settings,
  UserPlus,
  UserCheck,
  Crown,
  Share,
  Gift,
  Palette,
  Sparkles,
  Zap,
  Star,
  Trophy,
  Eye,
  Coins,
  GitBranch,
} from "lucide-react";
import { LoopCard } from "@/components/loop-card";
import { ProfileThemeCustomizer } from "@/components/profile/profile-theme-customizer";
import { GiftModal } from "@/components/gifting/gift-modal";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme3D } from "@/providers/theme-3d-provider";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface Enhanced3DProfileProps {
  username: string;
}

interface ProfileTheme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text?: string;
  };
  effects: {
    glow: boolean;
    particles: boolean;
    animations: boolean;
  };
  is_premium: boolean;
  price?: number;
}

interface ProfileStats {
  loops_count: number;
  followers_count: number;
  following_count: number;
  likes_received: number;
  profile_views: number;
  achievements_count: number;
  level: number;
  xp_points: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  earned_at: string;
  progress?: number;
  max_progress?: number;
}

const AVAILABLE_THEMES: ProfileTheme[] = [
  {
    id: "default",
    name: "Default",
    colors: {
      primary: "#8b5cf6",
      secondary: "#3b82f6",
      accent: "#f59e0b",
      background: "#ffffff",
      text: "#1f2937",
    },
    effects: {
      glow: false,
      particles: false,
      animations: true,
    },
    is_premium: false,
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    colors: {
      primary: "#00ff88",
      secondary: "#00ccff",
      accent: "#ff0080",
      background: "#0a0a0a",
      text: "#ffffff",
    },
    effects: {
      glow: true,
      particles: true,
      animations: true,
    },
    is_premium: false,
    price: 500,
  },
  {
    id: "sunset-dream",
    name: "Sunset Dream",
    colors: {
      primary: "#ff6b6b",
      secondary: "#ffa500",
      accent: "#ff1744",
      background: "#fff3e0",
      text: "#332200",
    },
    effects: {
      glow: true,
      particles: false,
      animations: true,
    },
    is_premium: false,
    price: 300,
  },
  {
    id: "galaxy-explorer",
    name: "Galaxy Explorer",
    colors: {
      primary: "#667eea",
      secondary: "#764ba2",
      accent: "#f093fb",
      background: "#0c0c0c",
      text: "#ffffff",
    },
    effects: {
      glow: true,
      particles: true,
      animations: true,
    },
    is_premium: true,
    price: 800,
  },
  {
    id: "royal-gold",
    name: "Royal Gold",
    colors: {
      primary: "#ffd700",
      secondary: "#ff8c00",
      accent: "#ffff00",
      background: "#1a1a1a",
      text: "#ffffff",
    },
    effects: {
      glow: true,
      particles: true,
      animations: true,
    },
    is_premium: true,
    price: 1200,
  },
];

export function Enhanced3DProfile({ username }: Enhanced3DProfileProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { currentTheme, setTheme } = useTheme3D();
  const profileRef = useRef<HTMLDivElement>(null);

  // State management
  const [isFollowing, setIsFollowing] = useState(false);
  const [showThemeCustomizer, setShowThemeCustomizer] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [ownedThemes, setOwnedThemes] = useState<string[]>(["default"]);
  const [activeTheme, setActiveTheme] = useState<string>("default");
  const [loading, setLoading] = useState(true);
  const [loops, setLoops] = useState<any[]>([]);
  const [loopsLoading, setLoopsLoading] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);
  const [likedLoops, setLikedLoops] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any>(null);

  // Mouse tracking for 3D effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (profileRef.current) {
        const rect = profileRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        setMousePosition({ x, y });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Load profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(`
            *,
            profile_stats:profile_stats!user_id(loops_count, followers_count, following_count, likes_received, profile_views, achievements_count, level, xp_points),
            user_achievements:user_achievements(achievement:achievements(*), earned_at, progress, max_progress)
          `)
          .eq("username", username)
          .single();

        if (!profileError && profileData) {
          setProfile(profileData);
          setStats(profileData.profile_stats);
          setAchievements(profileData.user_achievements.map((ua) => ({
            ...ua.achievement,
            earned_at: ua.earned_at,
            progress: ua.progress,
            max_progress: ua.max_progress,
          })));

          setActiveTheme(profileData.active_theme || "default");

          // Set theme if it's different from current
          if (
            profileData.active_theme &&
            profileData.active_theme !== currentTheme.id
          ) {
            setTheme(profileData.active_theme);
          }
        }

        // Fetch owned themes
        const { data: inventoryData } = await supabase
          .from("user_inventory")
          .select("item_id")
          .eq("user_id", profileData?.id)
          .eq("item_type", "theme");

        if (inventoryData) {
          setOwnedThemes([
            "default",
            ...inventoryData.map((item) => item.item_id),
          ]);
        }

        // Fetch loops
        const { data: loopsData } = await supabase
          .from("loops")
          .select(`
            *,
            stats:loop_stats(likes_count, comments_count, branches_count),
            author:profiles(id, username, display_name, avatar_url)
          `)
          .eq("author_id", profileData?.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (loopsData) {
          setLoops(loopsData);
        }

        // Fetch user's branches (loops with parent_loop_id)
        const { data: branchesData } = await supabase
          .from("loops")
          .select(`
            *,
            stats:loop_stats(likes_count, comments_count),
            author:profiles(id, username, display_name, avatar_url)
          `)
          .eq("author_id", profileData?.id)
          .neq("parent_loop_id", null)
          .order("created_at", { ascending: false })
          .limit(10);

        if (branchesData) {
          setBranches(branchesData);
        }

        // Fetch user's liked loops
        const { data: likedData } = await supabase
          .from("likes")
          .select(`loop_id, loops(*, stats:loop_stats(likes_count, comments_count), author:profiles(id, username, display_name, avatar_url))`)
          .eq("user_id", profileData?.id)
          .limit(10);

        if (likedData) {
          setLikedLoops(likedData.map((like) => like.loops));
        }

        // Fetch user's achievements
        const { data: userAchievementsData, error: achievementsError } = await supabase
          .from("user_achievements")
          .select(`
            *,
            achievement:achievements(*)
          `)
          .eq("user_id", profileData?.id)
          .limit(10);

        const { data: userStatsData, error: statsError } = await supabase
          .from("profile_stats")
          .select("*")
          .eq("user_id", profileData?.id)
          .single();

        if (!achievementsError && userAchievementsData) {
          setAchievements(userAchievementsData.map((ua) => ({
            ...ua.achievement,
            earned_at: ua.earned_at,
            progress: ua.progress,
            max_progress: ua.max_progress,
          })));
        }
        if (!statsError && userStatsData) {
          setUserStats(userStatsData);
        }

        // Check if current user is following this user
        if (currentUser && profileData && currentUser.id !== profileData.id) {
          const { data: followData } = await supabase
            .from('followers')
            .select('id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', profileData.id)
            .single();
          setIsFollowing(!!followData);
        }

      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
        setLoopsLoading(false);
      }
    };

    fetchProfile();
  }, [username, currentUser?.id, currentTheme.id, setTheme]);

  // Handle theme purchase
  const handleThemePurchase = async (themeId: string) => {
    const theme = AVAILABLE_THEMES.find((t) => t.id === themeId);
    if (!theme || !currentUser) return;

    if (theme.is_premium && !currentUser.is_premium) {
      toast({
        title: "Premium Required",
        description: "This theme requires a premium subscription.",
        variant: "destructive",
      });
      return;
    }

    if (theme.price && (currentUser.loop_coins || 0) < theme.price) {
      toast({
        title: "Insufficient Coins",
        description: `You need ${theme.price} Loop Coins to purchase this theme.`,
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.access_token}`,
        },
        body: JSON.stringify({
          item_type: "theme",
          item_id: themeId,
          price: theme.price,
        }),
      });

      if (response.ok) {
        setOwnedThemes((prev) => [...prev, themeId]);
        toast({
          title: "Theme Purchased!",
          description: `You've successfully purchased the ${theme.name} theme.`,
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Purchase Failed",
          description: errorData.error || "Failed to purchase theme. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to purchase theme:", error);
      toast({
        title: "Purchase Failed",
        description: "Failed to purchase theme. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle theme activation
  const handleThemeActivation = async (themeId: string) => {
    if (!currentUser || !profile) return;

    try {
      const response = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.access_token}`,
        },
        body: JSON.stringify({
          active_theme: themeId,
        }),
      });

      if (response.ok) {
        setActiveTheme(themeId);
        setTheme(themeId);
        toast({
          title: "Theme Activated!",
          description: "Your profile theme has been updated.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Activation Failed",
          description: errorData.error || "Failed to activate theme. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to activate theme:", error);
      toast({
        title: "Activation Failed",
        description: "Failed to activate theme. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;

    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.access_token}`,
        },
        body: JSON.stringify({
          user_id: profile.id,
          action: isFollowing ? "unfollow" : "follow",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsFollowing(data.is_following);
        toast({
          description: data.message,
        });
      } else {
        toast({
          description: data.error || "Failed to update follow status",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        description: "Network error occurred",
        variant: "destructive",
      });
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast({
      description: "Profile link copied to clipboard!",
    });
  };

  const isOwnProfile = currentUser?.id === profile?.id;

  // Calculate 3D transform
  const getTransform = () => {
    if (!isHovered) return "translateZ(0) rotateX(0deg) rotateY(0deg)";

    const rotateX = (mousePosition.y - 0.5) * 10;
    const rotateY = (mousePosition.x - 0.5) * 10;

    return `translateZ(20px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Profile not found</h2>
          <p className="text-gray-600">
            This user doesn't exist or their profile is private.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={profileRef}
      className="min-h-screen"
      style={{
        background: currentTheme.colors.background,
        color: currentTheme.colors.text || "#1f2937",
      }}
    >
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Enhanced 3D Profile Header */}
        <Card
          className="mb-6 overflow-hidden transform-gpu transition-all duration-300 hover:shadow-2xl"
          style={{
            transformStyle: "preserve-3d",
            background: `linear-gradient(135deg, ${currentTheme.colors.primary}20, ${currentTheme.colors.secondary}20)`,
            transform: getTransform(),
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Animated Banner */}
          <div
            className={`h-48 bg-gradient-to-r ${
              profile.theme_data?.background_gradient ||
              "from-purple-100 to-blue-100"
            } relative`}
            style={{
              backgroundImage: profile.banner_url
                ? `url(${profile.banner_url})`
                : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
              background: `linear-gradient(45deg, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`,
            }}
          >
            {/* Particle effects */}
            {currentTheme.effects.particles && (
              <div className="absolute inset-0 overflow-hidden">
                {Array.from({ length: 20 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-white rounded-full animate-pulse opacity-70"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${2 + Math.random() * 2}s`,
                    }}
                  />
                ))}
              </div>
            )}

            <div className="absolute top-4 right-4 flex space-x-2">
              <Button variant="secondary" size="sm" onClick={handleShare}>
                <Share className="w-4 h-4 mr-2" />
                Share
              </Button>
              {isOwnProfile && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowThemeCustomizer(true)}
                >
                  <Palette className="w-4 h-4 mr-2" />
                  Customize
                </Button>
              )}
            </div>

            {/* Level indicator */}
            {stats && (
              <div className="absolute top-4 left-4">
                <Badge
                  className="bg-black/50 text-white backdrop-blur-sm"
                  style={{ borderColor: currentTheme.colors.accent }}
                >
                  <Trophy className="w-3 h-3 mr-1" />
                  Level {stats.level}
                </Badge>
              </div>
            )}
          </div>

          <CardContent className="relative pt-0 pb-6">
            {/* Enhanced Profile Info */}
            <div className="flex flex-col md:flex-row items-start md:items-end justify-between -mt-16 mb-6">
              <div className="flex items-end space-x-4">
                <div className="relative">
                  <Avatar
                    className={`w-32 h-32 border-4 border-white shadow-2xl transition-all duration-300 ${
                      currentTheme.effects.glow ? "shadow-lg" : ""
                    }`}
                    style={{
                      borderColor: currentTheme.colors.accent,
                      boxShadow: currentTheme.effects.glow
                        ? `0 0 20px ${currentTheme.colors.primary}50`
                        : undefined,
                    }}
                  >
                    <AvatarImage
                      src={profile.avatar_url || "/placeholder.svg"}
                      alt={profile.display_name}
                    />
                    <AvatarFallback className="text-2xl">
                      {profile.display_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Online indicator */}
                  {profile.is_online && (
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse" />
                  )}
                </div>

                <div className="pb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <h1
                      className="text-3xl font-bold"
                      style={{ color: currentTheme.colors.text || "#1f2937" }}
                    >
                      {profile.display_name}
                    </h1>
                    {profile.is_verified && (
                      <Badge
                        variant="secondary"
                        className={
                          profile.is_admin
                            ? "bg-green-100 text-green-700 border-green-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }
                      >
                        {profile.is_admin
                          ? "🌱 Root"
                          : `${(<Star className="w-3 h-3 mr-1" />)} Verified`}
                      </Badge>
                    )}
                    {profile.is_premium && (
                      <Badge
                        className="text-white"
                        style={{
                          background: `linear-gradient(45deg, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`,
                        }}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    @{profile.username}
                  </p>

                  {/* XP Progress Bar */}
                  {stats && (
                    <div className="mt-2 flex items-center space-x-2">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(stats.xp_points % 1000) / 10}%`,
                            background: `linear-gradient(90deg, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">
                        {stats.xp_points % 1000}/1000 XP
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-2 mt-4 md:mt-0">
                {!isOwnProfile ? (
                  <>
                    <Button
                      onClick={handleFollow}
                      className={
                        !isFollowing
                          ? "bg-gradient-to-r from-purple-500 to-blue-500"
                          : ""
                      }
                      style={{
                        background: !isFollowing
                          ? `linear-gradient(45deg, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`
                          : undefined,
                      }}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-4 h-4 mr-2" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4 mr-2" />
                          Follow
                        </>
                      )}
                    </Button>
                    <Link href={`/message/${profile.username}`}>
                      <Button variant="outline">
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Message
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      onClick={() => setShowGiftModal(true)}
                    >
                      <Gift className="w-4 h-4 mr-2" />
                      Gift
                    </Button>
                  </>
                ) : (
                  <Link href="/settings">
                    <Button variant="outline">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Bio and Info */}
            <div className="space-y-4">
              <p
                className="leading-relaxed"
                style={{ color: currentTheme.colors.text || "#1f2937" }}
              >
                {profile.bio}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                {profile.location && (
                  <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <div className="flex items-center space-x-1">
                    <LinkIcon className="w-4 h-4" />
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: currentTheme.colors.primary }}
                    >
                      {profile.website.replace("https://", "")}
                    </a>
                  </div>
                )}
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Joined {new Date(profile.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Enhanced Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Link
                  href={`/profile/${username}/following`}
                  className="hover:underline transition-colors"
                >
                  <div className="text-center">
                    <div
                      className="font-bold text-lg"
                      style={{ color: currentTheme.colors.primary }}
                    >
                      {stats?.following_count?.toLocaleString() ?? 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Following
                    </div>
                  </div>
                </Link>
                <Link
                  href={`/profile/${username}/followers`}
                  className="hover:underline transition-colors"
                >
                  <div className="text-center">
                    <div
                      className="font-bold text-lg"
                      style={{ color: currentTheme.colors.primary }}
                    >
                      {stats?.followers_count?.toLocaleString() ?? 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Followers
                    </div>
                  </div>
                </Link>
                <div className="text-center">
                  <div
                    className="font-bold text-lg"
                    style={{ color: currentTheme.colors.primary }}
                  >
                    {stats?.loops_count?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Loops
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="font-bold text-lg"
                    style={{ color: currentTheme.colors.secondary }}
                  >
                    {stats?.likes_received?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Likes
                  </div>
                </div>
                <div className="text-center">
                  <div
                    className="font-bold text-lg"
                    style={{ color: currentTheme.colors.accent }}
                  >
                    {stats?.profile_views?.toLocaleString() ?? 0}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Views
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Profile Content */}
        <Tabs defaultValue="loops" className="mt-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="loops">Loops</TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              Branches
            </TabsTrigger>
            <TabsTrigger value="likes" className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              Likes
            </TabsTrigger>
            <TabsTrigger value="achievements" className="flex items-center gap-1">
              <Trophy className="w-3 h-3" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="loops" className="mt-6">
            <div className="grid gap-4">
              {loopsLoading ? (
                <div className="text-center py-12 text-gray-500">
                  Loading loops...
                </div>
              ) : loops.length > 0 ? (
                loops.map((loop) => (
                  <LoopCard
                    key={loop.id}
                    loop={loop}
                    onLike={() => {}}
                    onBookmark={() => {}}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No loops yet
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="branches" className="mt-6">
            <div className="grid gap-4">
              {branches.length > 0 ? (
                branches.map((branch) => (
                  <Card key={branch.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <GitBranch className="w-4 h-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Branched from a loop • {new Date(branch.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="mb-3">{branch.content_text}</p>
                      {branch.content_media_url && (
                        <img
                          src={branch.content_media_url}
                          alt="Branch content"
                          className="rounded-lg max-w-full h-auto mb-3"
                        />
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Heart className="w-3 h-3" />
                          {branch.stats?.likes_count || 0}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {branch.stats?.comments_count || 0}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No branches yet
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="likes" className="mt-6">
            <div className="grid gap-4">
              {likedLoops.length > 0 ? (
                likedLoops.map((loop) => (
                  <Card key={loop.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        <p className="text-sm text-muted-foreground">
                          Liked • {new Date(loop.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={loop.author?.avatar_url} />
                          <AvatarFallback>{loop.author?.display_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{loop.author?.display_name}</span>
                        <span className="text-sm text-muted-foreground">@{loop.author?.username}</span>
                      </div>
                      <p className="mb-3">{loop.content_text}</p>
                      {loop.content_media_url && (
                        <img
                          src={loop.content_media_url}
                          alt="Loop content"
                          className="rounded-lg max-w-full h-auto mb-3"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No liked loops yet
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <div className="space-y-6">
              {userStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5" />
                      Level {userStats.level}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{userStats.loops_created}</div>
                        <div className="text-sm text-muted-foreground">Loops Created</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{userStats.total_likes_received}</div>
                        <div className="text-sm text-muted-foreground">Likes Received</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{userStats.followers_count}</div>
                        <div className="text-sm text-muted-foreground">Followers</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold">{userStats.total_xp}</div>
                        <div className="text-sm text-muted-foreground">Total XP</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid gap-4">
                {achievements.length > 0 ? (
                  achievements.map((userAchievement) => {
                    const achievement = userAchievement.achievement;
                    const levelColors = {
                      bronze: 'bg-amber-100 text-amber-800 border-amber-200',
                      silver: 'bg-gray-100 text-gray-800 border-gray-200',
                      gold: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                      platinum: 'bg-purple-100 text-purple-800 border-purple-200',
                      diamond: 'bg-blue-100 text-blue-800 border-blue-200'
                    };

                    return (
                      <Card key={userAchievement.id} className="hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{achievement.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold">{achievement.name}</h4>
                                <Badge className={levelColors[achievement.level] || 'bg-gray-100'}>
                                  {achievement.level}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {achievement.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span>+{achievement.xp_reward} XP</span>
                                <span>+{achievement.coins_reward} coins</span>
                                <span>Earned {new Date(userAchievement.earned_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No achievements yet
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="about" className="mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground">Bio</h4>
                    <p className="mt-1">{profile.bio || "No bio available"}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground">Joined</h4>
                    <p className="mt-1">
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {profile.location && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground">Location</h4>
                      <p className="mt-1">{profile.location}</p>
                    </div>
                  )}

                  {profile.website && (
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground">Website</h4>
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 text-blue-600 hover:text-blue-800"
                      >
                        {profile.website}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Theme Customizer Modal */}
        {showThemeCustomizer && (
          <ProfileThemeCustomizer
            open={showThemeCustomizer}
            onOpenChange={setShowThemeCustomizer}
            currentTheme={profile.theme_data}
            onThemeUpdate={(theme) => {
              setProfile({ ...profile, theme_data: theme });
            }}
          />
        )}

        {/* Gift Modal */}
        {showGiftModal && (
          <GiftModal
            open={showGiftModal}
            onOpenChange={setShowGiftModal}
            recipient={{
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
            }}
            context={{
              type: "profile",
              id: profile.id,
              title: profile.display_name,
            }}
          />
        )}
      </div>
    </div>
  );
}
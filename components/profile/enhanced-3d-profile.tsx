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
} from "lucide-react";
import { LoopCard } from "@/components/loop-card";
import { ProfileThemeCustomizer } from "@/components/profile/profile-theme-customizer";
import { GiftModal } from "@/components/gifting/gift-modal";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme3D } from "@/providers/theme-3d-provider";
import { createClient } from "@supabase/supabase-js";

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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .single();

        if (!profileError && profileData) {
          setProfile(profileData);
          setActiveTheme(profileData.active_theme || "default");

          // Set theme if it's different from current
          if (
            profileData.active_theme &&
            profileData.active_theme !== currentTheme.id
          ) {
            setTheme(profileData.active_theme);
          }
        }

        // Fetch stats
        const { data: statsData } = await supabase
          .from("profile_stats")
          .select("*")
          .eq("user_id", profileData?.id)
          .single();

        if (statsData) {
          setStats(statsData);
        }

        // Fetch achievements
        const { data: achievementsData } = await supabase
          .from("user_achievements")
          .select(
            `
            *,
            achievement:achievements(*)
          `
          )
          .eq("user_id", profileData?.id);

        if (achievementsData) {
          setAchievements(
            achievementsData.map((ua) => ({
              ...ua.achievement,
              earned_at: ua.earned_at,
              progress: ua.progress,
              max_progress: ua.max_progress,
            }))
          );
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
          .select("*")
          .eq("author_id", profileData?.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (loopsData) {
          setLoops(loopsData);
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error);
      } finally {
        setLoading(false);
        setLoopsLoading(false);
      }
    };

    fetchProfile();
  }, [username, currentTheme.id, setTheme]);

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
          Authorization: `Bearer ${currentUser.token}`,
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
          Authorization: `Bearer ${currentUser.token}`,
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
      }
    } catch (error) {
      console.error("Failed to activate theme:", error);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;

    try {
      const response = await fetch("/api/users/follow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.token}`,
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

  const isOwnProfile = currentUser?.username === username;

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
        color: currentTheme.colors.text,
      }}
    >
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Enhanced 3D Profile Header */}
        <Card
          className="mb-6 overflow-hidden transform-gpu transition-all duration-300 hover:shadow-2xl"
          style={{
            transformStyle: "preserve-3d",
            background: `linear-gradient(135deg, ${currentTheme.colors.primary}20, ${currentTheme.colors.secondary}20)`,
          }}
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
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white animate-pulse" />
                </div>

                <div className="pb-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <h1
                      className="text-3xl font-bold"
                      style={{ color: currentTheme.colors.text }}
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
                {!isOwnProfile && (
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
                    <Link href="/message">
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
                )}
                {isOwnProfile && (
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
                style={{ color: currentTheme.colors.text }}
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
        <Tabs defaultValue="loops" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="loops">
              <TreePine className="w-4 h-4 mr-2" />
              Loops
            </TabsTrigger>
            <TabsTrigger
              value="branches"
              className="flex items-center space-x-2"
            >
              <TreePine className="w-4 h-4" />
              <span>Branches</span>
            </TabsTrigger>
            <TabsTrigger value="achievements">
              <Trophy className="w-4 h-4 mr-2" />
              Achievements
            </TabsTrigger>
            <TabsTrigger value="themes">
              <Palette className="w-4 h-4 mr-2" />
              Themes
            </TabsTrigger>
            <TabsTrigger value="likes">
              <Heart className="w-4 h-4 mr-2" />
              Likes
            </TabsTrigger>
            <TabsTrigger value="media">
              <Sparkles className="w-4 h-4 mr-2" />
              Media
            </TabsTrigger>
          </TabsList>

          <TabsContent value="loops" className="mt-6">
            <div className="space-y-6">
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
                <div className="text-center py-12 text-gray-500">
                  No loops found.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="branches" className="mt-6">
            <div className="text-center py-12">
              <TreePine className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                No branches yet
              </h3>
              <p className="text-gray-500 dark:text-gray-500">
                Branches from other loops will appear here
              </p>
            </div>
          </TabsContent>

          <TabsContent value="achievements" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((achievement) => (
                <Card
                  key={achievement.id}
                  className={`hover:shadow-lg transition-all duration-300 ${
                    achievement.rarity === "legendary"
                      ? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50"
                      : achievement.rarity === "epic"
                      ? "border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50"
                      : achievement.rarity === "rare"
                      ? "border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50"
                      : "border-gray-200"
                  }`}
                >
                  <CardContent className="p-4 text-center">
                    <div className="text-4xl mb-2">{achievement.icon}</div>
                    <h3 className="font-semibold mb-1">{achievement.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {achievement.description}
                    </p>
                    <Badge
                      className={`${
                        achievement.rarity === "legendary"
                          ? "bg-yellow-100 text-yellow-700"
                          : achievement.rarity === "epic"
                          ? "bg-purple-100 text-purple-700"
                          : achievement.rarity === "rare"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {achievement.rarity}
                    </Badge>
                    {achievement.progress !== undefined &&
                      achievement.max_progress && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${
                                  (achievement.progress /
                                    achievement.max_progress) *
                                  100
                                }%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {achievement.progress}/{achievement.max_progress}
                          </p>
                        </div>
                      )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="themes" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {AVAILABLE_THEMES.map((theme) => {
                const isOwned = ownedThemes.includes(theme.id);
                const isActive = activeTheme === theme.id;

                return (
                  <Card
                    key={theme.id}
                    className={`hover:shadow-lg transition-all duration-300 ${
                      isActive ? "ring-2 ring-purple-500" : ""
                    }`}
                  >
                    <CardContent className="p-4">
                      <div
                        className="h-20 rounded-lg mb-3 relative overflow-hidden"
                        style={{
                          background: `linear-gradient(45deg, ${theme.colors.primary}, ${theme.colors.secondary})`,
                        }}
                      >
                        {theme.effects.particles && (
                          <div className="absolute inset-0">
                            {Array.from({ length: 5 }, (_, i) => (
                              <div
                                key={i}
                                className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
                                style={{
                                  left: `${20 + i * 15}%`,
                                  top: `${30 + (i % 2) * 20}%`,
                                  animationDelay: `${i * 0.5}s`,
                                }}
                              />
                            ))}
                          </div>
                        )}
                        {isActive && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-green-500 text-white">
                              Active
                            </Badge>
                          </div>
                        )}
                      </div>

                      <h3 className="font-semibold mb-2">{theme.name}</h3>

                      <div className="flex items-center justify-between mb-3">
                        <div className="flex space-x-1">
                          {theme.effects.glow && (
                            <Zap className="w-4 h-4 text-yellow-500" />
                          )}
                          {theme.effects.particles && (
                            <Sparkles className="w-4 h-4 text-purple-500" />
                          )}
                          {theme.effects.animations && (
                            <Eye className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        {theme.is_premium && (
                          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                            <Crown className="w-3 h-3 mr-1" />
                            Premium
                          </Badge>
                        )}
                      </div>
                      {isOwnProfile ? (
                        <div className="flex space-x-2">
                          {isOwned ? (
                            <Button
                              onClick={() => handleThemeActivation(theme.id)}
                              disabled={isActive}
                              className={
                                isActive
                                  ? "bg-green-500"
                                  : "bg-gradient-to-r from-purple-500 to-blue-500"
                              }
                            >
                              {isActive ? "Active" : "Activate"}
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleThemePurchase(theme.id)}
                              className="bg-gradient-to-r from-purple-500 to-blue-500"
                            >
                              {theme.price ? (
                                <>
                                  <Coins className="w-4 h-4 mr-1" />
                                  {theme.price}
                                </>
                              ) : (
                                "Free"
                              )}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="text-center">
                          <p className="text-sm text-gray-500">
                            {isOwned
                              ? "Owned"
                              : theme.price
                              ? `${theme.price} coins`
                              : "Free"}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="likes" className="mt-6">
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                No liked loops
              </h3>
              <p className="text-gray-500 dark:text-gray-500">
                Liked loops will appear here
              </p>
            </div>
          </TabsContent>

          <TabsContent value="media" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
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

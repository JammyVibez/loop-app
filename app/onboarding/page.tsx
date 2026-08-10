"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TreePine, Camera, Palette, Users, Sparkles, ArrowRight, Check, UserPlus, Home, Video } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { uploadMediaFile } from "@/lib/client-media-upload";

interface SuggestedUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string
  is_verified?: boolean
  reason?: string
}

interface SuggestedCircle {
  id: string
  name: string
  description?: string
  member_count?: number
  avatar_url?: string
}

const INTERESTS = [
  "Art & Design",
  "Technology",
  "Writing",
  "Music",
  "Photography",
  "Gaming",
  "Science",
  "Business",
  "Education",
  "Health",
  "Travel",
  "Food",
  "Fashion",
  "Sports",
  "Movies",
  "Books",
  "Nature",
  "DIY",
]

const THEMES = [
  {
    name: "Purple Dream",
    primary: "#8B5CF6",
    secondary: "#06B6D4",
    preview: "bg-gradient-to-r from-purple-500 to-blue-500",
  },
  {
    name: "Ocean Breeze",
    primary: "#0EA5E9",
    secondary: "#10B981",
    preview: "bg-gradient-to-r from-blue-500 to-emerald-500",
  },
  {
    name: "Sunset Glow",
    primary: "#F59E0B",
    secondary: "#EF4444",
    preview: "bg-gradient-to-r from-amber-500 to-red-500",
  },
  {
    name: "Forest Green",
    primary: "#10B981",
    secondary: "#059669",
    preview: "bg-gradient-to-r from-emerald-500 to-green-600",
  },
  {
    name: "Rose Gold",
    primary: "#EC4899",
    secondary: "#F97316",
    preview: "bg-gradient-to-r from-pink-500 to-orange-500",
  },
  {
    name: "Midnight",
    primary: "#6366F1",
    secondary: "#8B5CF6",
    preview: "bg-gradient-to-r from-indigo-500 to-purple-500",
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [profileData, setProfileData] = useState({
    bio: "",
    interests: [] as string[],
    theme: THEMES[0],
    avatar_url: "",
    goals: [] as string[],
  })
  const { user, refreshUser, getAuthHeader, applyServerProfile } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // "First win" data for the final step — real suggestions seeded from the
  // interests just picked, not canned/mock accounts.
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>([])
  const [suggestedCircles, setSuggestedCircles] = useState<SuggestedCircle[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [joinedCircleIds, setJoinedCircleIds] = useState<Set<string>>(new Set())
  const [loadingFirstWin, setLoadingFirstWin] = useState(false)

  useEffect(() => {
    if (step !== 5 || !user) return
    setLoadingFirstWin(true)
    Promise.all([
      fetch("/api/users/suggestions?limit=4", { headers: { ...getAuthHeader() } })
        .then((r) => (r.ok ? r.json() : { suggestions: [] }))
        .catch(() => ({ suggestions: [] })),
      fetch("/api/circles?limit=3", { headers: { ...getAuthHeader() } })
        .then((r) => (r.ok ? r.json() : { circles: [] }))
        .catch(() => ({ circles: [] })),
    ]).then(([usersData, circlesData]) => {
      setSuggestedUsers(usersData.suggestions || [])
      setSuggestedCircles(circlesData.circles || [])
      setLoadingFirstWin(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user])

  const handleFollow = async (targetId: string) => {
    try {
      const res = await fetch("/api/users/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({ target_user_id: targetId, action: "follow" }),
      })
      if (res.ok) setFollowedIds((prev) => new Set(prev).add(targetId))
    } catch {
      /* non-blocking */
    }
  }

  const handleJoinCircle = async (circleId: string) => {
    try {
      const res = await fetch(`/api/circles/${circleId}/join`, {
        method: "POST",
        headers: { ...getAuthHeader() },
      })
      if (res.ok) setJoinedCircleIds((prev) => new Set(prev).add(circleId))
    } catch {
      /* non-blocking */
    }
  }

  const handleInterestToggle = (interest: string) => {
    setProfileData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }))
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const uploaded = await uploadMediaFile(file, {
        type: "image",
        folder: "avatars",
        authHeaders: getAuthHeader(),
      })
      setProfileData(prev => ({ ...prev, avatar_url: uploaded.url }))
    } catch (error) {
      console.error("Avatar upload failed:", error)
    }
  }

  const finishOnboarding = async (payload: Record<string, unknown>, awardBonus: boolean) => {
    setSaving(true)
    setErrors({})

    try {
      const response = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          ...payload,
          onboarding_completed: true,
        }),
      })

      try {
        localStorage.setItem(
          "loop-onboarding-personalization",
          JSON.stringify({ interests: profileData.interests, goals: profileData.goals }),
        )
      } catch {}

      if (!response.ok) {
        throw new Error("Failed to save profile")
      }

      const result = await response.json()

      if (result.profile) {
        applyServerProfile({ ...result.profile, onboarding_completed: true })
      } else {
        applyServerProfile({ onboarding_completed: true })
      }

      if (awardBonus) {
        await fetch("/api/users/coins/weekly", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({
            type: "onboarding_bonus",
          }),
        }).catch(() => null)
      }

      await refreshUser()
      router.replace("/")
    } catch (error) {
      console.error("Failed to complete onboarding:", error)
      setErrors({ general: "Failed to complete onboarding. Please try again." })
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    await finishOnboarding({}, false)
  }

  const handleComplete = async () => {
    if (!profileData.bio.trim()) {
      setErrors({ bio: "Bio is required" })
      return
    }

    await finishOnboarding(
      {
        bio: profileData.bio,
        interests: profileData.interests,
        avatar_url: profileData.avatar_url,
        profile_theme: {
          primary_color: profileData.theme.primary,
          secondary_color: profileData.theme.secondary,
          animation: "pulse-glow",
        },
      },
      true,
    )
  }


  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <Card className="w-full max-w-2xl landing-card-3d border-white/10 bg-[#0a1020]/90 text-slate-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <TreePine className="text-white w-8 h-8" />
              </div>
              <CardTitle className="text-3xl">Welcome to Loop!</CardTitle>
              <CardDescription className="text-lg">
                Let's set up your profile to help you connect with the right community
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="relative inline-block">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={profileData.avatar_url || user?.avatar_url || "/placeholder.svg"} />
                    <AvatarFallback className="text-2xl">{user?.display_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <Button 
                    size="icon" 
                    className="absolute -bottom-2 -right-2 rounded-full w-8 h-8" 
                    variant="secondary"
                    onClick={() => document.getElementById('onboarding-avatar-upload')?.click()}
                  >
                    <Camera className="w-4 h-4" />
                  </Button>
                  <input
                    id="onboarding-avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                </div>
                <h3 className="text-xl font-semibold mt-4">{user?.display_name}</h3>
                <p className="text-gray-600 dark:text-gray-400">@{user?.username}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Tell us about yourself</Label>
                <Textarea
                  id="bio"
                  placeholder="Share what inspires you, your creative interests, or what you hope to discover on Loop..."
                  value={profileData.bio}
                  onChange={(e) => setProfileData((prev) => ({ ...prev, bio: e.target.value }))}
                  className="min-h-[100px]"
                />
              </div>

              <Button onClick={() => setStep(2)} className="w-full" size="lg">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )

      case 2:
        return (
          <Card className="w-full max-w-2xl landing-card-3d border-white/10 bg-[#0a1020]/90 text-slate-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <CardHeader className="text-center">
              <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">What interests you?</CardTitle>
              <CardDescription>
                Select topics you're passionate about to discover relevant loops and communities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {INTERESTS.map((interest) => (
                  <Badge
                    key={interest}
                    variant={profileData.interests.includes(interest) ? "default" : "outline"}
                    className={`cursor-pointer p-3 text-center justify-center transition-all ${
                      profileData.interests.includes(interest)
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700" :"hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => handleInterestToggle(interest)}
                  >
                    {profileData.interests.includes(interest) && <Check className="w-3 h-3 mr-1" />}
                    {interest}
                  </Badge>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(3)} className="flex-1" disabled={profileData.interests.length === 0}>
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 3:
        return (
          <Card className="w-full max-w-2xl landing-card-3d border-white/10 bg-[#0a1020]/90 text-slate-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <CardHeader className="text-center">
              <Palette className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">Choose your theme</CardTitle>
              <CardDescription>Personalize your profile with a color theme that represents you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {THEMES.map((theme) => (
                  <div
                    key={theme.name}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                      profileData.theme.name === theme.name
                        ? "border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800" :"border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => setProfileData((prev) => ({ ...prev, theme }))}
                  >
                    <div className={`w-full h-16 rounded-md ${theme.preview} mb-3`} />
                    <p className="font-medium text-center">{theme.name}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  Back
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 4:
        return (
          <Card className="w-full max-w-2xl landing-card-3d border-white/10 bg-[#0a1020]/90 text-slate-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <CardHeader className="text-center">
              <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">Personalize your start</CardTitle>
              <CardDescription>Tell Loop what you want to do first so we can tune your feed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {["Discover creators", "Share stories", "Join circles", "Collaborate on trees", "Watch reels", "Host events"].map((goal) => {
                  const active = profileData.goals.includes(goal)
                  return (
                    <Badge
                      key={goal}
                      variant={active ? "default" : "outline"}
                      className={`cursor-pointer justify-center p-3 ${active ? "bg-gradient-to-r from-violet-600 to-cyan-500" : ""}`}
                      onClick={() =>
                        setProfileData((prev) => ({
                          ...prev,
                          goals: active ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal],
                        }))
                      }
                    >
                      {active && <Check className="mr-1 h-3 w-3" />}
                      {goal}
                    </Badge>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                <Button onClick={() => setStep(5)} className="flex-1" disabled={profileData.goals.length === 0}>
                  Continue <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      case 5:
        return (
          <Card className="w-full max-w-2xl landing-card-3d border-white/10 bg-[#0a1020]/90 text-slate-100 shadow-2xl shadow-violet-950/30 backdrop-blur-xl">
            <CardHeader className="text-center">
              <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <CardTitle className="text-2xl">You're all set!</CardTitle>
              <CardDescription>Get your first win in — follow a few creators and join a circle.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {loadingFirstWin ? (
                <p className="text-center text-sm text-slate-400">Finding people and circles for you…</p>
              ) : (
                <>
                  {suggestedUsers.length > 0 && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                        <UserPlus className="h-4 w-4 text-violet-400" /> Creators picked for you
                      </h3>
                      <div className="space-y-2">
                        {suggestedUsers.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar className="h-9 w-9">
                                <AvatarImage src={u.avatar_url} />
                                <AvatarFallback>{(u.display_name || u.username).charAt(0).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{u.display_name || u.username}</p>
                                <p className="truncate text-xs text-slate-400">{u.reason || `@${u.username}`}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant={followedIds.has(u.id) ? "secondary" : "outline"}
                              className="shrink-0 rounded-full"
                              disabled={followedIds.has(u.id)}
                              onClick={() => handleFollow(u.id)}
                            >
                              {followedIds.has(u.id) ? <Check className="h-3.5 w-3.5" /> : "Follow"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestedCircles.length > 0 && (
                    <div>
                      <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-200">
                        <Users className="h-4 w-4 text-cyan-400" /> Join a circle
                      </h3>
                      <div className="space-y-2">
                        {suggestedCircles.slice(0, 2).map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{c.name}</p>
                              <p className="truncate text-xs text-slate-400">
                                {c.member_count ? `${c.member_count} members` : c.description || "Community circle"}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant={joinedCircleIds.has(c.id) ? "secondary" : "outline"}
                              className="shrink-0 rounded-full"
                              disabled={joinedCircleIds.has(c.id)}
                              onClick={() => handleJoinCircle(c.id)}
                            >
                              {joinedCircleIds.has(c.id) ? <Check className="h-3.5 w-3.5" /> : "Join"}
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="rounded-2xl border border-dashed border-violet-500/30 bg-violet-500/[0.06] p-4 text-center">
                <p className="text-sm font-medium text-slate-200">Ready to share something?</p>
                <p className="mt-0.5 text-xs text-slate-400">Your first Loop or Reel gets you into the feed instantly.</p>
                <div className="mt-3 flex justify-center gap-2">
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link href="/create/loop"><Home className="mr-1.5 h-3.5 w-3.5" /> First Loop</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link href="/create/reel"><Video className="mr-1.5 h-3.5 w-3.5" /> First Reel</Link>
                  </Button>
                </div>
              </div>

              {errors.general && (
                <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {errors.general}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(4)} className="flex-1">Back</Button>
                <Button onClick={handleComplete} className="flex-1 rounded-full bg-gradient-to-r from-violet-600 to-cyan-500" disabled={saving}>
                  {saving ? "Saving..." : "Enter Loop"} <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-slate-100 flex items-center justify-center p-4">
      <div className="landing-grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="landing-aurora-blob pointer-events-none absolute -left-1/4 top-[-20%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.45),transparent_65%)] blur-3xl" />
      <div className="landing-aurora-blob pointer-events-none absolute -right-1/4 top-[10%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.35),transparent_65%)] blur-3xl [animation-delay:-6s]" />
      <div className="relative z-10 w-full flex flex-col items-center">
        {/* Progress indicator */}
        <div className="flex items-center space-x-2 mb-8">
          {[1, 2, 3, 4, 5].map((stepNumber) => (
            <div key={stepNumber} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= stepNumber
                    ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white" :"bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}
              >
                {step > stepNumber ? <Check className="w-4 h-4" /> : stepNumber}
              </div>
              {stepNumber < 5 && (
                <div
                  className={`w-8 h-0.5 sm:w-12 ${
                    step > stepNumber ? "bg-gradient-to-r from-purple-600 to-blue-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {renderStep()}

        <div className="mt-6 flex w-full max-w-2xl justify-center">
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-slate-100"
            onClick={handleSkip}
            disabled={saving}
          >
            Skip for now — enter Loop
          </Button>
        </div>
      </div>
    </div>
  )
}
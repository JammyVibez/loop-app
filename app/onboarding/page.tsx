"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useAuth } from "@/hooks/use-auth"
import { PageLoading } from "@/components/loading-states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AppLogo } from "@/components/brand/app-logo"
import { Spinner } from "@/components/ui/skeletons"
import { CommunityCard, type CommunityCardData } from "@/components/onboarding/community-card"
import { getDiceBearUrl } from "@/lib/dicebear"
import { cn } from "@/lib/utils"
import {
  BIO_MAX,
  FOLLOW_MIN,
  INTEREST_CATALOG,
  ONBOARDING_STEPS,
  canAdvance,
  onboardingProgress,
  onboardingSummary,
  primaryLabel,
  sanitizeUsername,
  stepAt,
  validateDisplayName,
  validateUsername,
  type AdvanceState,
  type OnboardingStepId,
} from "@/lib/onboarding"
import {
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  Compass,
  Flame,
  MessageCircle,
  Search,
  Users,
} from "lucide-react"

interface Suggestion {
  id: string
  username: string
  display_name?: string | null
  avatar_url?: string | null
  is_verified?: boolean
  is_admin?: boolean
  reason?: string
}

interface CommunitySuggestion {
  id: string
  name: string
  description?: string | null
  avatar_url?: string | null
  member_count?: number
  is_member?: boolean
  is_private?: boolean
  category?: string | null
}

const PRONOUN_OPTIONS = ["he/him", "she/her", "they/them", "she/they", "he/they", "ze/zir"]

const WELCOME_HIGHLIGHTS = [
  { icon: Flame, title: "A feed tuned to you", body: "Pick interests and Loop surfaces the people and posts that fit." },
  { icon: Users, title: "Communities with depth", body: "Threads, live chat, events, and shared projects in every space." },
  { icon: MessageCircle, title: "Real conversations", body: "Follow the voices you care about and never miss a reply." },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading, refreshUser, getAuthHeader } = useAuth()
  const reduceMotion = useReducedMotion()

  const [stepId, setStepId] = useState<OnboardingStepId>("welcome")
  const [direction, setDirection] = useState(1)

  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [pronouns, setPronouns] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [interests, setInterests] = useState<string[]>([])

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [requested, setRequested] = useState<Set<string>>(new Set())

  const [communities, setCommunities] = useState<CommunitySuggestion[]>([])
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(new Set())
  const [pendingCommunities, setPendingCommunities] = useState<Set<string>>(new Set())

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const step = useMemo(() => stepAt(ONBOARDING_STEPS.findIndex((s) => s.id === stepId)), [stepId])

  const followingCount = following.size + requested.size
  const joinedCount = joinedCommunities.size + pendingCommunities.size

  const advanceState: AdvanceState = useMemo(
    () => ({ displayName, username, interests, followingCount }),
    [displayName, username, interests, followingCount],
  )
  const canContinue = canAdvance(stepId, advanceState)

  // Prefill from the session profile once it loads.
  useEffect(() => {
    if (!user) return
    const prefillName = user.display_name || ""
    const prefillUsername = user.username || ""
    const prefillBio = typeof user.bio === "string" ? user.bio : ""
    const prefillPronouns = typeof user.pronouns === "string" ? user.pronouns : ""
    const prefillInterests = Array.isArray(user.interests) ? user.interests.map(String) : []
    const prefillAvatar = user.avatar_url || ""
    if (prefillName) setDisplayName((prev) => prev || prefillName)
    if (prefillUsername) setUsername((prev) => prev || prefillUsername)
    if (prefillBio) setBio((prev) => prev || prefillBio)
    if (prefillPronouns) setPronouns((prev) => prev || prefillPronouns)
    if (prefillInterests.length > 0) setInterests((prev) => (prev.length ? prev : prefillInterests))
    if (prefillAvatar) setAvatarUrl((prev) => prev || prefillAvatar)
  }, [user])

  // Already onboarded? Straight to the feed.
  useEffect(() => {
    if (!loading && user && user.onboarding_completed === true) {
      router.replace("/")
    }
  }, [loading, user, router])

  // Load follow suggestions when that step comes into view.
  useEffect(() => {
    if (stepId !== "follow" || suggestions.length > 0) return
    let cancelled = false
    setSuggestLoading(true)
    fetch("/api/users/suggestions?limit=6")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : [])
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setSuggestLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [stepId, suggestions.length])

  // Load community suggestions for the final question — popular circles plus
  // any that match the interests picked a step earlier.
  useEffect(() => {
    if (stepId !== "communities" || communities.length > 0) return
    let cancelled = false
    setCommunitiesLoading(true)

    const urls = ["/api/circles?limit=8"]
    for (const interest of interests.slice(0, 2)) {
      urls.push(`/api/circles?limit=4&search=${encodeURIComponent(interest)}`)
    }

    Promise.all(
      urls.map((url) =>
        fetch(url)
          .then((res) => res.json())
          .then((data) => (Array.isArray(data?.circles) ? data.circles : []))
          .catch(() => []),
      ),
    )
      .then((lists) => {
        if (cancelled) return
        const byId = new Map<string, CommunitySuggestion>()
        for (const list of lists) {
          for (const circle of list as CommunitySuggestion[]) {
            if (circle?.id && !byId.has(circle.id)) byId.set(circle.id, circle)
          }
        }
        setCommunities(Array.from(byId.values()).slice(0, 12))
      })
      .finally(() => {
        if (!cancelled) setCommunitiesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [stepId, interests, communities.length])

  const goTo = useCallback(
    (id: OnboardingStepId) => {
      const from = ONBOARDING_STEPS.findIndex((s) => s.id === stepId)
      const to = ONBOARDING_STEPS.findIndex((s) => s.id === id)
      setDirection(to >= from ? 1 : -1)
      setError(null)
      setStepId(id)
    },
    [stepId],
  )

  const goNext = useCallback(() => {
    const index = ONBOARDING_STEPS.findIndex((s) => s.id === stepId)
    const next = ONBOARDING_STEPS[Math.min(index + 1, ONBOARDING_STEPS.length - 1)]
    setDirection(1)
    setError(null)
    setStepId(next.id)
  }, [stepId])

  const goBack = useCallback(() => {
    const index = ONBOARDING_STEPS.findIndex((s) => s.id === stepId)
    if (index <= 0) return
    setDirection(-1)
    setError(null)
    setStepId(ONBOARDING_STEPS[index - 1].id)
  }, [stepId])

  const toggleInterest = useCallback((label: string) => {
    setInterests((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]))
  }, [])

  const handleAvatarUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return
      setUploadingAvatar(true)
      setError(null)
      try {
        const { uploadMediaFile } = await import("@/lib/client-media-upload")
        const uploaded = await uploadMediaFile(file, {
          type: "image",
          folder: "avatars",
          authHeaders: getAuthHeader(),
        })
        setAvatarUrl(uploaded.url)
      } catch {
        setError("Couldn't upload that image — try another one.")
      } finally {
        setUploadingAvatar(false)
      }
    },
    [getAuthHeader],
  )

  const saveProfile = useCallback(async (): Promise<boolean> => {
    setError(null)
    const cleanName = displayName.trim()
    const cleanUsername = sanitizeUsername(username)
    const nameError = validateDisplayName(cleanName)
    if (nameError) {
      setError(nameError)
      return false
    }
    const usernameError = validateUsername(cleanUsername)
    if (usernameError) {
      setError(usernameError)
      return false
    }
    setSaving(true)
    try {
      const res = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: cleanName,
          username: cleanUsername,
          bio: bio.trim() || null,
          pronouns: pronouns || null,
          ...(avatarUrl && !avatarUrl.startsWith("https://api.dicebear.com") ? { avatar_url: avatarUrl } : {}),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Couldn't save your profile — try again.")
        return false
      }
      return true
    } catch {
      setError("Network error — check your connection and try again.")
      return false
    } finally {
      setSaving(false)
    }
  }, [displayName, username, bio, pronouns, avatarUrl])

  const handleFollow = useCallback(
    async (target: Suggestion) => {
      if (following.has(target.id) || requested.has(target.id)) return
      // Optimistic: the button flips instantly and reverts only on a hard fail.
      setFollowing((prev) => new Set(prev).add(target.id))
      try {
        const res = await fetch("/api/users/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_user_id: target.id, action: "follow" }),
        })
        const data = await res.json().catch(() => ({}))
        if (data?.requires_approval) {
          setFollowing((prev) => {
            const next = new Set(prev)
            next.delete(target.id)
            return next
          })
          setRequested((prev) => new Set(prev).add(target.id))
        } else if (!res.ok) {
          setFollowing((prev) => {
            const next = new Set(prev)
            next.delete(target.id)
            return next
          })
        }
      } catch {
        setFollowing((prev) => {
          const next = new Set(prev)
          next.delete(target.id)
          return next
        })
      }
    },
    [following, requested],
  )

  const handleJoinCommunity = useCallback(
    async (community: CommunitySuggestion) => {
      if (joinedCommunities.has(community.id) || pendingCommunities.has(community.id)) return
      try {
        const res = await fetch(`/api/circles/${community.id}/join`, { method: "POST" })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) return
        if (data?.status === "pending" || community.is_private) {
          setPendingCommunities((prev) => new Set(prev).add(community.id))
        } else {
          setJoinedCommunities((prev) => new Set(prev).add(community.id))
        }
      } catch {
        // Joining is optional — never block the flow on it.
      }
    },
    [joinedCommunities, pendingCommunities],
  )

  const finish = useCallback(async () => {
    setError(null)
    setFinishing(true)
    try {
      const res = await fetch("/api/users/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interests: interests.slice(0, 8),
          onboarding_completed: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Couldn't finish setup — try again.")
        setFinishing(false)
        return
      }
      await refreshUser().catch(() => {})
      router.push("/")
    } catch {
      setError("Network error — check your connection and try again.")
      setFinishing(false)
    }
  }, [interests, refreshUser, router])

  const handlePrimary = useCallback(async () => {
    if (stepId === "profile") {
      const ok = await saveProfile()
      if (ok) goNext()
      return
    }
    if (stepId === "done") {
      await finish()
      return
    }
    goNext()
  }, [stepId, saveProfile, goNext, finish])

  const displayAvatar = avatarUrl || user?.avatar_url || getDiceBearUrl(user?.username || user?.id)
  const accountName = displayName.trim() || user?.display_name || user?.username || "You"
  const accountHandle = sanitizeUsername(username) || user?.username || "you"

  if (loading) {
    return <PageLoading message="Setting things up..." />
  }

  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
        animate: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
      }

  const stepNumber = ONBOARDING_STEPS.findIndex((s) => s.id === stepId) + 1

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col bg-background text-foreground">
      {/* Ambient theme glows — derived from the app's own tokens. */}
      <div className="pointer-events-none absolute -top-40 right-[-8rem] h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-12rem] left-[-8rem] h-[520px] w-[520px] rounded-full bg-primary/[0.06] blur-3xl" />

      {/* Top bar: back + progress + counter */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={goBack}
            disabled={stepNumber === 1 || saving || finishing}
            aria-label="Go back"
            className={cn("h-9 w-9 shrink-0 rounded-full", stepNumber === 1 && "opacity-0")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              initial={false}
              animate={{ width: `${Math.round(onboardingProgress(stepId) * 100)}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            />
          </div>

          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">
            {stepNumber}/{ONBOARDING_STEPS.length}
          </span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center px-4 pb-10 pt-6 sm:pt-10">
        <div className="flex w-full max-w-xl flex-1 flex-col">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={stepId}
              custom={direction}
              variants={slide}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: reduceMotion ? 0.15 : 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-1 flex-col"
            >
              <div className="mb-6">
                <h1 className="text-balance text-2xl font-extrabold tracking-tight sm:text-[32px] sm:leading-tight">
                  {step.title}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{step.subtitle}</p>
              </div>

              {error && (
                <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* welcome */}
              {stepId === "welcome" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                  <div className="flex items-center gap-3">
                    <AppLogo className="h-14 w-14 rounded-2xl shadow-lg shadow-primary/20" />
                    <div className="text-left">
                      <p className="text-xl font-extrabold leading-none tracking-tight">Loop</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-primary">
                        Social universe
                      </p>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 text-left">
                    {WELCOME_HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
                      <div
                        key={title}
                        className="flex items-start gap-3 rounded-2xl border border-border bg-card/70 p-4 backdrop-blur-sm"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* profile */}
              {stepId === "profile" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/70 p-4">
                    <div className="relative shrink-0">
                      <Avatar className="h-16 w-16 border border-border">
                        <AvatarImage src={displayAvatar || undefined} alt={accountName} />
                        <AvatarFallback className="bg-primary/15 text-lg font-bold text-primary">
                          {accountName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        onClick={() => document.getElementById("onboarding-avatar-upload")?.click()}
                        disabled={uploadingAvatar}
                        aria-label="Upload a profile photo"
                        className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border border-border shadow-md"
                      >
                        {uploadingAvatar ? <Spinner className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                      </Button>
                      <input
                        id="onboarding-avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{accountName}</p>
                      <p className="truncate text-xs text-muted-foreground">@{accountHandle}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        Add a photo — accounts with one get more replies.
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="display-name" className="text-sm font-medium">
                      Display name
                    </Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      maxLength={50}
                      autoComplete="name"
                      className="mt-1.5 h-11 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label htmlFor="username" className="text-sm font-medium">
                      Username
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        @
                      </span>
                      <Input
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(sanitizeUsername(e.target.value))}
                        placeholder="your_handle"
                        maxLength={20}
                        autoComplete="username"
                        className="h-11 rounded-xl pl-7"
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      3–20 characters. Lowercase letters, numbers, underscores.
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="bio" className="text-sm font-medium">
                      Bio <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id="bio"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="What are you about?"
                      maxLength={BIO_MAX}
                      rows={3}
                      className="mt-1.5 resize-none rounded-xl"
                    />
                    <p className="mt-1 text-right text-xs text-muted-foreground">
                      {bio.length}/{BIO_MAX}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">
                      Pronouns <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PRONOUN_OPTIONS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPronouns(pronouns === p ? "" : p)}
                          className={cn(
                            "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                            pronouns === p
                              ? "border-primary/50 bg-primary/10 text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* interests */}
              {stepId === "interests" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                    {INTEREST_CATALOG.map((topic) => {
                      const on = interests.includes(topic.label)
                      return (
                        <motion.button
                          key={topic.label}
                          type="button"
                          onClick={() => toggleInterest(topic.label)}
                          whileTap={{ scale: 0.97 }}
                          aria-pressed={on}
                          className={cn(
                            "relative flex h-24 flex-col items-start justify-between overflow-hidden rounded-2xl border p-3 text-left transition-colors",
                            on
                              ? "border-primary bg-primary/10 shadow-sm shadow-primary/20"
                              : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          <span className="text-2xl leading-none">{topic.emoji}</span>
                          <span className={cn("text-sm font-semibold", on && "text-primary")}>{topic.label}</span>
                          {on && (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 420, damping: 20 }}
                              className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                            >
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </motion.span>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {interests.length === 0
                      ? "Pick at least one to continue — or skip for now."
                      : `${interests.length} selected`}
                  </p>
                </div>
              )}

              {/* follow */}
              {stepId === "follow" && (
                <div className="space-y-3">
                  {suggestLoading && suggestions.length === 0 ? (
                    <div className="space-y-2.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 animate-pulse rounded-2xl border border-border bg-muted/40" />
                      ))}
                    </div>
                  ) : suggestions.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
                      <Compass className="h-6 w-6 text-primary" />
                      <p className="text-sm text-muted-foreground">Nothing to suggest yet — that&apos;s fine.</p>
                    </div>
                  ) : (
                    suggestions.map((s) => {
                      const isFollowing = following.has(s.id)
                      const isRequested = requested.has(s.id)
                      const name = s.display_name || s.username
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 p-3 transition-colors hover:border-primary/30"
                        >
                          <Avatar className="h-11 w-11 border border-border">
                            <AvatarImage src={s.avatar_url || undefined} alt={name} />
                            <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
                              {name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="truncate text-sm font-semibold">{name}</p>
                              {s.is_verified && (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                  ✓
                                </span>
                              )}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">@{s.username}</p>
                            {s.reason && <p className="mt-0.5 truncate text-[11px] text-primary/80">{s.reason}</p>}
                          </div>
                          <Button
                            size="sm"
                            variant={isFollowing || isRequested ? "outline" : "default"}
                            disabled={isFollowing || isRequested}
                            onClick={() => handleFollow(s)}
                            className={cn(
                              "shrink-0 rounded-full font-semibold",
                              isFollowing && "border-primary/40 bg-primary/10 text-primary",
                              isRequested && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                            )}
                          >
                            {isFollowing ? (
                              <>
                                <Check className="mr-1 h-3.5 w-3.5" /> Following
                              </>
                            ) : isRequested ? (
                              "Requested"
                            ) : (
                              "Follow"
                            )}
                          </Button>
                        </div>
                      )
                    })
                  )}
                  <p className="text-xs text-muted-foreground">
                    {followingCount < FOLLOW_MIN
                      ? `Follow at least ${FOLLOW_MIN} to unlock the best feed.`
                      : `Following ${followingCount} — your feed is filling up.`}
                  </p>
                </div>
              )}

              {/* communities */}
              {stepId === "communities" && (
                <div className="space-y-4">
                  {communitiesLoading && communities.length === 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-muted/40" />
                      ))}
                    </div>
                  ) : communities.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center">
                      <Compass className="h-6 w-6 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        No communities to show yet — head to Explore once you&apos;re in.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {communities.map((c, i) => (
                        <CommunityCard
                          key={c.id}
                          index={i}
                          community={c as CommunityCardData}
                          joined={joinedCommunities.has(c.id)}
                          pending={pendingCommunities.has(c.id)}
                          onJoin={() => handleJoinCommunity(c)}
                        />
                      ))}
                    </div>
                  )}
                  {joinedCount > 0 && (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <Check className="h-3.5 w-3.5" />
                      {joinedCount} {joinedCount === 1 ? "community" : "communities"} joined
                    </p>
                  )}
                </div>
              )}

              {/* done */}
              {stepId === "done" && (
                <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
                  <motion.div
                    initial={reduceMotion ? { opacity: 0 } : { scale: 0.5, opacity: 0 }}
                    animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30"
                  >
                    <Check className="h-9 w-9" strokeWidth={3} />
                  </motion.div>

                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card/70 px-4 py-3">
                    <Avatar className="h-11 w-11 border border-border">
                      <AvatarImage src={displayAvatar || undefined} alt={accountName} />
                      <AvatarFallback className="bg-primary/15 font-bold text-primary">
                        {accountName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-sm font-bold">{accountName}</p>
                      <p className="text-xs text-muted-foreground">@{accountHandle}</p>
                    </div>
                  </div>

                  <div className="grid w-full grid-cols-3 gap-3">
                    {onboardingSummary({ interests, followingCount, joinedCount }).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-border bg-card/70 px-2 py-3">
                        <p className="text-xl font-extrabold tabular-nums text-primary">{item.value}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>

                  {interests.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {interests.slice(0, 8).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* nav */}
              <div className="mt-8 space-y-3 pt-2">
                <Button
                  type="button"
                  size="lg"
                  onClick={handlePrimary}
                  disabled={!canContinue || saving || finishing}
                  className="h-12 w-full rounded-full text-base font-bold shadow-lg shadow-primary/20"
                >
                  {saving || finishing ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  {finishing ? "Finishing..." : primaryLabel(stepId, advanceState)}
                  {!saving && !finishing && stepId !== "profile" && stepId !== "done" && (
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  )}
                </Button>

                {step.optional && (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={saving || finishing}
                    className="mx-auto block text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Skip for now
                  </button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Quiet footer link so the flow never feels like a dead end. */}
      <footer className="relative z-10 pb-6 text-center">
        <button
          type="button"
          onClick={() => router.push("/explore")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          Just browsing? Explore Loop first
        </button>
      </footer>
    </div>
  )
}

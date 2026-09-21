"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PageLoading } from "@/components/loading-states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Sparkles,
  Tags,
  UserPlus,
  UserRound,
} from "lucide-react"
import { AppLogo } from "@/components/brand/app-logo"
import { Spinner } from "@/components/ui/skeletons"
import { CommunityCard, type CommunityCardData } from "@/components/onboarding/community-card"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: 1, label: "Profile", icon: UserRound },
  { id: 2, label: "Interests", icon: Tags },
  { id: 3, label: "Follow", icon: UserPlus },
  { id: 4, label: "Communities", icon: Compass },
]

const INTEREST_OPTIONS = [
  "Gaming",
  "Tech",
  "Art & Design",
  "Music",
  "Sports",
  "Memes",
  "Anime",
  "Fitness",
  "Food",
  "Travel",
  "Fashion",
  "Coding",
  "Crypto & Web3",
  "Photography",
  "Books",
  "Films & TV",
]

const PRONOUN_OPTIONS = ["he/him", "she/her", "they/them", "she/they", "he/they", "ze/zir"]

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

export default function OnboardingPage() {
  const router = useRouter()
  const { user, loading, refreshUser } = useAuth()

  const [step, setStep] = useState(1)
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [pronouns, setPronouns] = useState("")
  const [interests, setInterests] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [requested, setRequested] = useState<Set<string>>(new Set())
  const [communities, setCommunities] = useState<CommunitySuggestion[]>([])
  const [joinedCommunities, setJoinedCommunities] = useState<Set<string>>(new Set())
  const [pendingCommunities, setPendingCommunities] = useState<Set<string>>(new Set())
  const [communitiesLoading, setCommunitiesLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Prefill from the session profile once loaded
  useEffect(() => {
    if (!user) return
    const prefillName = user.display_name || ""
    const prefillUsername = user.username || ""
    const prefillBio = typeof user.bio === "string" ? user.bio : ""
    const prefillPronouns = typeof user.pronouns === "string" ? user.pronouns : ""
    const prefillInterests = Array.isArray(user.interests) ? user.interests.map(String) : []
    if (prefillName) setDisplayName((prev) => prev || prefillName)
    if (prefillUsername) setUsername((prev) => prev || prefillUsername)
    if (prefillBio) setBio((prev) => prev || prefillBio)
    if (prefillPronouns) setPronouns((prev) => prev || prefillPronouns)
    if (prefillInterests.length > 0) setInterests((prev) => (prev.length ? prev : prefillInterests))
  }, [user])

  // Already onboarded? Go home.
  useEffect(() => {
    if (!loading && user && user.onboarding_completed === true) {
      router.replace("/")
    }
  }, [loading, user, router])

  // Load follow suggestions when reaching that step
  useEffect(() => {
    if (step !== 3 || suggestions.length > 0) return
    let cancelled = false
    fetch("/api/users/suggestions?limit=6")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSuggestions(data?.suggestions || [])
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
    return () => {
      cancelled = true
    }
  }, [step, suggestions.length])

  // Load community suggestions for the final step — popular circles plus any
  // that match the interests picked in step 2.
  useEffect(() => {
    if (step !== 4 || communities.length > 0) return
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
  }, [step, interests, communities.length])

  const toggleInterest = useCallback((tag: string) => {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }, [])

  const handleSaveProfile = useCallback(async () => {
    setError(null)
    const cleanName = displayName.trim()
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")
    if (!cleanName) {
      setError("Add a display name so people know who you are.")
      return
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setError("Username must be 3–20 characters (letters, numbers, underscores).")
      return
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
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Couldn't save your profile — try again.")
        return
      }
      setStep(2)
    } catch {
      setError("Network error — check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }, [displayName, username, bio, pronouns])

  const handleFollow = useCallback(
    async (target: Suggestion) => {
      if (following.has(target.id) || requested.has(target.id)) return
      try {
        const res = await fetch("/api/users/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_user_id: target.id, action: "follow" }),
        })
        const data = await res.json().catch(() => ({}))
        if (data?.requires_approval) {
          setRequested((prev) => new Set(prev).add(target.id))
        } else {
          setFollowing((prev) => new Set(prev).add(target.id))
        }
      } catch {
        // Non-fatal — user can still finish onboarding
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
        // Non-fatal — joining is optional
      }
    },
    [joinedCommunities, pendingCommunities],
  )

  const handleFinish = useCallback(async () => {
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

  const joinedCount = joinedCommunities.size + pendingCommunities.size
  const stepLabel = useMemo(() => STEPS[step - 1], [step])

  if (loading) {
    return <PageLoading message="Setting things up..." />
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background px-4 py-10 text-foreground">
      {/* Ambient theme glows — built from the app's own tokens, never a fixed palette. */}
      <div className="pointer-events-none absolute -top-40 right-[-6rem] h-[460px] w-[460px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 left-[-6rem] h-[460px] w-[460px] rounded-full bg-primary/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{
        backgroundImage:
          "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />

      <div className="relative z-10 mx-auto w-full max-w-xl">
        {/* brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <AppLogo className="h-11 w-11 rounded-2xl shadow-lg shadow-primary/20" />
            <div className="text-left">
              <p className="text-lg font-extrabold leading-none tracking-tight">loopapp.me</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Social OS</p>
            </div>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            Welcome to <span className="text-primary">Loop</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Set up your profile in a minute — the feed is waiting.
          </p>
        </div>

        {/* step progress */}
        <div className="mb-6 flex items-center justify-center gap-1.5">
          {STEPS.map((s) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold transition-all",
                    done
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : active
                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                        : "border-border bg-muted/40 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                  <span className={cn("hidden sm:inline", !active && !done && "sm:inline")}>{s.label}</span>
                </div>
                {s.id < STEPS.length && (
                  <div className={cn("h-px w-3 sm:w-5", step > s.id ? "bg-primary/50" : "bg-border")} />
                )}
              </div>
            )
          })}
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-foreground/[0.04] sm:p-8">
          {error && (
            <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Step 1 — profile */}
          {step === 1 && (
            <div className="space-y-5">
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
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_handle"
                  maxLength={20}
                  className="mt-1.5"
                />
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
                  maxLength={220}
                  rows={3}
                  className="mt-1.5 resize-none"
                />
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
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — interests */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Pick a few things you like — Loop uses them to shape your feed, suggest people, and match communities.
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((tag) => {
                  const on = interests.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all",
                        on
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                      {tag}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {interests.length === 0 ? "No interests selected yet — you can skip this." : `${interests.length} selected`}
              </p>
            </div>
          )}

          {/* Step 3 — follow people */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Follow a few people to fill your feed. You can always change this later.
              </p>
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <p className="text-sm text-muted-foreground">Nothing to suggest yet — that&apos;s fine.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {suggestions.map((s) => {
                    const isFollowing = following.has(s.id)
                    const isRequested = requested.has(s.id)
                    const name = s.display_name || s.username
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 transition-colors hover:border-primary/30"
                      >
                        <Avatar className="h-10 w-10 border border-border">
                          <AvatarImage src={s.avatar_url || undefined} alt={name} />
                          <AvatarFallback className="bg-primary/15 text-sm font-bold text-primary">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{name}</p>
                            {s.is_verified && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">@{s.username}</p>
                          {s.reason && <p className="mt-0.5 text-[11px] text-primary/80">{s.reason}</p>}
                        </div>
                        <Button
                          size="sm"
                          variant={isFollowing || isRequested ? "outline" : "default"}
                          disabled={isFollowing || isRequested}
                          onClick={() => handleFollow(s)}
                          className={cn(
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
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4 — communities (optional) */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Want to jump straight into a space? Join the communities you&apos;re into — totally optional, and
                you can leave any time.
              </p>

              {communitiesLoading && communities.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
                  <Spinner className="h-5 w-5 text-primary" />
                  <p className="text-sm text-muted-foreground">Finding communities for you…</p>
                </div>
              ) : communities.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center">
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
                <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                  <Check className="h-3 w-3" />
                  {joinedCount} {joinedCount === 1 ? "community" : "communities"} joined
                </Badge>
              )}
            </div>
          )}

          {/* nav */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || saving || finishing}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {step < 4 ? (
              <div className="flex items-center gap-2">
                {step >= 2 && (
                  <Button variant="ghost" onClick={() => setStep((s) => s + 1)} disabled={saving}>
                    Skip
                  </Button>
                )}
                <Button
                  onClick={step === 1 ? handleSaveProfile : () => setStep((s) => s + 1)}
                  disabled={saving}
                >
                  {saving ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  Continue <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={handleFinish} disabled={finishing}>
                  Skip
                </Button>
                <Button onClick={handleFinish} disabled={finishing}>
                  {finishing ? <Spinner className="mr-2 h-4 w-4" /> : null}
                  {finishing ? "Finishing..." : "Enter Loop"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Step {step} of {STEPS.length} · {stepLabel?.label}
        </p>
      </div>
    </div>
  )
}

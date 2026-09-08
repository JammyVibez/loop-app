"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { PageLoading } from "@/components/loading-states"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles, Tags, UserPlus, UserRound } from "lucide-react"
import { AppLogo } from "@/components/brand/app-logo"

const STEPS = [
  { id: 1, label: "Profile", icon: UserRound },
  { id: 2, label: "Interests", icon: Tags },
  { id: 3, label: "Follow", icon: UserPlus },
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

  // Load follow suggestions when reaching the last step
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

  if (loading) {
    return <PageLoading message="Setting things up..." />
  }

  const stepLabel = STEPS[step - 1]

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B0F19] px-4 py-10 relative overflow-hidden">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-[480px] w-[480px] rounded-full bg-violet-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[480px] w-[480px] rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-pink-600/10 blur-3xl" />

      <div className="relative w-full max-w-xl">
        {/* brand */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-3">
            <AppLogo className="h-11 w-11 rounded-2xl shadow-lg shadow-violet-500/20" />
            <div className="text-left">
              <p className="text-lg font-extrabold leading-none tracking-tight text-white">loopapp.me</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-violet-400">Social OS</p>
            </div>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            Welcome to <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">loopapp.me</span>
          </h1>
          <p className="text-sm text-slate-400">Set up your profile in a minute — the feed is waiting.</p>
        </div>

        {/* step progress */}
        <div className="mb-6 flex items-center justify-center gap-2">
          {STEPS.map((s) => {
            const done = step > s.id
            const active = step === s.id
            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                    done
                      ? "border-emerald-400 bg-emerald-400/15 text-emerald-300"
                      : active
                        ? "border-violet-400 bg-violet-500/20 text-violet-200 shadow-lg shadow-violet-500/20"
                        : "border-slate-700 bg-slate-900/60 text-slate-500"
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={`text-xs font-medium ${active ? "text-slate-200" : "text-slate-500"}`}>{s.label}</span>
                {s.id < STEPS.length && <div className={`h-px w-6 ${step > s.id ? "bg-emerald-400/50" : "bg-slate-700"}`} />}
              </div>
            )
          })}
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          {error && (
            <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Step 1 — profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="display-name" className="text-sm font-medium text-slate-300">
                  Display name
                </Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={50}
                  className="mt-1.5 border-white/10 bg-slate-900/60 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label htmlFor="username" className="text-sm font-medium text-slate-300">
                  Username
                </Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_handle"
                  maxLength={20}
                  className="mt-1.5 border-white/10 bg-slate-900/60 text-white placeholder:text-slate-500"
                />
                <p className="mt-1 text-xs text-slate-500">3–20 characters. Lowercase letters, numbers, underscores.</p>
              </div>
              <div>
                <Label htmlFor="bio" className="text-sm font-medium text-slate-300">
                  Bio <span className="text-slate-500">(optional)</span>
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What are you about?"
                  maxLength={220}
                  rows={3}
                  className="mt-1.5 resize-none border-white/10 bg-slate-900/60 text-white placeholder:text-slate-500"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-slate-300">Pronouns <span className="text-slate-500">(optional)</span></Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRONOUN_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPronouns(pronouns === p ? "" : p)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                        pronouns === p
                          ? "border-violet-400 bg-violet-500/20 text-violet-200"
                          : "border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/25 hover:text-slate-200"
                      }`}
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
              <p className="text-sm text-slate-400">
                Pick a few things you like — Loop uses them to shape your feed and suggest people.
              </p>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((tag) => {
                  const on = interests.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                        on
                          ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-md shadow-cyan-500/10"
                          : "border-white/10 bg-slate-900/50 text-slate-400 hover:border-white/25 hover:text-slate-200"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                      {tag}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-slate-500">
                {interests.length === 0 ? "No interests selected yet — you can skip this." : `${interests.length} selected`}
              </p>
            </div>
          )}

          {/* Step 3 — follow people */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">Follow a few people to fill your feed. You can always change this later.</p>
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-10 text-center">
                  <Sparkles className="h-6 w-6 text-violet-400" />
                  <p className="text-sm text-slate-400">Nothing to suggest yet — that's fine.</p>
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
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-3 transition-colors hover:border-white/20"
                      >
                        <Avatar className="h-10 w-10 border border-white/10">
                          <AvatarImage src={s.avatar_url || undefined} alt={name} />
                          <AvatarFallback className="bg-violet-500/30 text-sm font-bold text-violet-100">
                            {name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-white">{name}</p>
                            {s.is_verified && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white">
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slate-500">@{s.username}</p>
                          {s.reason && <p className="mt-0.5 text-[11px] text-violet-300/80">{s.reason}</p>}
                        </div>
                        <Button
                          size="sm"
                          variant={isFollowing || isRequested ? "outline" : "default"}
                          disabled={isFollowing || isRequested}
                          onClick={() => handleFollow(s)}
                          className={
                            isFollowing
                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                              : isRequested
                                ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                                : "bg-violet-500 hover:bg-violet-400 text-white"
                          }
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

          {/* nav */}
          <div className="mt-7 flex items-center justify-between gap-3 border-t border-white/5 pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || saving || finishing}
              className="text-slate-400 hover:text-white"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>

            {step < 3 ? (
              <Button
                onClick={step === 1 ? handleSaveProfile : () => setStep(3)}
                disabled={saving}
                className="bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-lg shadow-violet-500/25 hover:from-violet-400 hover:to-pink-400"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={finishing}
                className="bg-gradient-to-r from-violet-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/20 hover:from-violet-400 hover:to-cyan-300"
              >
                {finishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {finishing ? "Finishing..." : "Enter Loop"}
              </Button>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-slate-600">
          Step {step} of 3 · {stepLabel?.label}
        </p>
      </div>
    </div>
  )
}
"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/hooks/use-auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { Zap, Users, UserPlus, LogIn, Coins, CheckCircle2, ShieldCheck, ArrowRight, Loader2, Rocket, Eye, EyeOff } from "lucide-react"

interface CoLoopJoinLandingProps {
  sessionId: string
  invitedByUsername?: string
}

export function CoLoopJoinLanding({ sessionId, invitedByUsername }: CoLoopJoinLandingProps) {
  const { user, signup, login, getAuthHeader } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const invitedBy = invitedByUsername || searchParams.get("invitedBy") || searchParams.get("inviter") || ""
  const session = sessionId || searchParams.get("session") || "demo-session-1"

  const [inviter, setInviter] = useState<any>(null)
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [mode, setMode] = useState<"signup" | "login">("signup")

  // Form states
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  // Fetch inviter profile & session details
  useEffect(() => {
    async function loadInfo() {
      try {
        setLoadingInfo(true)
        const res = await fetch(`/api/co-loop/session-info?session=${encodeURIComponent(session)}&invitedBy=${encodeURIComponent(invitedBy)}`)
        const data = await res.json()
        if (data.inviter) {
          setInviter(data.inviter)
        }
      } catch (err) {
        console.error("Failed to load session info:", err)
      } finally {
        setLoadingInfo(false)
      }
    }
    loadInfo()
  }, [session, invitedBy])

  // If user is ALREADY logged in, automatically process invite & redirect to studio!
  useEffect(() => {
    if (user && session) {
      async function autoJoin() {
        try {
          // Trigger reward check if applicable
          if (inviter?.username && inviter.username !== user?.username) {
            await fetch("/api/co-loop/activate-reward", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeader(),
              },
              body: JSON.stringify({
                session_id: session,
                inviter_username: inviter.username,
                inviter_id: inviter.id,
              }),
            }).catch(() => undefined)
          }
        } catch (err) {
          console.error("Auto reward error:", err)
        } finally {
          const invBy = inviterUsername || invitedBy || ""
          router.replace(`/co-loop/studio?session=${encodeURIComponent(session)}&invited=true&activated=true${invBy ? `&invitedBy=${encodeURIComponent(invBy)}` : ""}`)
        }
      }
      autoJoin()
    }
  }, [user, session, inviter, router, getAuthHeader])

  const inviterName = inviter?.display_name || inviter?.username || invitedBy || "A Loop Creator"
  const inviterAvatar = inviter?.avatar_url || null
  const inviterUsername = inviter?.username || invitedBy

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters")
        return
      }
      if (username.length < 3) {
        setError("Username must be at least 3 characters")
        return
      }
    }

    setSubmitting(true)
    try {
      if (mode === "signup") {
        await signup(email, password, username, displayName, true, inviterUsername)
        toast({
          title: "Welcome to Loop! 🎉",
          description: `Account created! Entering Co-Loop studio with ${inviterName}...`,
        })
      } else {
        await login(email, password)
        toast({
          title: "Logged in! 🚀",
          description: `Welcome back! Joining Co-Loop studio with ${inviterName}...`,
        })
      }

      // Try triggering activation reward
      if (inviterUsername) {
        try {
          const authHeaders = getAuthHeader()
          if (authHeaders.Authorization || authHeaders.authorization) {
            const rewardRes = await fetch("/api/co-loop/activate-reward", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...authHeaders,
              },
              body: JSON.stringify({
                session_id: session,
                inviter_username: inviterUsername,
                inviter_id: inviter?.id,
              }),
            })
            const rewardData = await rewardRes.json()
            if (rewardData.success) {
              toast({
                title: "🎉 Collaboration Bonus Unlocked!",
                description: `You and @${inviterUsername} both earned +50 Loop Coins!`,
              })
            }
          }
        } catch (rErr) {
          console.warn("Reward activation attempt:", rErr)
        }
      }

      // Route directly to studio with inviter context
      const invBy = inviterUsername || invitedBy || ""
      router.push(`/co-loop/studio?session=${encodeURIComponent(session)}&invited=true&activated=true${invBy ? `&invitedBy=${encodeURIComponent(invBy)}` : ""}`)
    } catch (err: any) {
      setError(err.message || "Authentication failed. Please check your details.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-[90vh] overflow-hidden bg-[#030712] text-slate-100 flex items-center justify-center p-4 py-12">
      {/* Dynamic Background Effects */}
      <div className="landing-grid-bg pointer-events-none absolute inset-0 opacity-40" />
      <div className="landing-aurora-blob pointer-events-none absolute -left-1/4 top-[-10%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.45),transparent_65%)] blur-3xl" />
      <div className="landing-aurora-blob pointer-events-none absolute -right-1/4 top-[20%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.35),transparent_65%)] blur-3xl [animation-delay:-6s]" />

      <Card className="relative z-10 w-full max-w-lg border-cyan-500/30 bg-[#0a1020]/95 text-slate-100 shadow-2xl shadow-cyan-950/40 backdrop-blur-xl">
        <CardHeader className="space-y-3 text-center pb-4">
          <div className="flex justify-center">
            <Badge className="bg-gradient-to-r from-cyan-500 to-violet-600 text-white border-none px-3 py-1 font-bold shadow-lg shadow-cyan-500/20 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 animate-pulse" />
              Co-Loop Collaboration Invite
            </Badge>
          </div>

          {/* Inviter Profile Highlight Card */}
          <div className="mx-auto flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-purple-950/60 p-3.5 shadow-inner max-w-sm">
            <VideoAvatar src={inviterAvatar || undefined} className="h-12 w-12 border-2 border-cyan-400 shadow-md" fallback="
                {inviterName.slice(0, 2).toUpperCase()}
              " />
            <div className="text-left min-w-0 flex-1">
              <p className="text-xs text-cyan-300 font-semibold tracking-wider uppercase">Inviter</p>
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">{inviterName}</h3>
              {inviterUsername && <p className="text-xs text-slate-400 truncate">@{inviterUsername}</p>}
            </div>
            <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-bold shrink-0">
              <Coins className="w-3 h-3 mr-1 text-amber-400" />
              +50 Bonus
            </Badge>
          </div>

          <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {inviterName} invited you to collaborate!
          </CardTitle>

          <CardDescription className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-md mx-auto">
            Create a quick account to co-author and publish this Loop together in real time. Both of you earn <span className="font-bold text-amber-300">+50 Loop Coins</span> when activated!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Toggle Mode */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900/80 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => { setMode("signup"); setError("") }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Create Quick Account
            </button>
            <button
              type="button"
              onClick={() => { setMode("login"); setError("") }}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LogIn className="w-4 h-4" />
              Log In
            </button>
          </div>

          {error && (
            <Alert variant="destructive" className="bg-rose-950/80 border-rose-500/50 text-rose-200 text-xs">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-3">
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="displayName" className="text-xs text-slate-300">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder="e.g. Alex Smith"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      className="bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500 h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="username" className="text-xs text-slate-300">Username</Label>
                    <Input
                      id="username"
                      placeholder="e.g. alexsmith"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500 h-9 text-xs"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1">
              <Label htmlFor="email" className="text-xs text-slate-300">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500 h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-xs text-slate-300">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500 h-9 text-xs pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-xs text-slate-300">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-slate-900/90 border-white/10 text-white placeholder:text-slate-500 h-9 text-xs"
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white font-bold h-10 shadow-lg shadow-cyan-500/25 hover:opacity-95 transition-all text-sm mt-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {mode === "signup" ? "Creating Account..." : "Logging In..."}
                </>
              ) : mode === "signup" ? (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  Create Account & Join Co-Loop
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Log In & Enter Co-Loop
                </>
              )}
            </Button>
          </form>

          {/* Value props banner */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-200/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Real-time collaboration & instant co-author credit</span>
            </div>
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] shrink-0">
              +50 Coins
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="pt-0 justify-center">
          <p className="text-[11px] text-slate-400 text-center">
            By continuing, you agree to Loop&apos;s Community Guidelines and Terms of Service.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

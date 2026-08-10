"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"
import { Loader2, Eye, EyeOff } from "lucide-react"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { signup, googleSignIn } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const referrerUsername = searchParams.get("ref")?.trim().toLowerCase() || undefined

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

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

    setLoading(true)

    try {
      await signup(email, password, username, displayName, false, referrerUsername)
      router.push("/onboarding")
    } catch (err: any) {
      setError(err.message || "Failed to create account")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setLoading(true)
    setError("")
    try {
      await googleSignIn()
      // No need to push to verify-email here, as Google OAuth handles redirection
    } catch (err: any) {
      setError(err.message || "Failed to sign up with Google")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-[#030712] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
      <div className="landing-grid-bg pointer-events-none absolute inset-0 opacity-20 dark:opacity-40" />
      <div className="landing-aurora-blob pointer-events-none absolute -left-1/4 top-[-20%] h-[70vmin] w-[70vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.25),transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.45),transparent_65%)] blur-3xl" />
      <div className="landing-aurora-blob pointer-events-none absolute -right-1/4 top-[10%] h-[60vmin] w-[60vmin] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.2),transparent_65%)] dark:bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.35),transparent_65%)] blur-3xl [animation-delay:-6s]" />
      <Card className="relative z-10 w-full max-w-md landing-card-3d border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0a1020]/90 text-slate-900 dark:text-slate-100 shadow-xl dark:shadow-2xl dark:shadow-violet-950/30 backdrop-blur-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <span className="text-white font-bold text-xl">L</span>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Join Loop
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-300 font-medium">Create your account to start sharing your story</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-900 dark:text-slate-100 font-semibold">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-600 dark:placeholder:text-slate-400 placeholder:opacity-100 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-900 dark:text-slate-100 font-semibold">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                required
                className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-600 dark:placeholder:text-slate-400 placeholder:opacity-100 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Only lowercase letters, numbers, and underscores</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-slate-900 dark:text-slate-100 font-semibold">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-600 dark:placeholder:text-slate-400 placeholder:opacity-100 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-900 dark:text-slate-100 font-semibold">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-600 dark:placeholder:text-slate-400 placeholder:opacity-100 pr-10 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-900 dark:text-slate-100 font-semibold">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700 placeholder:text-slate-600 dark:placeholder:text-slate-400 placeholder:opacity-100 pr-10 transition-all duration-200 focus:ring-2 focus:ring-purple-500"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-violet-600 to-cyan-500 text-white font-semibold shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-cyan-400 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-300 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase font-medium">
                <span className="bg-white dark:bg-[#0a1020] px-2 text-slate-600 dark:text-slate-400">Or continue with</span>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full rounded-full border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-white/15 dark:bg-white/[0.03] dark:text-slate-100 dark:hover:bg-white/10 font-semibold" 
              onClick={handleGoogleSignup}
              disabled={loading}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="text-center text-sm text-slate-600 dark:text-slate-300 font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-purple-600 hover:text-purple-700 dark:text-purple-400 font-bold underline-offset-2 hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
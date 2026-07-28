"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

const supabase = getSupabaseBrowserClient()

interface User {
  id: string
  email: string
  username: string
  display_name: string
  avatar_url?: string
  banner_url?: string
  bio?: string
  loop_coins: number
  is_premium: boolean
  premium_expires_at?: string
  is_verified: boolean
  is_admin: boolean
  theme_data?: any
  theme_preferences?: any
  interests?: string[]
  phone?: string
  website?: string
  location?: string
  profile_theme?: any
  privacy_settings?: Record<string, unknown>
  notification_settings?: Record<string, unknown>
  verification_level?: string
  onboarding_completed?: boolean
  token?: string
  access_token?: string
  user_metadata?: {
    username: string
    display_name: string
    avatar_url?: string
    is_premium: boolean
    is_verified: boolean
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  googleSignIn: () => Promise<void>
  signup: (email: string, password: string, username: string, display_name: string) => Promise<void>
  logout: () => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  getAuthHeader: () => Record<string, string>
  updateProfile: (updates: Partial<User>) => Promise<void>
  updateUser: (updates: Partial<User>) => Promise<void>
  applyServerProfile: (profile: Partial<User> & Record<string, unknown>) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const userRef = useRef<User | null>(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  const buildFallbackProfile = (sessionUser: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>["user"]) => {
    const emailUsername = sessionUser.email?.split("@")[0] || "user"
    const metadata = sessionUser.user_metadata || {}
    const previous = userRef.current?.id === sessionUser.id ? userRef.current : null

    return {
      email: sessionUser.email,
      username: metadata.username || metadata.preferred_username || emailUsername,
      display_name: metadata.display_name || metadata.full_name || metadata.name || emailUsername,
      avatar_url: metadata.avatar_url,
      banner_url: undefined,
      bio: undefined,
      loop_coins: 0,
      is_premium: false,
      premium_expires_at: undefined,
      is_verified: false,
      is_admin: false,
      theme_data: undefined,
      interests: [],
      // Never reset a completed onboarding just because the profile read failed.
      onboarding_completed: previous?.onboarding_completed ?? false,
    }
  }

  const mapSessionUser = (
    session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>,
    profileData: Record<string, any>,
  ): User => {
    const previous = userRef.current?.id === session.user.id ? userRef.current : null
    const onboardingCompleted =
      typeof profileData.onboarding_completed === "boolean"
        ? profileData.onboarding_completed
        : previous?.onboarding_completed ?? false

    // Never demote a completed user because of a partial/stale profile read.
    const preservedOnboarding =
      previous?.onboarding_completed === true && onboardingCompleted !== true
        ? true
        : onboardingCompleted

    return {
      id: session.user.id,
      email: session.user.email || profileData.email || previous?.email || "",
      username: profileData.username || previous?.username || "",
      display_name: profileData.display_name || previous?.display_name || "",
      avatar_url: profileData.avatar_url ?? previous?.avatar_url,
      banner_url: profileData.banner_url ?? previous?.banner_url,
      bio: profileData.bio ?? previous?.bio,
      loop_coins: profileData.loop_coins ?? previous?.loop_coins ?? 0,
      is_premium: profileData.is_premium ?? previous?.is_premium ?? false,
      premium_expires_at: profileData.premium_expires_at ?? previous?.premium_expires_at,
      is_verified: profileData.is_verified ?? previous?.is_verified ?? false,
      is_admin: profileData.is_admin ?? previous?.is_admin ?? false,
      theme_data: profileData.theme_data ?? previous?.theme_data,
      theme_preferences: profileData.theme_preferences ?? previous?.theme_preferences,
      interests: profileData.interests ?? previous?.interests ?? [],
      phone: profileData.phone ?? previous?.phone,
      website: profileData.website ?? previous?.website,
      location: profileData.location ?? previous?.location,
      privacy_settings: profileData.privacy_settings ?? previous?.privacy_settings,
      notification_settings: profileData.notification_settings ?? previous?.notification_settings,
      onboarding_completed: preservedOnboarding,
      token: session.access_token,
      access_token: session.access_token,
      user_metadata: {
        username: profileData.username || previous?.username || "",
        display_name: profileData.display_name || previous?.display_name || "",
        avatar_url: profileData.avatar_url ?? previous?.avatar_url,
        is_premium: Boolean(profileData.is_premium ?? previous?.is_premium),
        is_verified: Boolean(profileData.is_verified ?? previous?.is_verified),
      },
    }
  }

  const fetchProfileViaApi = async (accessToken: string) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 4000)
      const response = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) return null
      const data = await response.json()
      return data.profile || null
    } catch (error) {
      console.error("API profile refresh failed:", error)
      return null
    }
  }

  const hydrateSessionUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setUser(null)
      return
    }

    // Set a provisional user immediately so profile pages never look "logged out"
    // while the profile round-trip is still in flight.
    if (!userRef.current || userRef.current.id !== session.user.id) {
      setUser(mapSessionUser(session, buildFallbackProfile(session.user)))
    } else {
      // Refresh tokens on the existing user object.
      setUser((prev) =>
        prev
          ? { ...prev, token: session.access_token, access_token: session.access_token }
          : prev,
      )
    }

    // Prefer the lightweight API (service role) with a timeout; fall back to client select.
    let profileData = await fetchProfileViaApi(session.access_token)

    if (!profileData) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3500)
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .abortSignal(controller.signal)
          .maybeSingle()
        clearTimeout(timeout)

        if (profileError) {
          console.error("Error fetching profile:", profileError)
        }
        profileData = (profile as Record<string, any> | null) || null
      } catch (error) {
        console.error("Client profile read timed out:", error)
      }
    }

    if (!profileData) {
      profileData = buildFallbackProfile(session.user)
    }

    setUser(mapSessionUser(session, profileData))
  }

  useEffect(() => {
    let cancelled = false
    const safety = setTimeout(() => {
      if (!cancelled) setLoading(false)
    }, 6000)

    const checkSession = async () => {
      try {
        await hydrateSessionUser()
      } catch (error) {
        console.error("Error checking session:", error)
      } finally {
        if (!cancelled) setLoading(false)
        clearTimeout(safety)
      }
    }

    checkSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Defer async work — awaiting getSession inside this callback can deadlock supabase-js.
      setTimeout(() => {
        void (async () => {
          try {
            if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
              if (session?.user) {
                const apiProfile = await fetchProfileViaApi(session.access_token)
                setUser(mapSessionUser(session, apiProfile || buildFallbackProfile(session.user)))
              } else {
                await hydrateSessionUser()
              }
            } else if (event === "SIGNED_OUT") {
              setUser(null)
            }
          } finally {
            if (!cancelled) setLoading(false)
          }
        })()
      }, 0)
    })

    return () => {
      cancelled = true
      clearTimeout(safety)
      subscription.unsubscribe()
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Login failed")
    }

    if (!data.session?.access_token || !data.session?.refresh_token) {
      throw new Error(data.error || "Login succeeded but no session was returned. Confirm your email and try again.")
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })

    if (sessionError) {
      throw new Error(sessionError.message || "Could not establish session")
    }

    const session = sessionData.session || data.session
    if (session?.user) {
      const profile = data.user || (await fetchProfileViaApi(session.access_token))
      setUser(mapSessionUser(session, profile || buildFallbackProfile(session.user)))
      setLoading(false)
    } else {
      await hydrateSessionUser()
      setLoading(false)
    }
  }

  const signup = async (email: string, password: string, username: string, display_name: string) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, username, display_name }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || "Signup failed")
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    setUser(null)
  }

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      throw error
    }
  }

  const refreshUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setUser(null)
      return
    }

    // Prefer API (service role) so onboarding_completed is never lost to RLS/client read issues.
    const apiProfile = await fetchProfileViaApi(session.access_token)
    if (apiProfile) {
      const mapped = mapSessionUser(session, apiProfile)
      const previous = userRef.current
      // Keep a locally-confirmed completion if a momentarily stale read says otherwise.
      if (
        previous?.id === mapped.id &&
        previous.onboarding_completed === true &&
        mapped.onboarding_completed !== true
      ) {
        mapped.onboarding_completed = true
      }
      setUser(mapped)
      return
    }

    await hydrateSessionUser()
  }

  const getAuthHeader = useCallback((): Record<string, string> => {
    const token = userRef.current?.access_token || userRef.current?.token
    if (!token) {
      return {}
    }

    return {
      Authorization: `Bearer ${token}`,
    }
  }, [])

  const applyServerProfile = (profile: Partial<User> & Record<string, unknown>) => {
    setUser((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        ...profile,
        id: prev.id,
        email: (profile.email as string) || prev.email,
        token: prev.token,
        access_token: prev.access_token,
        onboarding_completed:
          typeof profile.onboarding_completed === "boolean"
            ? profile.onboarding_completed
            : prev.onboarding_completed,
        user_metadata: {
          username: (profile.username as string) || prev.username,
          display_name: (profile.display_name as string) || prev.display_name,
          avatar_url: (profile.avatar_url as string | undefined) || prev.avatar_url,
          is_premium: Boolean(profile.is_premium ?? prev.is_premium),
          is_verified: Boolean(profile.is_verified ?? prev.is_verified),
        },
      }
    })
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return

    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id)

      if (error) throw error

      setUser({ ...user, ...updates })
    } catch (error) {
      console.error("Error updating profile:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        googleSignIn: loginWithGoogle,
        signup,
        logout,
        signOut: logout,
        refreshUser,
        getAuthHeader,
        updateProfile,
        updateUser: updateProfile,
        applyServerProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

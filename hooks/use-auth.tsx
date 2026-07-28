"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
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
  interests?: string[]
  phone?: string
  website?: string
  location?: string
  profile_theme?: any
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
  ): User => ({
    id: session.user.id,
    email: session.user.email || profileData.email || "",
    username: profileData.username,
    display_name: profileData.display_name,
    avatar_url: profileData.avatar_url,
    banner_url: profileData.banner_url,
    bio: profileData.bio,
    loop_coins: profileData.loop_coins ?? 0,
    is_premium: profileData.is_premium ?? false,
    premium_expires_at: profileData.premium_expires_at ?? undefined,
    is_verified: profileData.is_verified ?? false,
    is_admin: profileData.is_admin ?? false,
    theme_data: profileData.theme_data,
    interests: profileData.interests ?? [],
    onboarding_completed: profileData.onboarding_completed ?? false,
    token: session.access_token,
    access_token: session.access_token,
    user_metadata: {
      username: profileData.username,
      display_name: profileData.display_name,
      avatar_url: profileData.avatar_url,
      is_premium: profileData.is_premium ?? false,
      is_verified: profileData.is_verified ?? false,
    },
  })

  const fetchProfileViaApi = async (accessToken: string) => {
    try {
      const response = await fetch("/api/users/profile", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      })
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle()

    if (profileError) {
      console.error("Error fetching profile:", profileError)
    }

    let profileData = profile as Record<string, any> | null

    // Prefer service-role API when client read fails or omits completion state.
    if (!profileData || profileError) {
      profileData = await fetchProfileViaApi(session.access_token)
    }

    if (!profileData) {
      profileData = buildFallbackProfile(session.user)
    }

    setUser(mapSessionUser(session, profileData))
  }

  useEffect(() => {
    const checkSession = async () => {
      try {
        await hydrateSessionUser()
      } catch (error) {
        console.error("Error checking session:", error)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        await hydrateSessionUser()
      } else if (event === "SIGNED_OUT") {
        setUser(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
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

    await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    })
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

  const getAuthHeader = (): Record<string, string> => {
    if (!user?.access_token) {
      return {}
    }

    return {
      Authorization: `Bearer ${user.access_token}`,
    }
  }

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

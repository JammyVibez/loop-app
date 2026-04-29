"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@supabase/supabase-js"
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const hydrateSessionUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      setUser(null)
      return
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

    if (!profile) {
      setUser(null)
      return
    }

    setUser({
      id: session.user.id,
      email: session.user.email || profile.email,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      banner_url: profile.banner_url,
      bio: profile.bio,
      loop_coins: profile.loop_coins ?? 0,
      is_premium: profile.is_premium ?? false,
      premium_expires_at: profile.premium_expires_at ?? undefined,
      is_verified: profile.is_verified ?? false,
      is_admin: profile.is_admin ?? false,
      theme_data: profile.theme_data,
      onboarding_completed: profile.onboarding_completed ?? false,
      token: session.access_token,
      access_token: session.access_token,
      user_metadata: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        is_premium: profile.is_premium ?? false,
        is_verified: profile.is_verified ?? false,
      },
    })
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
    await hydrateSessionUser()
  }

  const getAuthHeader = () => {
    if (!user?.access_token) {
      return {}
    }

    return {
      Authorization: `Bearer ${user.access_token}`,
    }
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
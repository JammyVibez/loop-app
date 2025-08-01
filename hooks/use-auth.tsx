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
  is_verified: boolean
  is_admin: boolean
  theme_data?: any
  token?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, username: string, display_name: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for existing session
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          // Get user profile
          const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

          if (profile) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              banner_url: profile.banner_url,
              bio: profile.bio,
              loop_coins: profile.loop_coins,
              is_premium: profile.is_premium,
              is_verified: profile.is_verified,
              is_admin: profile.is_admin,
              theme_data: profile.theme_data,
              token: session.access_token,
            })
          }
        }
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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single()

        if (profile) {
          setUser({
            id: session.user.id,
            email: session.user.email!,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            banner_url: profile.banner_url,
            bio: profile.bio,
            loop_coins: profile.loop_coins,
            is_premium: profile.is_premium,
            is_verified: profile.is_verified,
            is_admin: profile.is_admin,
            theme_data: profile.theme_data,
            token: session.access_token,
          })
        }
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

    // Set session in Supabase client
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

    // Automatically log in after signup
    if (data.session?.access_token && data.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      })
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user) return

    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id)

      if (error) throw error

      // Refresh user profile after update
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single()
      if (profile) {
        setUser({ ...user, ...profile })
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      throw error
    }
  }

 const authContextValue: AuthContextType = {
  user,
  loading,
  login,
  signup,
  logout,
  updateProfile,
}

return (
  <AuthContext.Provider value={authContextValue}>
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

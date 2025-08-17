"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { createClient } from "@supabase/supabase-js"
import { useRouter } from 'next/navigation'; // Assuming you are using Next.js router

// Ensure environment variables are available
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  })
  throw new Error('Missing Supabase environment variables')
}

// Global Supabase client instance to prevent multiple instances
let supabaseClient: any = null

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce'
      },
    })
  }
  return supabaseClient
}

const supabase = getSupabaseClient()

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
  access_token?: string
  profile?: any; // Added profile to User interface
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
  const router = useRouter(); // Initialize router

  const loadUserProfile = async (session: any) => {
    try {
      if (!session?.user?.id) {
        console.log('No valid session provided to loadUserProfile')
        return null
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (error) {
        console.error("Error loading profile:", error)
        return null
      }

      if (!profile) {
        console.error("No profile found for user:", session.user.id)
        return null
      }

      return {
        id: session.user.id,
        email: session.user.email!,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        banner_url: profile.banner_url,
        bio: profile.bio,
        loop_coins: profile.loop_coins || 0,
        is_premium: profile.is_premium || false,
        is_verified: profile.is_verified || false,
        is_admin: profile.is_admin || false,
        theme_data: profile.theme_data,
        token: session.access_token,
        access_token: session.access_token,
        profile: profile, // Include profile data here
      }
    } catch (error) {
      console.error("Error in loadUserProfile:", error)
      return null
    }
  }

  useEffect(() => {
    let mounted = true
    let authSubscription: any = null

    const initAuth = async () => {
      try {
        setLoading(true)

        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error("Session error:", error)
          return
        }

        if (session?.user && mounted) {
          console.log("Initial session found for user:", session.user.id)
          const userProfile = await loadUserProfile(session)
          if (userProfile && mounted) {
            setUser(userProfile)
          }
        } else {
          console.log("No initial session found")
        }
      } catch (error) {
        console.error("Init auth error:", error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const setupAuthListener = () => {
      // Listen for auth changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log("Auth state change:", event, session?.user?.id)

        if (!mounted) return

        setLoading(true)

        try {
          if (event === "SIGNED_IN" && session?.user) {
            console.log("User signed in:", session.user.id)
            const userProfile = await loadUserProfile(session)
            if (userProfile && mounted) {
              setUser(userProfile)
            }
          } else if (event === "SIGNED_OUT") {
            console.log("User signed out")
            setUser(null)
          } else if (event === "TOKEN_REFRESHED" && session?.user) {
            console.log("Token refreshed for user:", session.user.id)
            const userProfile = await loadUserProfile(session)
            if (userProfile && mounted) {
              setUser(userProfile)
            }
          }
        } catch (error) {
          console.error("Auth state change error:", error)
        } finally {
          if (mounted) {
            setLoading(false)
          }
        }
      })

      authSubscription = subscription
    }

    initAuth()
    setupAuthListener()

    return () => {
      mounted = false
      if (authSubscription) {
        authSubscription.unsubscribe()
      }
    }
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

      if (data.user && data.session) {
        // Fetch user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single()

        setUser({
          id: data.user.id,
          email: data.user.email!,
          token: data.session.access_token,
          access_token: data.session.access_token,
          profile: profile,
        })

        router.push("/")
      }
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const signup = async (email: string, password: string, username: string, display_name: string) => {
    try {
      setLoading(true)

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, username, display_name }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      // After signup, directly log in the user.
      // The signup API should ideally return credentials or a confirmation.
      // For this example, we'll assume signup creates the user and then we attempt login.
      // A more robust solution would involve verifying email before login or getting session data.
      await login(email, password)

      return data
    } catch (error) {
      console.error("Signup error:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      setLoading(true)
      await supabase.auth.signOut()
      setUser(null)
      router.push('/login'); // Redirect to login after logout
    } catch (error) {
      console.error("Logout error:", error)
    } finally {
      setLoading(false)
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
        signup,
        logout,
        updateProfile,
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
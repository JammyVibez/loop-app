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
    key: !!supabaseAnonKey,
    supabaseUrl,
    supabaseAnonKey: supabaseAnonKey ? '[PRESENT]' : '[MISSING]'
  })

  // Don't throw error immediately, let the component handle it gracefully
  console.warn('Supabase not properly configured, some features may not work')
}

// Global Supabase client instance to prevent multiple instances
let supabaseClient: ReturnType<typeof createClient> | null = null

function getSupabaseClient() {
  if (!supabaseClient && supabaseUrl && supabaseAnonKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce'
        },
      })
    } catch (error) {
      console.error('Failed to initialize Supabase client:', error)
      // Create a mock client to prevent crashes
      supabaseClient = null
    }
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
  const [profile, setProfile] = useState<any>(null) // State for profile
  const [error, setError] = useState<string | null>(null) // State for error messages
  const router = useRouter(); // Initialize router

  const loadUserProfile = async (session: any) => {
    if (!supabase) {
      console.error('Supabase client not available for profile loading')
      return null
    }
    try {
      if (!session?.user?.id) {
        console.log('No valid session provided to loadUserProfile')
        return null
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()

      if (profileError) {
        console.error("Error loading profile:", profileError)
        return null
      }

      if (!profileData) {
        console.error("No profile found for user:", session.user.id)
        return null
      }

      return {
        id: session.user.id,
        email: session.user.email!,
        username: profileData.username,
        display_name: profileData.display_name,
        avatar_url: profileData.avatar_url,
        banner_url: profileData.banner_url,
        bio: profileData.bio,
        loop_coins: profileData.loop_coins || 0,
        is_premium: profileData.is_premium || false,
        is_verified: profileData.is_verified || false,
        is_admin: profileData.is_admin || false,
        theme_data: profileData.theme_data,
        token: session.access_token,
        access_token: session.access_token,
        profile: profileData, // Include profile data here
      }
    } catch (error) {
      console.error("Error in loadUserProfile:", error)
      return null
    }
  }

  const fetchUserProfile = async (userId: string) => {
    if (!supabase) {
      console.error('Supabase client not available for profile fetch')
      return
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
        return
      }

      setProfile(profileData)
    } catch (error) {
      console.error('Error in fetchUserProfile:', error)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting initial session:', error)
          return
        }

        console.log('Auth state change:', 'INITIAL_SESSION', session?.user?.id || null)
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchUserProfile(session.user.id)
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id || null)
      setUser(session?.user ?? null)

      if (session?.user && event === 'SIGNED_IN') {
        await fetchUserProfile(session.user.id)
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const login = async (email: string, password: string) => {
    if (!supabase) {
      const errorMessage = "Authentication service is not available"
      setError(errorMessage)
      return { user: null, error: errorMessage }
    }

    setLoading(true)
    setError("")
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Fetch user profile after login
      if (data.user && data.session) {
        await fetchUserProfile(data.user.id)
      }

      return { user: data.user, error: null }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to sign in"
      setError(errorMessage)
      return { user: null, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const signup = async (email: string, password: string, username: string, displayName: string) => {
    if (!supabase) {
      const errorMessage = "Authentication service is not available"
      setError(errorMessage)
      return { user: null, error: errorMessage }
    }

    setLoading(true)
    setError("")
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
          },
        },
      })
      if (error) throw error
      
      // After signup, attempt to login the user
      if (data.user) {
        await login(email, password)
      }

      return { user: data.user, error: null }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to sign up"
      setError(errorMessage)
      return { user: null, error: errorMessage }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    if (!supabase) {
      setError("Authentication service is not available")
      return
    }
    try {
      setLoading(true)
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null) // Clear profile on logout
      router.push('/login'); // Redirect to login after logout
    } catch (error) {
      console.error("Logout error:", error)
      setError("Failed to log out")
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates: Partial<User>) => {
    if (!user || !supabase) {
      setError("Authentication service not available or user not logged in")
      return
    }

    try {
      const { error } = await supabase.from("profiles").update(updates).eq("id", user.id)

      if (error) throw error

      // Update local user state with new profile data
      setUser(prevUser => prevUser ? { ...prevUser, ...updates } : null)
      setProfile(prevProfile => prevProfile ? { ...prevProfile, ...updates } : null)
    } catch (error) {
      console.error("Error updating profile:", error)
      setError("Failed to update profile")
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
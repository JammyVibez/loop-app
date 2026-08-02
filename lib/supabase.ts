import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co"
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
}

// Lazy browser/shared client so Next.js page-data collection does not crash
// when this module is imported before env is fully available.
let _supabase: SupabaseClient<Database> | null = null

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    if (!_supabase) {
      const url = getSupabaseUrl()
      const key = getAnonKey()
      _supabase = createClient<Database>(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    }
    return Reflect.get(_supabase, prop, receiver)
  },
})

// Google OAuth configuration
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/onboarding`,
    },
  })
  return { data, error }
}

// Server-side client for API routes
export const createServerClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key"
  const url = getSupabaseUrl()

  // Untyped server client: generated Database types are incomplete vs live
  // schema, and newer supabase-js versions turn missing tables into `never`.
  return createClient(url, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Helper function to get user session
export const getSession = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

// Helper function to get user profile
export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

  if (error) throw error
  return data
}

export { createClient } from "@supabase/supabase-js"

import { createClient as createRawSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { authClient } from "@/lib/auth-client"

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co"
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
}

let _supabase: SupabaseClient<Database> | null = null

async function resolveUserFromToken(client: SupabaseClient<Database>, token?: string) {
  if (!token) return { data: { user: null }, error: new Error("No token provided") }

  const cleanToken = token.replace("Bearer ", "").trim()
  if (!cleanToken) return { data: { user: null }, error: new Error("Empty token") }

  try {
    // 1. Query the session table to see if cleanToken is an active Better Auth session token or session ID
    const { data: sess } = await client
      .from("session")
      .select('userId')
      .or(`token.eq.${cleanToken},id.eq.${cleanToken}`)
      .gte("expiresAt", new Date().toISOString())
      .maybeSingle()

    const targetUserId = sess?.userId || cleanToken

    // 2. Fetch user profile from profiles table
    const { data: profile } = await client
      .from("profiles")
      .select("id, email, display_name, avatar_url, username, is_admin")
      .eq("id", targetUserId)
      .maybeSingle()

    if (profile) {
      return {
        data: {
          user: {
            id: profile.id,
            email: profile.email || "",
            name: profile.display_name || profile.username || "",
            user_metadata: {
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
              username: profile.username,
              is_admin: profile.is_admin,
            },
            app_metadata: {
              role: profile.is_admin ? "admin" : "user",
            },
          },
        },
        error: null,
      }
    }
  } catch (e) {
    console.error("Error in resolveUserFromToken:", e)
  }

  return { data: { user: null }, error: new Error("Invalid or expired token") }
}

export function createClient<T = Database>(url?: string, key?: string, options?: any) {
  const targetUrl = url || getSupabaseUrl()
  const targetKey = key || getAnonKey()
  const safeOptions = {
    ...options,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      ...options?.auth,
    },
  }

  const rawClient = createRawSupabaseClient<T>(targetUrl, targetKey, safeOptions)

  return new Proxy(rawClient, {
    get(target, prop, receiver) {
      if (prop === "auth") {
        return {
          getUser: async (token?: string) => {
            return resolveUserFromToken(target as any, token)
          },
          getSession: async () => {
            const session = await authClient.getSession().catch(() => null)
            return { data: { session: session?.data || null }, error: null }
          },
          signOut: async () => {
            await authClient.signOut().catch(() => null)
            return { error: null }
          },
          exchangeCodeForSession: async (_code: string) => {
            return { data: { user: null, session: null }, error: new Error("OAuth exchange handled via Better Auth") }
          },
          onAuthStateChange: () => {
            return { data: { subscription: { unsubscribe: () => {} } } }
          },
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as SupabaseClient<T>
}

export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    if (!_supabase) {
      _supabase = createClient<Database>()
    }
    return Reflect.get(_supabase, prop, receiver)
  },
})

export const signInWithGoogle = async () => {
  try {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/onboarding`,
    })
    return { data: { url: null }, error: null }
  } catch (error: any) {
    return { data: null, error }
  }
}

export const createServerClient = () => {
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || getAnonKey()
  return createClient(getSupabaseUrl(), supabaseServiceKey)
}

export const getSession = async () => {
  const session = await authClient.getSession()
  return session?.data || null
}

export const getUserProfile = async (userId: string) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single()

  if (error) throw error
  return data
}

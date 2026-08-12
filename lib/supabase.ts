import { createClient as createRawSupabaseClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"
import { authClient } from "@/lib/auth-client"

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://placeholder.supabase.co"
}

function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key"
}

/**
 * A real Supabase API key (anon or service_role) is itself a JWT: three
 * dot-separated base64url segments. If SUPABASE_SERVICE_ROLE_KEY is unset,
 * truncated, or copied incorrectly, every server-side `.from(...)` call
 * below will be rejected by PostgREST with a raw "Invalid JWT structure"
 * error — which previously leaked straight through to login/signup
 * responses and looked like a Better Auth bug. Detect that misconfiguration
 * here so it fails loudly in server logs instead.
 */
let warnedAboutKey = false
function looksLikeJwt(key: string) {
  return key.split(".").length === 3
}
function assertUsableKey(key: string, label: string) {
  if (warnedAboutKey) return
  if (!key || key === "placeholder-anon-key" || key.includes("placeholder") || !looksLikeJwt(key)) {
    warnedAboutKey = true
    console.error(
      `[supabase] ${label} does not look like a valid Supabase API key (expected a 3-part JWT). ` +
        `All server-side Supabase REST calls (profile lookups, session resolution, etc.) will fail ` +
        `with "Invalid JWT structure" until this is fixed. Set SUPABASE_SERVICE_ROLE_KEY in your ` +
        `environment (Vercel/Cursor Cloud Agents secrets) to the real service_role key from the ` +
        `Supabase project settings.`,
    )
  }
}

let _supabase: SupabaseClient<Database> | null = null

async function resolveUserFromToken(client: SupabaseClient<Database>, token?: string) {
  if (!token) return { data: { user: null }, error: new Error("No token provided") }

  const cleanToken = token.replace("Bearer ", "").trim()
  if (!cleanToken) return { data: { user: null }, error: new Error("Empty token") }

  try {
    // 1. Query the session table to see if cleanToken is an active Better Auth session token or session ID
    const { data: sess, error: sessError } = await client
      .from("session")
      .select('userId')
      .or(`token.eq.${cleanToken},id.eq.${cleanToken}`)
      .gte("expiresAt", new Date().toISOString())
      .maybeSingle()

    if (sessError) {
      // Surfaces misconfigured-key issues (e.g. "Invalid JWT structure")
      // in server logs instead of failing silently.
      console.error("[supabase] resolveUserFromToken: session lookup failed:", sessError.message)
    }

    const targetUserId = sess?.userId || cleanToken

    // 2. Fetch user profile from profiles table
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("id, email, display_name, avatar_url, username, is_admin")
      .eq("id", targetUserId)
      .maybeSingle()

    if (profileError) {
      console.error("[supabase] resolveUserFromToken: profile lookup failed:", profileError.message)
    }

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
  assertUsableKey(supabaseServiceKey, "SUPABASE_SERVICE_ROLE_KEY")
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

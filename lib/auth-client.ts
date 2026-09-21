"use client"

/**
 * Auth client that talks directly to Better Auth's HTTP API endpoints.
 *
 * The `better-auth/react` and `@better-auth/stripe/client` packages contain
 * internal circular module dependencies that cause "Cannot access 'a' before
 * initialization" TDZ errors in production webpack/Next.js builds. No amount
 * of `import()`, `require()`, or proxy tricks can fix this because the
 * circular deps are INSIDE those packages' own modules.
 *
 * Instead, we call Better Auth's REST API directly — the same endpoints that
 * `createAuthClient()` would call internally. The catch-all route handler at
 * `/api/auth/[...all]` forwards every request to the server-side `betterAuth`
 * instance, so the behavior is identical.
 */

const AUTH_BASE = "/api/auth"

interface AuthResult {
  data: any
  error: any
}

async function authFetch(
  path: string,
  init?: RequestInit,
): Promise<AuthResult> {
  try {
    const res = await fetch(`${AUTH_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      return { data: null, error: body || { message: `HTTP ${res.status}` } }
    }
    return { data: body, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err?.message || "Network error" } }
  }
}

/**
 * Thin wrapper around Better Auth's HTTP endpoints.
 * Matches the API surface used by hooks/use-auth.tsx, lib/supabase.ts,
 * and app/reset-password/page.tsx.
 */
export const authClient: any = {
  getSession: () =>
    authFetch("/get-session"),

  signOut: () =>
    authFetch("/sign-out", { method: "POST" }),

  signIn: {
    social: async ({
      provider,
      callbackURL,
    }: {
      provider: string
      callbackURL?: string
    }) => {
      // Better Auth's `/sign-in/social` is a POST endpoint: it stores the OAuth
      // state/PKCE verifier in a cookie and returns the provider's authorize
      // URL. Navigating the browser straight at the endpoint with a GET (the
      // old behaviour) hit a POST-only route and surfaced as a dead page, so
      // start the flow with a POST and follow the returned URL.
      const res = await authFetch("/sign-in/social", {
        method: "POST",
        body: JSON.stringify({ provider, callbackURL }),
      })

      if (res.error) return res

      const url: string | undefined = res.data?.url
      if (!url) {
        return {
          data: null,
          error: { message: `${provider} sign-in is not available right now.` },
        }
      }

      // This redirects the browser to the OAuth provider.
      window.location.href = url
      return { data: { url, redirect: true }, error: null }
    },
  },

  requestPasswordReset: ({
    email,
    redirectTo,
  }: {
    email: string
    redirectTo?: string
  }) =>
    authFetch("/request-password-reset", {
      method: "POST",
      body: JSON.stringify({ email, redirectTo }),
    }),

  resetPassword: ({
    newPassword,
    token,
  }: {
    newPassword: string
    token: string
  }) =>
    authFetch("/reset-password", {
      method: "POST",
      body: JSON.stringify({ newPassword, token }),
    }),
}

export function getAuthClient(): typeof authClient {
  return authClient
}

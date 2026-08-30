"use client"

let _authClient: any = null

export function getAuthClient(): any {
  if (_authClient) return _authClient

  // Dynamic imports break the circular dependency chain inside better-auth
  // that causes "Cannot access 'a' before initialization" in production builds.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createAuthClient } = require("better-auth/react")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { stripeClient } = require("@better-auth/stripe/client")

  _authClient = createAuthClient({
    baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "",
    plugins: [
      stripeClient({
        subscription: true,
      }),
    ],
  })

  return _authClient
}

/**
 * Lazy proxy — every property access delegates to the real client,
 * so better-auth modules are never evaluated during bundle initialization.
 */
export const authClient: any = new Proxy({} as any, {
  get(_target, prop) {
    return (getAuthClient() as any)[prop]
  },
})

export const signIn = new Proxy({} as any, {
  get(_target, prop) {
    return (getAuthClient().signIn as any)[prop]
  },
})

export const signUp = new Proxy({} as any, {
  get(_target, prop) {
    return (getAuthClient().signUp as any)[prop]
  },
})

export const signOut = new Proxy({} as any, {
  get(_target, prop) {
    return (getAuthClient().signOut as any)[prop]
  },
})

/** Hook — call as useSession() in a React component. */
export const useSession: any = (...args: any[]) => {
  return (getAuthClient() as any).useSession(...args)
}

export const getSession: any = (...args: any[]) => {
  return (getAuthClient() as any).getSession(...args)
}

"use client"

/**
 * Better-auth client with fully lazy initialization.
 *
 * All `better-auth` and `@better-auth/stripe` packages contain internal
 * circular dependencies that cause "Cannot access 'a' before initialization"
 * TDZ errors when bundled by webpack/Next.js in production mode.
 *
 * Using dynamic `import()` (instead of static `import` or `require`) creates
 * async boundaries that prevent webpack from eagerly evaluating these modules
 * during bundle initialization. The client is created once on first use and
 * cached for subsequent calls.
 */

let _clientPromise: Promise<any> | null = null

function ensureClient(): Promise<any> {
  if (_clientPromise) return _clientPromise

  _clientPromise = (async () => {
    const [{ createAuthClient }, { stripeClient }] = await Promise.all([
      import("better-auth/react"),
      import("@better-auth/stripe/client"),
    ])

    return createAuthClient({
      baseURL:
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_APP_URL || "",
      plugins: [
        stripeClient({
          subscription: true,
        }),
      ],
    })
  })()

  return _clientPromise
}

/**
 * Lazy proxy — every property access triggers the async client load
 * on first call, then delegates directly to the real client.
 * All callers already `await` the results (getSession, signOut, signIn.social, etc.).
 */
export const authClient: any = new Proxy({} as any, {
  get(_target, prop, receiver) {
    // Allow non-function property access to pass through (e.g. Symbol checks)
    if (typeof prop === "symbol") return undefined

    // Return a function that lazily loads the real client then calls the method
    return (...args: any[]) =>
      ensureClient().then((client: any) => {
        const method = client[prop]
        if (typeof method === "function") {
          return method.apply(client, args)
        }
        return method
      })
  },
})

export function getAuthClient(): any {
  // Return a thenable that resolves to the real client
  return ensureClient()
}

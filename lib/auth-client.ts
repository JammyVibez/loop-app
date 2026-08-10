import { createAuthClient } from "better-auth/react"
import { stripeClient } from "@better-auth/stripe/client"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL || "",
  plugins: [
    stripeClient({
      subscription: true,
    }),
  ],
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient

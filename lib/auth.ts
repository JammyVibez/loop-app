import { betterAuth } from "better-auth"
import { stripe } from "@better-auth/stripe"
import { sendPasswordResetEmail } from "@/lib/resend"
import { hashPassword, verifyPassword as defaultVerifyPassword } from "better-auth/crypto"
import bcrypt from "bcryptjs"
import { Pool } from "pg"
import Stripe from "stripe"

export const authDbPool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:G2DbfnoknKWSvyq8@db.cgtjjowhlyyrfljarfgd.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
})

const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export const auth = betterAuth({
  database: authDbPool,
  // The app's tables (profiles, messages, circle_members, ...) use uuid
  // columns, but Better Auth's default ID generator emits random alphanumeric
  // strings. That mismatch silently breaks new signups (no profile row, and
  // every conversation/membership insert fails). Force UUID ids so new users
  // are compatible with the rest of the schema — matching the ids the
  // pre-migration Supabase users already have.
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  secret: process.env.BETTER_AUTH_SECRET || "loop-better-auth-secret-key-32-chars-long",
  // Dynamic base URL: resolves from each request's host so OAuth redirects,
  // cookies, and trusted-origin checks work on every environment (local dev,
  // preview proxies, production custom domain) instead of pointing at a stale
  // hardcoded URL that breaks Google sign-in on deploy.
  baseURL: {
    allowedHosts: [
      "localhost",
      "127.0.0.1",
      "*.daytonaproxy01.net",
      "*.daytonaproxy02.net",
      "*.run.app",
      "*.vercel.app",
      "loop-app.com",
      "*.loop-app.com",
      ...(process.env.BETTER_AUTH_ALLOWED_HOSTS
        ? process.env.BETTER_AUTH_ALLOWED_HOSTS.split(",").map((h) => h.trim()).filter(Boolean)
        : []),
    ],
    fallback: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://loop-app.com",
  },
  emailAndPassword: {
    enabled: true,
    password: {
      hash: async (password: string) => {
        return await hashPassword(password)
      },
      verify: async ({ password, hash }: { password: string; hash: string }) => {
        if (hash && (hash.startsWith("$2a$") || hash.startsWith("$2b$") || hash.startsWith("$2y$"))) {
          return await bcrypt.compare(password, hash)
        }
        return await defaultVerifyPassword({ password, hash })
      },
    },
    // Without this, Better Auth's /request-password-reset endpoint rejects
    // every call ("Reset password isn't enabled"). sendPasswordResetEmail
    // sends the real reset link through Resend when RESEND_API_KEY is set,
    // and logs the link server-side as a dev fallback so the flow never
    // silently dies.
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      await sendPasswordResetEmail({ to: user.email, resetUrl: url })
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  plugins: [
    stripe({
      stripeClient: stripeSecretKey ? new Stripe(stripeSecretKey) : new Stripe("sk_test_placeholder"),
      stripeWebhookSecret: stripeWebhookSecret || "whsec_placeholder",
      // Only touch Stripe during signup when a real key is configured — with
      // the placeholder key every signup fired a 401 to Stripe (and added
      // ~1.5s of latency) for no benefit.
      createCustomerOnSignUp: Boolean(stripeSecretKey),
      subscription: {
        enabled: true,
        plans: [
          {
            name: "pro",
            planId: "pro",
            priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro",
          },
        ],
      },
    }),
  ],
})

/**
 * Verify a user's current credential password against the account row stored
 * by Better Auth. Handles both the legacy bcrypt hashes (pre-migration) and
 * Better Auth's argon2id hashes.
 */
export async function verifyCredentialPassword(userId: string, password: string) {
  const accRes = await authDbPool.query(
    'SELECT password FROM "account" WHERE "userId" = $1 AND "providerId" = \'credential\' LIMIT 1;',
    [userId]
  )
  const storedHash = accRes.rows[0]?.password
  if (!storedHash) return false
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    return await bcrypt.compare(password, storedHash)
  }
  return await defaultVerifyPassword({ password, hash: storedHash })
}

/**
 * Set a user's credential password, always stored as an argon2id hash.
 * Old bcrypt hashes are replaced (migrated) on the next password change.
 */
export async function setCredentialPassword(userId: string, newPassword: string) {
  const newHash = await hashPassword(newPassword)
  await authDbPool.query(
    'UPDATE "account" SET password = $1, "updatedAt" = NOW() WHERE "userId" = $2 AND "providerId" = \'credential\';',
    [newHash, userId]
  )
}

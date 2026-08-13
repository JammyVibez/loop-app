import { betterAuth } from "better-auth"
import { stripe } from "@better-auth/stripe"
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
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ais-dev-o3lwgmmrisjysqnqikbyt2-413485355424.europe-west2.run.app",
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
    // every call ("Reset password isn't enabled"). No transactional-email
    // provider is wired up yet, so log the link server-side for now instead
    // of silently failing the request.
    sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => {
      console.log(`[auth] Password reset requested for ${user.email}: ${url}`)
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

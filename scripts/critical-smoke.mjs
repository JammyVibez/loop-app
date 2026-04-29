import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const requiredPaths = [
  "app/api/auth/login/route.ts",
  "app/api/auth/signup/route.ts",
  "app/api/payments/create-payment-intent/route.ts",
  "app/api/payments/webhook/route.ts",
  "app/api/upload/route.ts",
  "components/onboarding-redirect.tsx",
  "scripts/launch-schema-alignment.sql",
]

const root = process.cwd()
const missing = requiredPaths.filter((relativePath) => !existsSync(resolve(root, relativePath)))

if (missing.length > 0) {
  console.error("Missing required critical files:")
  missing.forEach((file) => console.error(` - ${file}`))
  process.exit(1)
}

const envExample = readFileSync(resolve(root, ".env.example"), "utf8")
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "CLOUDINARY_UPLOAD_PRESET",
]

const missingEnvVars = requiredEnvVars.filter((key) => !envExample.includes(`${key}=`))
if (missingEnvVars.length > 0) {
  console.error("Missing required .env.example keys:")
  missingEnvVars.forEach((key) => console.error(` - ${key}`))
  process.exit(1)
}

console.log("Critical smoke checks passed.")

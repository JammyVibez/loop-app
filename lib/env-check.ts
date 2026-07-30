const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-export"

let hasLoggedStatus = false

export function checkEnvironmentVariables() {
  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  const optionalEnvVars = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  }

  const missingRequired = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  const missingOptional = Object.entries(optionalEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missingRequired.length > 0) {
    console.error("Missing required environment variables:", missingRequired)
    return false
  }

  if (missingOptional.length > 0 && !isBuildPhase && !hasLoggedStatus) {
    console.warn(
      "Optional media upload env vars not set (uploads disabled until configured):",
      missingOptional,
    )
  }

  return true
}

export function logEnvironmentStatus() {
  if (isBuildPhase || hasLoggedStatus) return
  hasLoggedStatus = true

  console.log("Environment Status:", {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    cloudinaryConfigured: Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    ),
  })
}

export function validateEnvironment() {
  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const missing = Object.entries(requiredEnvVars)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing)
    return false
  }

  return true
}

export function getSupabaseConfig() {
  if (!validateEnvironment()) {
    throw new Error("Supabase configuration is invalid")
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  }
}

export function isCloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  )
}

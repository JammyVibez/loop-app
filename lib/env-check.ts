
export function checkEnvironmentVariables() {
  const requiredEnvVars = {
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    'SUPABASE_SERVICE_ROLE_KEY': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'CLOUDINARY_CLOUD_NAME': process.env.CLOUDINARY_CLOUD_NAME,
    'CLOUDINARY_API_KEY': process.env.CLOUDINARY_API_KEY,
    'CLOUDINARY_API_SECRET': process.env.CLOUDINARY_API_SECRET,
  }

  const missing = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error('Missing environment variables:', missing)
    return false
  }

  console.log('All required environment variables are present')
  return true
}

export function logEnvironmentStatus() {
  console.log('Environment Status:', {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    cloudinaryName: !!process.env.CLOUDINARY_CLOUD_NAME,
    cloudinaryKey: !!process.env.CLOUDINARY_API_KEY,
    cloudinarySecret: !!process.env.CLOUDINARY_API_SECRET,
  })
}
```typescript
// Environment variables validation
export function validateEnvironment() {
  const requiredEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }

  const missing = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing)
    return false
  }

  console.log('Environment variables validated successfully')
  return true
}

export function getSupabaseConfig() {
  if (!validateEnvironment()) {
    throw new Error('Supabase configuration is invalid')
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  }
}
```

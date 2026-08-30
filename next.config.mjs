/** @type {import('next').NextConfig} */

// Force blocking metadata into <head> for all UAs (including Googlebot).
// Next 15 streams metadata by default for "dom" bots like Googlebot, which
// leaves the initial HTML without <title>/<meta name="description">.

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://res.cloudinary.com https://api.cloudinary.com https://tenor.googleapis.com https://api.stripe.com https://*.stripe.com https://vitals.vercel-insights.com wss://*.livekit.cloud https://*.livekit.cloud",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://accounts.google.com https://*.supabase.co",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors *",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(self), usb=()",
  },
]

const nextConfig = {
  // NOTE: Do not set `output: "standalone"` here — the deploy targets are
  // Vercel (which ignores it) and Render (whose `next start` start command is
  // incompatible with standalone output). There is no Docker/VPS target that
  // consumes the standalone server bundle.
  // Keep Node-only packages out of the client/Edge bundles.
  serverExternalPackages: ["stripe", "web-push", "https-proxy-agent", "agent-base"],
  productionBrowserSourceMaps: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "localhost" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        dns: false,
        child_process: false,
      }
    }
    return config
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
      {
        source: "/og-image.jpg",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
          { key: "Content-Type", value: "image/jpeg" },
        ],
      },
    ]
  },
}

export default nextConfig

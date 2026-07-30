/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Avoid bundling Stripe into route chunks (can run at build "collect page data" without env).
  serverExternalPackages: ["stripe"],
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
      { protocol: "http", hostname: "localhost" },
      { protocol: "https", hostname: "localhost" },
    ],
  },
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ]
  },
}

export default nextConfig

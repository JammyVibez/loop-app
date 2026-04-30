/** @type {import('next').NextConfig} */
const nextConfig = {
  // Avoid bundling Stripe into route chunks (can run at build "collect page data" without env).
  serverExternalPackages: ["stripe"],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig

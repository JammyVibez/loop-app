import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import "../styles/3d-framework.css"
import "../styles/responsive.css"
import { AuthProvider } from "../providers/auth-provider"
import { ThemeProvider } from "../providers/theme-provider"
import { Theme3DProvider } from "../providers/theme-3d-provider"
// import { RealtimeProvider } from "@/providers/realtime-provider"
import { Toaster } from "@/components/ui/toaster"
import { OnboardingRedirect } from "@/components/onboarding-redirect"
import { checkEnvironmentVariables, logEnvironmentStatus, validateEnvironment } from "@/lib/env-check"

const inter = Inter({ subsets: ["latin"] })

// ✅ Moved themeColor + viewport here
export const generateViewport = (): Viewport => ({
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
})

export const metadata: Metadata = {
  title: "Loop - Social Media Reimagined",
  description: "Connect, create, and collaborate in the Loop ecosystem with stunning 3D effects",
  generator: "_Halal_",
  manifest: "/manifest.json",
  keywords: ["social media", "3D", "loops", "community", "gamification"],
  authors: [{ name: "Loop Team" }],
  openGraph: {
    title: "Loop - Social Media Reimagined",
    description: "Connect, create, and collaborate in the Loop ecosystem with stunning 3D effects",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop - Social Media Reimagined",
    description: "Connect, create, and collaborate in the Loop ecosystem with stunning 3D effects",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  checkEnvironmentVariables()
  logEnvironmentStatus()
  // Validate environment variables
  const envValid = validateEnvironment()

  if (!envValid) {
    return (
      <html lang="en">
        <body>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">Configuration Error</h1>
              <p className="text-gray-600">Missing required environment variables. Please check your configuration.</p>
            </div>
          </div>
        </body>
      </html>
    )
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA Meta Tags */}
        <meta name="application-name" content="Loop" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Loop" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-config" content="/icons/browserconfig.xml" />
        <meta name="msapplication-TileColor" content="#6366f1" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Apple Touch Icons */}
        <link rel="apple-touch-icon" href="/icons/touch-icon-iphone.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/touch-icon-ipad.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/touch-icon-iphone-retina.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/icons/touch-icon-ipad-retina.png" />

        {/* Favicon */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />

        {/* Performance optimizations */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <Theme3DProvider>
            <AuthProvider>
              {/* Removed RealtimeProvider */}
              <OnboardingRedirect>
                <div className="min-h-screen bg-background text-foreground">
                  <div id="theme-environment" className="fixed inset-0 pointer-events-none z-[-1]" />
                  <div className="relative z-10">{children}</div>
                  <div id="performance-monitor" className="hidden" />
                  <div id="accessibility-announcements" className="sr-only" aria-live="polite" aria-atomic="true" />
                </div>
              </OnboardingRedirect>
            </AuthProvider>
          </Theme3DProvider>
        </ThemeProvider>

        {/* Service Worker Registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />

        {/* Performance monitoring script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                const observer = new PerformanceObserver((list) => {
                  for (const entry of list.getEntries()) {
                    if (entry.duration > 16.67) {
                      console.warn('Performance warning:', entry.name, entry.duration + 'ms');
                    }
                  }
                });
                observer.observe({entryTypes: ['measure', 'navigation', 'resource']});

                const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
                if (prefersReducedMotion.matches) {
                  document.documentElement.classList.add('reduce-motion');
                }
              }
            `,
          }}
        />
      </body>
    </html>
  )
}
import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { RenderAnalytics } from "@/components/analytics/render-analytics"
import "./globals.css"
import "../styles/3d-framework.css"
import "../styles/responsive.css"
import "../styles/cosmetics.css"
// Desktop-only refinements (max-width, gutters, scrollbars). Every rule is
// gated behind min-width: 1024px + a fine pointer, so mobile is untouched.
import "../styles/desktop.css"
import { AuthProvider } from "../providers/auth-provider"
import { ThemeProvider } from "../providers/theme-provider"
import { ThemeSync } from "../providers/theme-sync"
import { Theme3DProvider } from "../providers/theme-3d-provider"
import { RealtimeProvider } from "@/providers/realtime-provider"
import { Toaster } from "@/components/ui/toaster"
import { DataSaverProvider, DataSaverBanner } from "@/hooks/use-data-saver"
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog"
import { OnboardingRedirect } from "@/components/onboarding-redirect"
import { AppChrome } from "@/components/layout/app-chrome"
import { LeftSidebar } from "@/components/left-sidebar"
import { GiftNotificationSystem } from "@/components/gifting/gift-notification"
import { CosmeticFontLoader } from "@/components/cosmetics/cosmetic-font-loader"
import { GlobalFab } from "@/components/global-fab"
import { InAppBrowserHost } from "@/components/in-app-browser/in-app-browser"
import { RateLimitInterceptor } from "@/components/rate-limit-interceptor"
import { PushAutoSubscribe } from "@/components/pwa/push-auto-subscribe"
import { NotificationAutoPrompt } from "@/components/pwa/notification-auto-prompt"
import { NativeShell } from "@/components/pwa/native-shell"
import { MaintenanceGate } from "@/components/maintenance/maintenance-gate"
import { OfflineIndicator } from "@/components/ui/offline-indicator"
import { checkEnvironmentVariables, logEnvironmentStatus, validateEnvironment } from "@/lib/env-check"

const inter = Inter({ subsets: ["latin"] })

// NOTE: no `export const dynamic = "force-dynamic"` here.
//
// Segment config in the root layout applies to every route below it, and
// forcing the whole app dynamic meant a server render on every navigation:
// <Link> prefetches are reduced to the nearest loading boundary, the client
// router cache can never reuse anything, and switching tabs re-rendered the
// entire tree from scratch — which reads to users as the app reloading.
//
// Pages that genuinely need per-request data opt in themselves: every route
// that reads cookies, searchParams or the service-role Supabase key declares
// its own `export const dynamic = "force-dynamic"`.

// ✅ Moved themeColor + viewport here.
// NOTE: no maximumScale / user-scalable restriction — pinching to zoom must
// stay enabled for accessibility (low-vision users).
export const generateViewport = (): Viewport => ({
  themeColor: "#5e6ad2",
  width: "device-width",
  initialScale: 1,
  // Shrink the layout viewport when the mobile keyboard opens so the chat
  // composer stays visible above the keyboard instead of being clipped.
  interactiveWidget: "resizes-content",
})

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://loopapp.me").replace(/\/$/, "")
const defaultOgTitle = "Loop — Build Together, Not Just Post Into The Void"
const defaultOgDesc = "Loop is the collaborative social network where you co-write posts live with friends, settle debates in public Duels, build communities in Circles, and earn rewards for being active. Free to join."
// Every share of the site root gets the designed 1200x630 home card instead
// of the square app icon (which crawlers cropped or letterboxed).
const defaultOgImage = `${siteUrl}/api/og?${new URLSearchParams({
  type: "home",
  title: defaultOgTitle,
  description: defaultOgDesc,
}).toString()}`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "loopapp.me — Build together. Not just post into the void.",
    template: "%s | loopapp.me",
  },
  description: defaultOgDesc,
  generator: "loopapp.me",
  applicationName: "loopapp.me",
  manifest: "/manifest.json",
  keywords: ["social network", "collaborative social media", "co-loop", "real-time collaboration", "circles", "live streams", "duels", "community app", "creator economy", "loop coins", "free social app"],
  authors: [{ name: "loopapp.me Team", url: siteUrl }],
  creator: "loopapp.me Team",
  publisher: "loopapp.me",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "loopapp.me",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/icons/touch-icon-iphone.png" },
      { url: "/icons/touch-icon-ipad.png", sizes: "152x152" },
      { url: "/icons/touch-icon-iphone-retina.png", sizes: "180x180" },
      { url: "/icons/touch-icon-ipad-retina.png", sizes: "167x167" },
    ],
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "loopapp.me - Next-Gen Collaborative Social OS",
    description: "Connect, create, and collaborate in the loopapp.me ecosystem with live streams, real-time co-loops, and interactive circles.",
    url: siteUrl,
    siteName: "loopapp.me",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Loop — loopapp.me",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "loopapp.me - Next-Gen Collaborative Social OS",
    description: "Connect, create, and collaborate in the loopapp.me ecosystem with live streams, real-time co-loops, and interactive circles.",
    creator: "@loopappme",
    images: [
      {
        url: defaultOgImage,
        width: 512,
        height: 512,
        alt: "Loop — loopapp.me",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "ASTdqmtE7ppj8BX_Mh9QkzU7gEKagXFgBvG435GL584",
  },
  other: {
    "msapplication-TileColor": "#5e6ad2",
    "msapplication-config": "/icons/browserconfig.xml",
    "mobile-web-app-capable": "yes",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Soft env checks (Cloudinary is optional; avoid build-time spam)
  if (typeof window === "undefined" && process.env.NEXT_PHASE !== "phase-production-build") {
    checkEnvironmentVariables()
    logEnvironmentStatus()
    if (!validateEnvironment()) {
      console.warn("Environment validation failed - some features may not work properly")
    }
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="google-site-verification" content="ASTdqmtE7ppj8BX_Mh9QkzU7gEKagXFgBvG435GL584" />

        {/* Blocking theme script: apply saved theme before React hydrates to prevent FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('loop-theme');
                  var theme = stored || 'system';
                  var isDark = false;
                  if (theme === 'system') {
                    isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    theme = isDark ? 'dark' : 'light';
                  } else {
                    isDark = theme === 'dark' || theme === 'midnight';
                  }
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />

        {/* Performance optimizations */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Google Analytics 4 (GA4) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID || "G-LOOPAPP2026"}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID || "G-LOOPAPP2026"}', {
              page_path: window.location.pathname,
            });
          `}
        </Script>

        {/* JSON-LD Structured Data for Search Engines */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "loopapp.me",
              alternateName: "loopapp.me Social OS",
              url: siteUrl,
              description: "Connect, create, and collaborate in the loopapp.me ecosystem with live streams, real-time co-loops, and gamified reward economies.",
              potentialAction: {
                "@type": "SearchAction",
                target: `${siteUrl}/search?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          storageKey="loop-theme"
          themes={["light", "dark", "midnight", "sakura", "forest"]}
        >
          <ThemeSync />
          <Theme3DProvider>
            <AuthProvider>
              <RealtimeProvider>
                <MaintenanceGate>
                  <OnboardingRedirect>
                    <DataSaverProvider>
                    {/* min-h-dvh, not min-h-screen: 100vh on phones is taller than
                        the visible viewport, so the document always had a little
                        phantom scroll that every tap nudged. */}
                    <div className="min-h-dvh bg-background text-foreground">
                      <div id="theme-environment" className="fixed inset-0 pointer-events-none z-[-1]" />
                      <div className="relative z-10 flex min-h-dvh">
                        <LeftSidebar />
                        <AppChrome>{children}</AppChrome>
                      </div>
                      <GlobalFab />
                      <InAppBrowserHost />
                      <RateLimitInterceptor />
                      <GiftNotificationSystem />
        <CosmeticFontLoader />
                      <PushAutoSubscribe />
                      <NotificationAutoPrompt />
                      <NativeShell />
                      <Toaster />
                      <DataSaverBanner />
                      <ConfirmDialogHost />
                      <OfflineIndicator />
                      <Analytics />
                      <SpeedInsights />
                      <RenderAnalytics />
                      <div id="performance-monitor" className="hidden" />
                      <div id="accessibility-announcements" className="sr-only" aria-live="polite" aria-atomic="true" />
                    </div>
                    </DataSaverProvider>
                  </OnboardingRedirect>
                </MaintenanceGate>
              </RealtimeProvider>
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
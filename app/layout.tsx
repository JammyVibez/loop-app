import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import "../styles/3d-framework.css"
import "../styles/responsive.css"
import { AuthProvider } from "../providers/auth-provider"
import { ThemeProvider } from "../providers/theme-provider"
import { Theme3DProvider } from "../providers/theme-3d-provider"
import { RealtimeProvider } from "@/providers/realtime-provider"
import { Toaster } from "@/components/ui/toaster"
import { OnboardingRedirect } from "@/components/onboarding-redirect"
import { MobileBottomNav } from "@/components/navigation/mobile-bottom-nav"
import { LeftSidebar } from "@/components/left-sidebar"
import { AppUpdateBanner } from "@/components/app-update-banner"
import { GiftNotificationSystem } from "@/components/gifting/gift-notification"
import { GlobalFab } from "@/components/global-fab"
import { PushAutoSubscribe } from "@/components/pwa/push-auto-subscribe"
import { checkEnvironmentVariables, logEnvironmentStatus, validateEnvironment } from "@/lib/env-check"

const inter = Inter({ subsets: ["latin"] })

export const dynamic = "force-dynamic"

// ✅ Moved themeColor + viewport here
export const generateViewport = (): Viewport => ({
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
})

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://loop-app.com").replace(/\/$/, "")
const defaultOgTitle = "Loop — Build together. Not just post into the void."
const defaultOgDesc = "Loop is where communities create in real time — co-write posts live with friends, settle debates in public Duels, and build spaces that are actually yours."
const defaultOgImage = `${siteUrl}/api/og?type=home&title=${encodeURIComponent(defaultOgTitle)}&description=${encodeURIComponent(defaultOgDesc)}`

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Loop — Build together. Not just post into the void.",
    template: "%s | Loop",
  },
  description: defaultOgDesc,
  generator: "Loop Social OS",
  applicationName: "Loop",
  manifest: "/manifest.json",
  keywords: ["social media", "co-loop", "real-time collaboration", "live streams", "circles", "gamification", "loop coins"],
  authors: [{ name: "Loop Team", url: siteUrl }],
  creator: "Loop Team",
  publisher: "Loop Platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loop",
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
    title: "Loop - Next-Gen Collaborative Social OS",
    description: "Connect, create, and collaborate in the Loop ecosystem with live streams, real-time co-loops, and interactive circles.",
    url: siteUrl,
    siteName: "Loop Social OS",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Loop - Next-Gen Collaborative Social OS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loop - Next-Gen Collaborative Social OS",
    description: "Connect, create, and collaborate in the Loop ecosystem with live streams, real-time co-loops, and interactive circles.",
    creator: "@LoopSocial",
    images: [
      {
        url: defaultOgImage,
        width: 1200,
        height: 630,
        alt: "Loop - Next-Gen Collaborative Social OS",
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
    "msapplication-TileColor": "#6366f1",
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
              name: "Loop",
              alternateName: "Loop Social OS",
              url: siteUrl,
              description: "Connect, create, and collaborate in the Loop ecosystem with live streams, real-time co-loops, and gamified reward economies.",
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
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <Theme3DProvider>
            <AuthProvider>
              <RealtimeProvider>
                <OnboardingRedirect>
                  <div className="min-h-screen bg-background text-foreground">
                    <div id="theme-environment" className="fixed inset-0 pointer-events-none z-[-1]" />
                    <div className="relative z-10 flex min-h-screen">
                      <LeftSidebar />
                      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
                        <AppUpdateBanner />
                        {children}
                      </div>
                    </div>
                    <MobileBottomNav />
                    <GlobalFab />
                    <GiftNotificationSystem />
                    <PushAutoSubscribe />
                    <Toaster />
                    <div id="performance-monitor" className="hidden" />
                    <div id="accessibility-announcements" className="sr-only" aria-live="polite" aria-atomic="true" />
                  </div>
                </OnboardingRedirect>
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
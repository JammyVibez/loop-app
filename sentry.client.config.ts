import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,

  // Session replay to understand user journeys
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Don't send errors in development
  enabled: process.env.NODE_ENV === "production",

  // Ignore common non-error issues
  ignoreErrors: [
    "ResizeObserver loop",
    "Non-Error promise rejection",
    "Network request failed",
    "User closed the prompt",
    "AbortError",
    "CancelledError",
    "ChunkLoadError",
  ],

  // Don't track errors from third-party scripts
  allowUrls: [
    /https:\/\/loopapp\.me/,
    /https:\/\/.*\.vercel\.app/,
  ],
})

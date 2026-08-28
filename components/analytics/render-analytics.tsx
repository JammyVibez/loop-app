"use client"

import Script from "next/script"

/**
 * Render Analytics — tracks server-side metrics.
 *
 * Render provides built-in analytics at https://dashboard.render.com → your service → Analytics.
 * This client component adds the optional browser-side tracking script for
 * real-time metrics (latency, errors, uptime).
 *
 * RENDER_ANALYTICS_ID comes from your Render Dashboard → Settings → Analytics.
 */
export function RenderAnalytics() {
  const analyticsId = process.env.NEXT_PUBLIC_RENDER_ANALYTICS_ID

  // Don't render anything if no analytics ID is configured
  if (!analyticsId) return null

  return (
    <Script
      id="render-analytics"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          // Render Analytics — lightweight metrics collector
          (function() {
            var id = "${analyticsId}";
            if (!id) return;

            // Track page views
            function trackPageView() {
              if (typeof window !== "undefined" && window.navigator) {
                var data = {
                  id: id,
                  type: "pageview",
                  url: window.location.href,
                  path: window.location.pathname,
                  referrer: document.referrer || "",
                  timestamp: Date.now(),
                  userAgent: navigator.userAgent,
                  viewport: window.innerWidth + "x" + window.innerHeight
                };

                // Send to Render's analytics endpoint
                if (navigator.sendBeacon) {
                  navigator.sendBeacon("https://analytics.render.com/v1/track", JSON.stringify(data));
                } else {
                  fetch("https://analytics.render.com/v1/track", {
                    method: "POST",
                    body: JSON.stringify(data),
                    headers: { "Content-Type": "application/json" },
                    keepalive: true
                  }).catch(function() {});
                }
              }
            }

            // Track on initial load and route changes
            trackPageView();

            // Listen for route changes (Next.js App Router)
            if (typeof window !== "undefined") {
              var pushState = window.history.pushState;
              window.history.pushState = function() {
                pushState.apply(this, arguments);
                setTimeout(trackPageView, 100);
              };
              window.addEventListener("popstate", function() {
                setTimeout(trackPageView, 100);
              });
            }

            // Track Web Vitals
            if (typeof window !== "undefined" && "PerformanceObserver" in window) {
              try {
                var lcpObserver = new PerformanceObserver(function(list) {
                  var entries = list.getEntries();
                  var lastEntry = entries[entries.length - 1];
                  if (lastEntry) {
                    var data = {
                      id: id,
                      type: "vital",
                      name: "LCP",
                      value: lastEntry.startTime,
                      url: window.location.pathname,
                      timestamp: Date.now()
                    };
                    if (navigator.sendBeacon) {
                      navigator.sendBeacon("https://analytics.render.com/v1/track", JSON.stringify(data));
                    }
                  }
                });
                lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
              } catch (e) {}

              try {
                var fidObserver = new PerformanceObserver(function(list) {
                  var entries = list.getEntries();
                  entries.forEach(function(entry) {
                    var data = {
                      id: id,
                      type: "vital",
                      name: "FID",
                      value: entry.processingStart - entry.startTime,
                      url: window.location.pathname,
                      timestamp: Date.now()
                    };
                    if (navigator.sendBeacon) {
                      navigator.sendBeacon("https://analytics.render.com/v1/track", JSON.stringify(data));
                    }
                  });
                });
                fidObserver.observe({ type: "first-input", buffered: true });
              } catch (e) {}
            }
          })();
        `,
      }}
    />
  )
}

/**
 * Server-side metrics collector.
 * Call this from API routes to track response times and errors.
 */
export function trackServerMetric(metric: {
  name: string
  value: number
  tags?: Record<string, string>
}) {
  const analyticsId = process.env.RENDER_ANALYTICS_ID
  if (!analyticsId) return

  // Non-blocking — don't slow down the response
  try {
    const data = {
      id: analyticsId,
      type: "server_metric",
      name: metric.name,
      value: metric.value,
      tags: metric.tags,
      timestamp: Date.now(),
    }

    // Fire and forget
    fetch("https://analytics.render.com/v1/track", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Silent fail
  }
}

"use client"

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import {
  Download,
  Shield,
  Smartphone,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  Apple,
  Share2,
  Plus,
} from "@/components/icons/lucide-compat"
import { Button } from "@/components/ui/button"
import { APK_DIRECT_URL, APK_CHECKSUM, APK_VERSION } from "@/lib/store-links"

type DownloadState = "idle" | "downloading" | "done" | "error" | "unavailable"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * The APK only exists after someone builds the Android app and commits the
 * artifact. Instead of dying with "Download failed" when it's missing, the
 * button now (1) offers the PWA install if the browser supports it, or
 * (2) falls back to a plain direct link so at minimum the user gets the file
 * if it exists, and a clear explanation if it doesn't.
 */
export function AndroidDirectInstall() {
  const [downloadState, setDownloadState] = useState<DownloadState>("idle")
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [pwaInstalled, setPwaInstalled] = useState(false)
  const [apkMissing, setApkMissing] = useState<boolean | null>(null)

  // Detect whether the APK exists at all — a HEAD request, no body transfer.
  useEffect(() => {
    let cancelled = false
    fetch(APK_DIRECT_URL, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setApkMissing(res.status === 404)
      })
      .catch(() => {
        if (!cancelled) setApkMissing(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // PWA install support (Chrome/Edge on Android).
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    // Standalone already-installed check.
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setPwaInstalled(true)
    }
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  const installPwa = useCallback(async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    if (choice.outcome === "accepted") setPwaInstalled(true)
    setInstallPrompt(null)
  }, [installPrompt])

  const handleDownload = useCallback(async () => {
    if (downloadState === "downloading") return
    setDownloadState("downloading")
    setProgress(0)

    try {
      const res = await fetch(APK_DIRECT_URL)
      if (res.status === 404) {
        // No APK built yet — flip to the PWA path instead of a dead error.
        setDownloadState("unavailable")
        return
      }
      if (!res.ok) throw new Error("Download failed")

      const contentLength = Number(res.headers.get("content-length")) || 0
      const reader = res.body?.getReader()
      if (!reader) throw new Error("Stream not supported")

      let received = 0
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        received += value.length
        if (contentLength > 0) {
          setProgress(Math.round((received / contentLength) * 100))
        }
      }

      const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
      const merged = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      const blob = new Blob([merged.buffer], {
        type: "application/vnd.android.package-archive",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `loop-${APK_VERSION}.apk`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setProgress(100)
      setDownloadState("done")
    } catch (err) {
      console.error("APK download error:", err)
      setDownloadState("error")
    }
  }, [downloadState])

  const copyChecksum = useCallback(() => {
    if (!APK_CHECKSUM) return
    navigator.clipboard.writeText(APK_CHECKSUM)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const showApkButton = apkMissing !== true || installPrompt === null

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
          <Smartphone className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Android</h3>
          <p className="text-xs text-muted-foreground">
            {pwaInstalled
              ? "Installed as an app"
              : installPrompt
                ? "Install as an app — full experience"
                : `Direct install v${APK_VERSION}`}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* PWA install — primary when available */}
        {pwaInstalled ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
            <CheckCircle className="mx-auto h-5 w-5 text-emerald-500" />
            <p className="mt-1 text-xs font-medium text-emerald-500">
              Loop is installed. Open it from your home screen!
            </p>
          </div>
        ) : installPrompt ? (
          <Button
            onClick={installPwa}
            className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Install Loop app
          </Button>
        ) : null}

        {/* APK download — shown while the file exists, or as secondary */}
        {showApkButton && !pwaInstalled && (
          <>
            {downloadState === "idle" && (
              <Button
                onClick={handleDownload}
                variant={installPrompt ? "outline" : "default"}
                className={
                  installPrompt
                    ? "w-full rounded-xl"
                    : "w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Download APK
              </Button>
            )}

            {downloadState === "downloading" && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {progress > 0 ? `${progress}% downloaded` : "Starting download..."}
                </p>
              </div>
            )}

            {downloadState === "done" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <CheckCircle className="mx-auto h-5 w-5 text-emerald-500" />
                <p className="mt-1 text-xs font-medium text-emerald-500">
                  Downloaded! Check your downloads folder.
                </p>
              </div>
            )}

            {downloadState === "error" && (
              <div className="space-y-2">
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
                  <AlertTriangle className="mx-auto h-5 w-5 text-red-500" />
                  <p className="mt-1 text-xs font-medium text-red-500">
                    Download failed. Please try again.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleDownload} variant="outline" className="flex-1 rounded-xl" size="sm">
                    Try again
                  </Button>
                  <a href={APK_DIRECT_URL} download className="flex-1">
                    <Button variant="ghost" className="w-full rounded-xl" size="sm">
                      Direct link
                    </Button>
                  </a>
                </div>
              </div>
            )}
          </>
        )}

        {/* No APK built — explain and offer the web-app install path */}
        {apkMissing === true && !installPrompt && !pwaInstalled && downloadState !== "done" && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-medium text-amber-600">Native APK not published yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              The Android build is being finalized. Meanwhile, you can add Loop to your home
              screen: open the browser menu and tap{" "}
              <strong className="text-foreground">“Add to Home screen”</strong> (or{" "}
              <Share2 className="inline h-3 w-3" /> then <strong className="text-foreground">Add</strong>{" "}
              on iOS) for a full-screen app experience.
            </p>
          </div>
        )}

        {downloadState === "unavailable" && (
          <p className="text-center text-xs text-muted-foreground">
            APK isn&apos;t available right now — try the install option above or “Add to Home screen”.
          </p>
        )}
      </div>

      {!apkMissing && (
        <div className="mt-4 space-y-2 rounded-xl bg-muted/30 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            One-time setup
          </p>
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                1
              </span>
              <span>Open the downloaded APK file</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                2
              </span>
              <span>
                If prompted, enable{" "}
                <strong className="text-foreground">
                  &quot;Install from unknown sources&quot;
                </strong>{" "}
                for your browser
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                3
              </span>
              <span>Tap Install and you&apos;re in!</span>
            </li>
          </ol>
        </div>
      )}

      {APK_CHECKSUM && !apkMissing && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <div className="text-[11px] text-muted-foreground">
            <p>
              This APK is provided directly by Loop (not verified by Google Play).
              We sign every release with a verified certificate.
            </p>
            <button
              onClick={copyChecksum}
              className="mt-1.5 flex items-center gap-1 text-foreground/70 hover:text-foreground transition-colors"
            >
              {copied ? (
                <Check className="h-3 w-3" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
              <span className="font-mono text-[10px]">
                SHA-256: {APK_CHECKSUM.slice(0, 16)}...
              </span>
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function IosComingSoon() {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
          <Apple className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">iOS</h3>
          <p className="text-xs text-muted-foreground">Coming to the App Store</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Loop is coming to the App Store soon. We&apos;re working on a native
          iOS experience built with the same care as the web app.
        </p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-xs font-medium text-blue-500">
            In development
          </span>
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Want early access?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create an account
        </Link>{" "}
        and we&apos;ll notify you when TestFlight is available.
      </p>
    </section>
  )
}

export function DesktopComingSoon() {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
          <svg className="h-5 w-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Desktop</h3>
          <p className="text-xs text-muted-foreground">Use Loop in your browser</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">
          Loop works great on desktop browsers. No download needed — just visit{" "}
          <strong className="text-foreground">loopapp.me</strong>
        </p>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Desktop apps are planned for a future release.
      </p>
    </section>
  )
}

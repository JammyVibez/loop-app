import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * Regression guards for the "the app reloads when I open a page" bug.
 *
 * Two things caused it and both are pinned here:
 *  1. The service worker answered Next.js RSC/prefetch/_next requests from the
 *     Cache API. The router cannot trust a cached payload, so it falls back to
 *     a full document load.
 *  2. The root layout forced every route dynamic, so nothing could be
 *     prefetched and a cached router entry could never be reused.
 */

type Listener = (event: any) => void

const ORIGIN = "https://loopapp.me"

function loadServiceWorker() {
  const source = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8")
  const listeners = new Map<string, Listener>()

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    skipWaiting: () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: { showNotification: async () => {} },
  }

  const consoleStub = { log: () => {}, warn: () => {}, error: () => {} }
  // The worker is plain browser JS with no module wrapper; evaluating it with a
  // fake `self` is the closest thing to running it in a browser here.
  new Function("self", "console", source)(self, consoleStub)

  return listeners
}

/**
 * `new Request(url, { mode: "navigate" })` is rejected by fetch, so build the
 * shape a real top-level navigation has.
 */
function navigationRequest(url: string) {
  return {
    method: "GET",
    url,
    mode: "navigate",
    destination: "document",
    headers: new Headers({ accept: "text/html" }),
  } as unknown as Request
}

function dispatchFetch(listeners: Map<string, Listener>, request: Request) {
  const listener = listeners.get("fetch")
  if (!listener) throw new Error("service worker registered no fetch listener")

  let claimed = false
  let response: Promise<Response> | undefined
  listener({
    request,
    respondWith: (r: Promise<Response>) => {
      claimed = true
      response = r
    },
  })
  return { claimed, response }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe("service worker: Next.js transport is never intercepted", () => {
  it("passes RSC payload fetches straight through", () => {
    const listeners = loadServiceWorker()
    const request = new Request(`${ORIGIN}/explore?_rsc=1a2b3`, {
      headers: { RSC: "1" },
    })

    expect(dispatchFetch(listeners, request).claimed).toBe(false)
  })

  it("passes router prefetches straight through", () => {
    const listeners = loadServiceWorker()
    const request = new Request(`${ORIGIN}/shop`, {
      headers: { "Next-Router-Prefetch": "1", "Next-Router-State-Tree": "%5B%5D" },
    })

    expect(dispatchFetch(listeners, request).claimed).toBe(false)
  })

  it("passes build output straight through", () => {
    const listeners = loadServiceWorker()
    const chunks = [
      `${ORIGIN}/_next/static/chunks/main-app-abc.js`,
      `${ORIGIN}/_next/static/css/app.css`,
      `${ORIGIN}/_next/image?url=%2Ficons%2Ficon.png&w=64&q=75`,
    ]

    for (const url of chunks) {
      expect(dispatchFetch(listeners, new Request(url)).claimed).toBe(false)
    }
  })

  it("leaves ordinary image and api caching in place", () => {
    const listeners = loadServiceWorker()
    globalThis.caches = {
      open: async () => ({
        match: async () => new Response("cached", { status: 200 }),
        put: async () => {},
      }),
    } as unknown as CacheStorage

    const image = dispatchFetch(listeners, new Request(`${ORIGIN}/icons/icon-192x192.png`))
    expect(image.claimed).toBe(true)

    const api = dispatchFetch(listeners, new Request(`${ORIGIN}/api/circles`))
    expect(api.claimed).toBe(true)
  })
})

describe("service worker: documents are never served stale", () => {
  it("shows the offline screen instead of a cached document", async () => {
    const listeners = loadServiceWorker()
    globalThis.caches = {
      open: async () => ({ match: async () => null, put: async () => {} }),
    } as unknown as CacheStorage
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))

    const { claimed, response } = dispatchFetch(listeners, navigationRequest(`${ORIGIN}/explore`))

    expect(claimed).toBe(true)
    const body = await (await response!)!.text()
    expect(body).toContain("You're offline")
  })

  it("does not precache the home document", async () => {
    const listeners = loadServiceWorker()
    const precached: string[] = []
    globalThis.caches = {
      open: async () => ({
        add: async (url: string) => {
          // Next passes a plain string; a Request object carries .url.
          precached.push(typeof url === "string" ? url : (url as unknown as Request).url)
        },
      }),
    } as unknown as CacheStorage

    const waiting: Promise<unknown>[] = []
    listeners.get("install")!({ waitUntil: (p: Promise<unknown>) => waiting.push(p) })
    await Promise.all(waiting)

    expect(precached).not.toContain("/")
    expect(precached).toContain("/offline")
  })
})

describe("root layout does not force every route dynamic", () => {
  it("leaves route segment config to the pages that need it", () => {
    const layout = readFileSync(path.join(process.cwd(), "app", "layout.tsx"), "utf8")

    // Pages that need request-time rendering declare this themselves; the
    // blanket version made prefetch and the client router cache useless.
    // Match real statements only — the explanatory comment mentions the export.
    const statements = layout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("export const dynamic"))

    expect(statements).toEqual([])
  })
})

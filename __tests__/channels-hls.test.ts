import { describe, expect, it } from "vitest"
import { rewriteHlsPlaylist, toProxiedPath } from "@/lib/channels-hls"

const ORIGIN = "http://127.0.0.1:3010"
const DIRECTORY = "/api/v1/live/play/"

describe("channel HLS proxying", () => {
  it("rewrites absolute upstream segment URLs onto the proxy", () => {
    const playlist = `#EXTM3U\n#EXTINF:6,\n${ORIGIN}/x/abc\n`
    expect(rewriteHlsPlaylist(playlist, { upstreamOrigin: ORIGIN, directory: DIRECTORY })).toContain(
      "\n/api/channels/hls/x/abc",
    )
  })

  it("rewrites root-relative paths and URI attributes exactly once", () => {
    const playlist = `#EXTM3U\n#EXT-X-MAP:URI="/x/init.mp4"\n/x/seg.ts\n`
    const rewritten = rewriteHlsPlaylist(playlist, { upstreamOrigin: ORIGIN, directory: DIRECTORY })
    expect(rewritten).toContain('URI="/api/channels/hls/x/init.mp4"')
    expect(rewritten).toContain("\n/api/channels/hls/x/seg.ts")
    expect(rewritten).not.toContain("/api/channels/hls/api/channels/hls")
  })

  it("resolves relative segment names against the manifest directory", () => {
    const rewritten = rewriteHlsPlaylist(`#EXTM3U\n#EXTINF:6,\nseg1.ts\n`, {
      upstreamOrigin: ORIGIN,
      directory: DIRECTORY,
    })
    expect(rewritten).toContain("/api/channels/hls/api/v1/live/play/seg1.ts")
  })

  it("leaves third-party absolute media URLs alone", () => {
    const line = "https://cdn.example.com/live/index.m3u8"
    expect(rewriteHlsPlaylist(line, { upstreamOrigin: ORIGIN, directory: "/" })).toBe(line)
  })

  it("maps upstream playback URLs onto the proxy and keeps foreign URLs", () => {
    expect(toProxiedPath(`${ORIGIN}/x/ticket`, ORIGIN)).toBe("/api/channels/hls/x/ticket")
    expect(toProxiedPath("https://cdn.example.com/a.m3u8", ORIGIN)).toBe(
      "https://cdn.example.com/a.m3u8",
    )
    expect(toProxiedPath(null, ORIGIN)).toBeNull()
  })
})

"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Clapperboard,
  Info,
  Loader2,
  Play,
  RefreshCw,
  Search,
  Tv,
} from "lucide-react"
import {
  CHANNEL_TABS,
  type ChannelTab,
  type DramaProvider,
  type LiveChannel,
  type NovelSummary,
} from "@/lib/channels"
import { loadChannelResource } from "@/lib/channels-client"
import { cn } from "@/lib/utils"
import {
  ChannelArt,
  ChannelNotice,
  ChannelSkeleton,
  ChannelScreen,
  posterStyle,
} from "./channel-ui"

const NOVEL_SUGGESTIONS = ["shadow slave", "lord of the mysteries", "solo leveling"]

type Status = "idle" | "loading" | "ready" | "error"

export function ChannelsBrowser() {
  const [tab, setTab] = useState<ChannelTab>("all")
  const [configured, setConfigured] = useState(true)

  const [channels, setChannels] = useState<LiveChannel[]>([])
  const [channelsStatus, setChannelsStatus] = useState<Status>("loading")
  const [channelsError, setChannelsError] = useState<string | null>(null)
  const [spotlightCursor, setSpotlightCursor] = useState(0)
  const [showInfo, setShowInfo] = useState(false)

  const [channelQuery, setChannelQuery] = useState("")
  const [searchTerm, setSearchTerm] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<LiveChannel[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [dramas, setDramas] = useState<DramaProvider[]>([])
  const [dramasStatus, setDramasStatus] = useState<Status>("idle")
  const [dramasError, setDramasError] = useState<string | null>(null)

  const [novelQuery, setNovelQuery] = useState("")
  const [novels, setNovels] = useState<NovelSummary[]>([])
  const [novelTerm, setNovelTerm] = useState<string | null>(null)
  const [novelsStatus, setNovelsStatus] = useState<Status>("idle")
  const [novelsError, setNovelsError] = useState<string | null>(null)

  const loadChannels = useCallback(async () => {
    setChannelsStatus("loading")
    setChannelsError(null)
    const result = await loadChannelResource<{ channels: LiveChannel[] }>({ kind: "live" })
    setConfigured(result.configured)
    setChannels(result.data?.channels ?? [])
    setChannelsError(result.error)
    setChannelsStatus(result.error ? "error" : "ready")
    setSpotlightCursor(0)
  }, [])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  // Dramas are only fetched when their tab is opened, and only once per visit.
  useEffect(() => {
    if (tab !== "drama" || dramasStatus !== "idle") return
    let cancelled = false
    setDramasStatus("loading")
    void loadChannelResource<{ providers: DramaProvider[] }>({ kind: "dramas" }).then((result) => {
      if (cancelled) return
      setConfigured(result.configured)
      setDramas(result.data?.providers ?? [])
      setDramasError(result.error)
      setDramasStatus(result.error ? "error" : "ready")
    })
    return () => {
      cancelled = true
    }
  }, [tab, dramasStatus])

  const runChannelSearch = async (event: FormEvent) => {
    event.preventDefault()
    const q = channelQuery.trim()
    if (!q) {
      setSearchTerm(null)
      setSearchResults([])
      setSearchError(null)
      return
    }
    setSearching(true)
    setSearchError(null)
    const result = await loadChannelResource<{ channels: LiveChannel[] }>({ kind: "live-search", q })
    setConfigured(result.configured)
    setSearchResults(result.data?.channels ?? [])
    setSearchError(result.error)
    setSearchTerm(result.error ? null : q)
    setSearching(false)
  }

  const searchNovels = async (term: string) => {
    const q = term.trim()
    if (!q) return
    setNovelsStatus("loading")
    setNovelsError(null)
    const result = await loadChannelResource<{ novels: NovelSummary[] }>({ kind: "novels", q })
    setConfigured(result.configured)
    setNovels(result.data?.novels ?? [])
    setNovelTerm(q)
    setNovelsError(result.error)
    setNovelsStatus(result.error ? "error" : "ready")
  }

  const spotlight = channels[channels.length ? spotlightCursor % channels.length : 0] ?? null
  const onNow = channels.slice(0, 6)
  const guide = channels.slice(6, 36)
  const grid = searchTerm !== null ? searchResults : channels

  return (
    <ChannelScreen title="Channels">
      <div className="mx-auto w-full max-w-3xl pb-16">
        <div className="sticky top-14 z-20 bg-[#08090a]/90 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CHANNEL_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                aria-pressed={tab === item.id}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition",
                  tab === item.id
                    ? "bg-white text-black"
                    : "bg-white/[0.07] text-white/85 hover:bg-white/[0.12]",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {!configured ? (
          <div className="px-4 pt-2">
            <div
              className="overflow-hidden rounded-2xl border border-white/10 p-5 sm:p-6"
              style={posterStyle("Channel guide")}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                <Tv className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-[26px]">
                Connect the channel guide
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/60">
                Channels streams live TV, Asian dramas and web novels from an UltraSrc API
                instance. Add its address and key to the server environment, then check again.
              </p>
              <dl className="mt-4 space-y-2 text-[12px]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="rounded bg-black/40 px-2 py-1 font-mono text-white/85">
                    ULTRASRC_API_URL
                  </dt>
                  <dd className="text-white/45">Public base URL of the instance</dd>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <dt className="rounded bg-black/40 px-2 py-1 font-mono text-white/85">
                    ULTRASRC_API_KEY
                  </dt>
                  <dd className="text-white/45">Bearer token for the instance</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => {
                  void loadChannels()
                  setDramasStatus("idle")
                  setNovelsStatus("idle")
                }}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-black transition hover:bg-white/90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Check again
              </button>
            </div>
          </div>
        ) : null}

        {configured && tab === "all" ? (
          <div className="mt-1">
            {channelsStatus === "loading" ? (
              <div className="space-y-3 px-4">
                <ChannelSkeleton className="aspect-[4/5] w-full sm:aspect-[16/9]" />
                <div className="grid grid-cols-2 gap-3">
                  <ChannelSkeleton className="aspect-[16/10]" />
                  <ChannelSkeleton className="aspect-[16/10]" />
                </div>
              </div>
            ) : channelsStatus === "error" ? (
              <div className="px-4">
                <ChannelNotice title="The guide could not load" description={channelsError}>
                  <button
                    type="button"
                    onClick={() => void loadChannels()}
                    className="mt-2 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4"
                  >
                    Try again
                  </button>
                </ChannelNotice>
              </div>
            ) : !channels.length ? (
              <div className="px-4">
                <ChannelNotice
                  title="No channels in the guide"
                  description="The UltraSrc instance answered, but returned no live channels. Check that its live TV provider is reachable."
                />
              </div>
            ) : (
              <>
                {spotlight ? (
                  <div>
                    <section className="relative">
                      <div className="relative aspect-[4/5] max-h-[620px] w-full overflow-hidden sm:aspect-[16/9] sm:rounded-b-2xl">
                        <div className="absolute inset-0" style={posterStyle(spotlight.name)} />
                        <div
                          aria-hidden="true"
                          className="absolute inset-0 flex items-center justify-center overflow-hidden opacity-[0.06]"
                        >
                          <span className="whitespace-nowrap text-[26vw] font-black leading-none tracking-tighter sm:text-[180px]">
                            {spotlight.name}
                          </span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />

                        <button
                          type="button"
                          onClick={() => {
                            setSpotlightCursor((current) => current + 1)
                            setShowInfo(false)
                          }}
                          aria-label="Next featured channel"
                          title="Next featured channel"
                          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white/90 ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/55"
                        >
                          <RefreshCw className="h-[18px] w-[18px]" />
                        </button>

                        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                          <div className="flex items-center gap-2.5">
                            <ChannelArt
                              src={spotlight.logo}
                              name={spotlight.name}
                              className="h-7 w-7 shrink-0"
                              rounded="rounded-md"
                              fallbackClassName="text-[10px]"
                            />
                            <span className="truncate text-[13px] font-semibold text-white">
                              {spotlight.name}
                            </span>
                            <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur">
                              Live TV
                            </span>
                          </div>

                          <h2 className="mt-2 line-clamp-2 text-[34px] font-black leading-[1.02] tracking-[-0.02em] sm:text-[46px]">
                            {spotlight.name}
                          </h2>
                          <p className="mt-2 text-[14px] text-white/60">
                            {spotlight.group}
                            <span className="px-1.5 text-white/30">·</span>
                            {channels.length.toLocaleString()} channels
                            <span className="px-1.5 text-white/30">·</span>
                            24/7
                          </p>

                          <div className="mt-4 grid grid-cols-2 gap-2.5">
                            <Link
                              href={`/channels/live/${encodeURIComponent(spotlight.id)}`}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-black transition hover:bg-white/90"
                            >
                              <Play className="h-4 w-4 fill-black" />
                              Watch
                            </Link>
                            <button
                              type="button"
                              onClick={() => setShowInfo((current) => !current)}
                              aria-expanded={showInfo}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white/[0.08] text-[15px] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/[0.14]"
                            >
                              <Info className="h-4 w-4" />
                              More info
                            </button>
                          </div>
                        </div>
                      </div>

                      {showInfo ? (
                        <div className="mx-4 mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
                            <div>
                              <dt className="text-white/40">Category</dt>
                              <dd className="mt-0.5 font-semibold text-white/90">
                                {spotlight.group}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-white/40">Channel</dt>
                              <dd className="mt-0.5 font-semibold text-white/90">
                                {spotlight.number ?? "—"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-white/40">Source</dt>
                              <dd className="mt-0.5 font-semibold text-white/90">UltraSrc Live TV</dd>
                            </div>
                            <div>
                              <dt className="text-white/40">Availability</dt>
                              <dd className="mt-0.5 font-semibold text-white/90">24 / 7</dd>
                            </div>
                          </dl>
                          <p className="mt-3 text-[12px] leading-relaxed text-white/45">
                            Live channels are relayed from the provider&apos;s public broadcast
                            feed. Availability can change without notice.
                          </p>
                        </div>
                      ) : null}
                    </section>

                    {onNow.length ? (
                      <section className="mt-6 px-4">
                        <div className="mb-3 flex items-end justify-between">
                          <h2 className="text-[21px] font-bold tracking-tight">On now</h2>
                          <button
                            type="button"
                            onClick={() => setTab("live")}
                            className="text-[12px] font-semibold text-white/45 transition hover:text-white"
                          >
                            See all
                          </button>
                        </div>
                        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {onNow.map((channel) => (
                            <ChannelRailCard key={channel.id} channel={channel} />
                          ))}
                        </div>
                      </section>
                    ) : null}
                  </div>
                ) : null}

                {guide.length ? (
                  <section className="mt-6 px-4">
                    <div className="mb-3 flex items-end justify-between">
                      <h2 className="text-[21px] font-bold tracking-tight">Channel guide</h2>
                      <span className="text-[12px] text-white/40">
                        {channels.length.toLocaleString()} live
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                      {guide.map((channel) => (
                        <ChannelGridCard key={channel.id} channel={channel} />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("live")}
                      className="mt-5 inline-flex items-center gap-1 text-[13px] font-semibold text-white/70 transition hover:text-white"
                    >
                      Browse every channel
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {configured && tab === "live" ? (
          <div className="space-y-4 px-4 pt-2">
            <form onSubmit={runChannelSearch} className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={channelQuery}
                onChange={(event) => setChannelQuery(event.target.value)}
                placeholder="Search live channels"
                aria-label="Search live channels"
                className="h-11 w-full rounded-full border border-white/10 bg-white/[0.05] pl-10 pr-11 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
              {searching ? (
                <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
              ) : null}
            </form>

            {searchError ? (
              <ChannelNotice title="Search unavailable" description={searchError} tone="warning" />
            ) : null}

            <div className="flex items-baseline justify-between">
              <h2 className="text-[21px] font-bold tracking-tight">
                {searchTerm ? "Results" : "All channels"}
              </h2>
              <span className="text-[12px] text-white/40">
                {searchTerm
                  ? `${grid.length} for “${searchTerm}”`
                  : `${channels.length.toLocaleString()} live`}
              </span>
            </div>

            {searchTerm ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm(null)
                  setSearchResults([])
                  setChannelQuery("")
                }}
                className="text-[12px] font-semibold text-white/50 transition hover:text-white"
              >
                Clear search
              </button>
            ) : null}

            {channelsStatus === "loading" ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ChannelSkeleton key={index} className="aspect-[16/10]" />
                ))}
              </div>
            ) : grid.length ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                {grid.map((channel) => (
                  <ChannelGridCard key={channel.id} channel={channel} />
                ))}
              </div>
            ) : (
              <ChannelNotice
                title={searchTerm ? "No matching channels" : "No channels available"}
                description={
                  searchTerm
                    ? "Try the channel name without extra words, or browse the full guide."
                    : "The UltraSrc instance returned an empty channel list."
                }
              />
            )}
          </div>
        ) : null}

        {configured && tab === "drama" ? (
          <div className="space-y-4 px-4 pt-2">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight">Asian dramas</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                Pick a provider, enter a drama title and an episode number. UltraSrc resolves the
                stream on demand.
              </p>
            </div>

            {dramasStatus === "loading" ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ChannelSkeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : dramasStatus === "error" ? (
              <ChannelNotice title="Providers unavailable" description={dramasError} tone="warning">
                <button
                  type="button"
                  onClick={() => setDramasStatus("idle")}
                  className="mt-2 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4"
                >
                  Try again
                </button>
              </ChannelNotice>
            ) : dramas.length ? (
              <div className="space-y-2">
                {dramas.map((provider) => (
                  <Link
                    key={provider.id}
                    href={`/channels/drama/${encodeURIComponent(provider.id)}?name=${encodeURIComponent(provider.name)}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/20 hover:bg-white/[0.06]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70">
                      <Clapperboard className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-white">
                        {provider.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-white/40">
                        {provider.mirrors.length
                          ? provider.mirrors.join(" · ")
                          : "Asian drama provider"}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                  </Link>
                ))}
              </div>
            ) : (
              <ChannelNotice
                title="No drama providers"
                description="The UltraSrc instance did not report any Asian drama providers."
              />
            )}

            <ChannelNotice
              title="How drama browsing works"
              description="UltraSrc resolves drama playback by title or MyDramaList id rather than exposing a full catalog. Open a provider to enter a title."
            />
          </div>
        ) : null}

        {configured && tab === "novel" ? (
          <div className="space-y-4 px-4 pt-2">
            <div>
              <h2 className="text-[22px] font-bold tracking-tight">Light & web novels</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                Search NovelBuddy and NovelFire, then read chapters right here.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                void searchNovels(novelQuery)
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={novelQuery}
                onChange={(event) => setNovelQuery(event.target.value)}
                placeholder="Search novels"
                aria-label="Search novels"
                className="h-11 w-full rounded-full border border-white/10 bg-white/[0.05] pl-10 pr-11 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
              {novelsStatus === "loading" ? (
                <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/40" />
              ) : null}
            </form>

            {novelsStatus === "idle" ? (
              <div className="flex flex-wrap gap-2">
                {NOVEL_SUGGESTIONS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setNovelQuery(term)
                      void searchNovels(term)
                    }}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/70 transition hover:border-white/25 hover:text-white"
                  >
                    {term}
                  </button>
                ))}
              </div>
            ) : null}

            {novelsStatus === "error" ? (
              <ChannelNotice title="Novels unavailable" description={novelsError} tone="warning">
                <button
                  type="button"
                  onClick={() => void searchNovels(novelTerm ?? novelQuery)}
                  className="mt-2 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4"
                >
                  Try again
                </button>
              </ChannelNotice>
            ) : null}

            {novelsStatus === "loading" ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ChannelSkeleton key={index} className="aspect-[2/3] w-full" />
                ))}
              </div>
            ) : novels.length ? (
              <>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-[17px] font-bold tracking-tight">Results</h3>
                  <span className="text-[12px] text-white/40">
                    {novels.length} for “{novelTerm}”
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                  {novels.map((novel) => (
                    <Link
                      key={`${novel.provider ?? "auto"}-${novel.id}`}
                      href={`/channels/novel/${encodeURIComponent(novel.id)}${
                        novel.provider ? `?src=${encodeURIComponent(novel.provider)}` : ""
                      }`}
                      className="group min-w-0"
                    >
                      <ChannelArt
                        src={novel.cover}
                        name={novel.title}
                        fit="cover"
                        className="aspect-[2/3] w-full"
                        fallbackClassName="text-2xl"
                      />
                      <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-white">
                        {novel.title}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-white/40">
                        {novel.author ?? novel.provider ?? "Web novel"}
                      </p>
                    </Link>
                  ))}
                </div>
              </>
            ) : novelsStatus === "ready" ? (
              <ChannelNotice
                title="No novels found"
                description="Try a shorter title, or check the spelling and search again."
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </ChannelScreen>
  )
}

function ChannelRailCard({ channel }: { channel: LiveChannel }) {
  return (
    <Link
      href={`/channels/live/${encodeURIComponent(channel.id)}`}
      className="group w-[62%] shrink-0 sm:w-[42%]"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
        <ChannelArt
          src={channel.logo}
          name={channel.name}
          className="absolute inset-0 h-full w-full"
          rounded="rounded-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white backdrop-blur">
          <span className="h-1 w-1 rounded-full bg-rose-400" />
          LIVE
        </span>
        <span className="absolute inset-x-2.5 bottom-2.5 truncate text-[11px] font-medium text-white/70">
          {channel.group}
        </span>
      </div>
      <p className="mt-2 line-clamp-1 text-[14px] font-semibold leading-snug text-white">
        {channel.name}
      </p>
      <p className="mt-0.5 text-[12px] text-white/40">Live TV · {channel.group}</p>
    </Link>
  )
}

function ChannelGridCard({ channel }: { channel: LiveChannel }) {
  return (
    <Link href={`/channels/live/${encodeURIComponent(channel.id)}`} className="group min-w-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
        <ChannelArt
          src={channel.logo}
          name={channel.name}
          className="absolute inset-0 h-full w-full"
          fallbackClassName="text-xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/25" />
        <span className="absolute left-2 top-2 rounded bg-rose-500/90 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white">
          LIVE
        </span>
        {channel.number ? (
          <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/80 backdrop-blur">
            {channel.number}
          </span>
        ) : null}
      </div>
      <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug text-white">
        {channel.name}
      </p>
      <p className="mt-0.5 truncate text-[12px] text-white/40">Live TV · {channel.group}</p>
    </Link>
  )
}

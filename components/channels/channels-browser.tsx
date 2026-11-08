"use client"

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import {
  ChevronRight,
  Clapperboard,
  Film,
  Info,
  Loader2,
  Play,
  Plus,
  Search,
} from "lucide-react"
import {
  CHANNEL_TABS,
  type ChannelTab,
  type DramaProvider,
  type NovelSummary,
} from "@/lib/channels"
import type { ChannelTitle } from "@/lib/channels-library"
import { loadChannelResource, loadLibrary } from "@/lib/channels-client"
import { cn } from "@/lib/utils"
import { ChannelArt, ChannelNotice, ChannelSkeleton, ChannelScreen, posterStyle } from "./channel-ui"

const NOVEL_SUGGESTIONS = ["shadow slave", "lord of the mysteries", "solo leveling"]

type Status = "idle" | "loading" | "ready" | "error"

function watchHref(title: ChannelTitle): string {
  return `/channels/${title.kind === "movie" ? "movie" : "series"}/${encodeURIComponent(title.id)}`
}

export function ChannelsBrowser() {
  const [tab, setTab] = useState<ChannelTab>("all")
  const [configured, setConfigured] = useState(true)

  const [titles, setTitles] = useState<ChannelTitle[]>([])
  const [titlesStatus, setTitlesStatus] = useState<Status>("loading")
  const [titlesError, setTitlesError] = useState<string | null>(null)
  const [showInfo, setShowInfo] = useState(false)
  const [libraryQuery, setLibraryQuery] = useState("")

  const [dramas, setDramas] = useState<DramaProvider[]>([])
  const [dramasStatus, setDramasStatus] = useState<Status>("idle")
  const [dramasError, setDramasError] = useState<string | null>(null)

  const [novelQuery, setNovelQuery] = useState("")
  const [novels, setNovels] = useState<NovelSummary[]>([])
  const [novelTerm, setNovelTerm] = useState<string | null>(null)
  const [novelsStatus, setNovelsStatus] = useState<Status>("idle")
  const [novelsError, setNovelsError] = useState<string | null>(null)

  const loadTitles = useCallback(async () => {
    setTitlesStatus("loading")
    setTitlesError(null)
    const result = await loadLibrary({ limit: 120 })
    setTitles(result.data?.titles ?? [])
    setTitlesError(result.error)
    setTitlesStatus(result.error ? "error" : "ready")
  }, [])

  useEffect(() => {
    void loadTitles()
  }, [loadTitles])

  // Deep links such as /channels?tab=movies come from the watch pages.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab")
    if (requested && CHANNEL_TABS.some((item) => item.id === requested)) {
      setTab(requested as ChannelTab)
    }
  }, [])

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

  const movies = useMemo(() => titles.filter((title) => title.kind === "movie"), [titles])
  const series = useMemo(() => titles.filter((title) => title.kind === "series"), [titles])
  const browserTitles = tab === "movies" ? movies : series
  const visibleTitles = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase()
    if (!q) return browserTitles
    return browserTitles.filter(
      (title) =>
        title.title.toLowerCase().includes(q) ||
        title.genres.some((genre) => genre.toLowerCase().includes(q)),
    )
  }, [browserTitles, libraryQuery])

  const featured =
    titles.find((title) => title.featured) ??
    movies[0] ??
    series[0] ??
    null

  return (
    <ChannelScreen title="Channels">
      <div className="mx-auto w-full max-w-3xl pb-16">
        <div className="sticky top-14 z-20 bg-[#08090a]/90 backdrop-blur-xl">
          <div className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CHANNEL_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id)
                  setShowInfo(false)
                  setLibraryQuery("")
                }}
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

        {tab === "all" ? (
          <div className="mt-1">
            {titlesStatus === "loading" ? (
              <div className="space-y-3 px-4">
                <ChannelSkeleton className="aspect-[4/5] w-full sm:aspect-[16/9]" />
                <div className="grid grid-cols-2 gap-3">
                  <ChannelSkeleton className="aspect-[16/10]" />
                  <ChannelSkeleton className="aspect-[16/10]" />
                </div>
              </div>
            ) : titlesStatus === "error" ? (
              <div className="px-4">
                <ChannelNotice title="The library could not load" description={titlesError}>
                  <button
                    type="button"
                    onClick={() => void loadTitles()}
                    className="mt-2 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4"
                  >
                    Try again
                  </button>
                </ChannelNotice>
              </div>
            ) : featured ? (
              <section className="relative">
                <div className="relative aspect-[4/5] max-h-[620px] w-full overflow-hidden sm:aspect-[16/9] sm:rounded-b-2xl">
                  <div
                    className="absolute inset-0"
                    style={
                      featured.backdrop
                        ? undefined
                        : posterStyle(featured.title)
                    }
                  >
                    {featured.backdrop ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={featured.backdrop}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/10" />

                  <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur">
                        {featured.kind === "movie" ? "Movie" : "Show"}
                      </span>
                      {featured.year ? (
                        <span className="text-[12px] font-medium text-white/60">{featured.year}</span>
                      ) : null}
                    </div>

                    <h2 className="mt-2 line-clamp-2 text-[34px] font-black leading-[1.02] tracking-[-0.02em] sm:text-[46px]">
                      {featured.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-[14px] text-white/60">
                      {featured.synopsis ?? featured.genres.join(" · ")}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <Link
                        href={watchHref(featured)}
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
                        <dt className="text-white/40">Type</dt>
                        <dd className="mt-0.5 font-semibold text-white/90">
                          {featured.kind === "movie" ? "Movie" : "Series"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-white/40">Year</dt>
                        <dd className="mt-0.5 font-semibold text-white/90">{featured.year ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/40">Country</dt>
                        <dd className="mt-0.5 font-semibold text-white/90">{featured.country ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-white/40">Language</dt>
                        <dd className="mt-0.5 font-semibold text-white/90">{featured.language ?? "—"}</dd>
                      </div>
                    </dl>
                    {featured.genres.length ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {featured.genres.map((genre) => (
                          <span
                            key={genre}
                            className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[11px] font-medium text-white/70"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : (
              <div className="px-4 pt-2">
                <ChannelNotice
                  title="The library is empty"
                  description="Movies and shows added by staff appear here. Drama and novel search is always available from their tabs."
                />
              </div>
            )}

            {titlesStatus === "ready" ? (
              <>
                <TitleRail
                  heading="Movies"
                  titles={movies}
                  onSeeAll={() => setTab("movies")}
                />
                <TitleRail
                  heading="Shows"
                  titles={series}
                  onSeeAll={() => setTab("series")}
                />
              </>
            ) : null}

            <section className="mt-6 space-y-2 px-4">
              <h2 className="mb-1 text-[21px] font-bold tracking-tight">More to watch</h2>
              <Link
                href="/channels?tab=drama"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70">
                  <Clapperboard className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-white">Asian dramas</span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/40">
                    KissKH, AsiaFlix, DramaCool and more
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
              </Link>
              <Link
                href="/channels?tab=novel"
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-white/70">
                  <Film className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-white">Light &amp; web novels</span>
                  <span className="mt-0.5 block truncate text-[11px] text-white/40">
                    Search NovelBuddy and NovelFire, read chapters here
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
              </Link>
            </section>
          </div>
        ) : null}

        {tab === "movies" || tab === "series" ? (
          <div className="space-y-4 px-4 pt-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-[22px] font-bold tracking-tight">
                  {tab === "movies" ? "Movies" : "Shows"}
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                  {tab === "movies"
                    ? "Full films added by the Loop team."
                    : "Series with full seasons and episodes."}
                </p>
              </div>
              <span className="shrink-0 text-[12px] text-white/40">{browserTitles.length}</span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder={tab === "movies" ? "Search movies" : "Search shows"}
                aria-label={tab === "movies" ? "Search movies" : "Search shows"}
                className="h-11 w-full rounded-full border border-white/10 bg-white/[0.05] pl-10 pr-4 text-sm text-white placeholder:text-white/35 focus:border-white/25 focus:outline-none"
              />
            </div>

            {titlesStatus === "loading" ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ChannelSkeleton key={index} className="aspect-[2/3] w-full" />
                ))}
              </div>
            ) : titlesStatus === "error" ? (
              <ChannelNotice title="The library could not load" description={titlesError}>
                <button
                  type="button"
                  onClick={() => void loadTitles()}
                  className="mt-2 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4"
                >
                  Try again
                </button>
              </ChannelNotice>
            ) : visibleTitles.length ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3">
                {visibleTitles.map((title) => (
                  <TitleCard key={title.id} title={title} />
                ))}
              </div>
            ) : (
              <ChannelNotice
                title={libraryQuery ? "Nothing matched" : tab === "movies" ? "No movies yet" : "No shows yet"}
                description={
                  libraryQuery
                    ? "Try a shorter title or a genre such as Drama or Romance."
                    : "Staff can add titles from the admin library; they will appear here once published."
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
              <h2 className="text-[22px] font-bold tracking-tight">Light &amp; web novels</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-white/50">
                Search NovelBuddy and NovelFire, then read chapters right here.
              </p>
            </div>

            <form
              onSubmit={(event: FormEvent) => {
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

        {!configured && (tab === "drama" || tab === "novel") ? (
          <div className="px-4 pt-2">
            <div
              className="overflow-hidden rounded-2xl border border-white/10 p-5 sm:p-6"
              style={posterStyle("Channel guide")}
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                <Plus className="h-5 w-5" />
              </span>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-[26px]">
                Connect the channel guide
              </h2>
              <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/60">
                Asian dramas and novels stream from an UltraSrc API instance. Add its address and
                key to the server environment, then check again.
              </p>
              <button
                type="button"
                onClick={() => {
                  setDramasStatus("idle")
                  setNovelsStatus("idle")
                  setConfigured(true)
                }}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-black transition hover:bg-white/90"
              >
                Check again
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </ChannelScreen>
  )
}

function TitleRail({
  heading,
  titles,
  onSeeAll,
}: {
  heading: string
  titles: ChannelTitle[]
  onSeeAll: () => void
}) {
  if (!titles.length) return null

  return (
    <section className="mt-6 px-4">
      <div className="mb-3 flex items-end justify-between">
        <h2 className="text-[21px] font-bold tracking-tight">{heading}</h2>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[12px] font-semibold text-white/45 transition hover:text-white"
        >
          See all
        </button>
      </div>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {titles.slice(0, 10).map((title) => (
          <Link key={title.id} href={watchHref(title)} className="group w-[38%] shrink-0 sm:w-[26%]">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
              <ChannelArt
                src={title.poster}
                name={title.title}
                fit="cover"
                className="absolute inset-0 h-full w-full"
                rounded="rounded-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </div>
            <p className="mt-2 line-clamp-1 text-[13px] font-semibold text-white">{title.title}</p>
            <p className="mt-0.5 text-[11px] text-white/40">
              {title.kind === "movie" ? "Movie" : `${title.episodeCount || 0} episodes`}
              {title.year ? ` · ${title.year}` : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function TitleCard({ title }: { title: ChannelTitle }) {
  return (
    <Link href={watchHref(title)} className="group min-w-0">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl ring-1 ring-white/10">
        <ChannelArt
          src={title.poster}
          name={title.title}
          fit="cover"
          className="absolute inset-0 h-full w-full"
          fallbackClassName="text-2xl"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute inset-x-0 bottom-0 flex items-center justify-between px-2 pb-2 text-[10px] font-semibold text-white/75">
          <span>{title.kind === "movie" ? "Movie" : `${title.episodeCount || 0} ep`}</span>
          {title.year ? <span>{title.year}</span> : null}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-[14px] font-semibold leading-snug text-white">
        {title.title}
      </p>
      <p className="mt-0.5 truncate text-[12px] text-white/40">
        {title.genres.length ? title.genres.slice(0, 2).join(" · ") : title.kind === "movie" ? "Movie" : "Series"}
      </p>
    </Link>
  )
}

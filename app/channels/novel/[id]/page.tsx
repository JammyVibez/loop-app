"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { BookOpen, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react"
import {
  ChannelArt,
  ChannelNotice,
  ChannelScreen,
  ChannelSkeleton,
} from "@/components/channels/channel-ui"
import { type NovelChapter, type NovelChapterRef, type NovelDetails } from "@/lib/channels"
import { loadChannelResource } from "@/lib/channels-client"

export default function NovelPage() {
  return (
    <Suspense
      fallback={
        <ChannelScreen title="Novel">
          <div className="px-4 pt-4">
            <ChannelSkeleton className="h-64 w-full" />
          </div>
        </ChannelScreen>
      }
    >
      <NovelDetail />
    </Suspense>
  )
}

function NovelDetail() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const novelId = params?.id ?? ""
  const src = searchParams.get("src") ?? undefined

  const [details, setDetails] = useState<NovelDetails | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(true)

  const [active, setActive] = useState<{ chapter: NovelChapterRef; content: NovelChapter } | null>(
    null,
  )
  const [readerLoading, setReaderLoading] = useState(false)
  const [readerError, setReaderError] = useState<string | null>(null)

  useEffect(() => {
    if (!novelId) {
      setStatus("error")
      setError("This novel link is missing an id.")
      return
    }

    let cancelled = false
    setStatus("loading")
    void loadChannelResource<NovelDetails>({ kind: "novel", id: novelId, src }).then((result) => {
      if (cancelled) return
      setConfigured(result.configured)
      setDetails(result.data)
      setError(result.error)
      setStatus(result.error ? "error" : "ready")
    })

    return () => {
      cancelled = true
    }
  }, [novelId, src])

  const chapters = details?.chapterList ?? []
  const currentIndex = active
    ? chapters.findIndex((chapter) => chapter.id === active.chapter.id)
    : -1

  const openChapter = async (chapter: NovelChapterRef) => {
    setActive({ chapter, content: { title: chapter.title, paragraphs: [] } })
    setReaderLoading(true)
    setReaderError(null)

    const result = await loadChannelResource<NovelChapter>({
      kind: "novel-read",
      novel: novelId,
      chapter: chapter.id,
      src,
    })

    setReaderLoading(false)
    if (result.error) {
      setReaderError(result.error)
      return
    }
    setActive({
      chapter,
      content: result.data ?? { title: chapter.title, paragraphs: [] },
    })
  }

  const move = (delta: number) => {
    if (currentIndex < 0) return
    const next = chapters[currentIndex + delta]
    if (next) void openChapter(next)
  }

  return (
    <ChannelScreen title={details?.title ?? "Novel"}>
      <div className="mx-auto w-full max-w-3xl px-4 py-5">
        {status === "loading" ? (
          <div className="space-y-4">
            <div className="flex gap-4">
              <ChannelSkeleton className="h-40 w-28" />
              <div className="flex-1 space-y-2">
                <ChannelSkeleton className="h-5 w-3/4" />
                <ChannelSkeleton className="h-3 w-1/2" />
                <ChannelSkeleton className="h-3 w-1/3" />
              </div>
            </div>
            <ChannelSkeleton className="h-24 w-full" />
          </div>
        ) : null}

        {!configured ? (
          <ChannelNotice
            title="Channel guide is not connected"
            description="Set ULTRASRC_API_URL and ULTRASRC_API_KEY in the server environment to read novels."
          />
        ) : null}

        {status === "error" ? (
          <ChannelNotice title="This novel could not load" description={error} tone="warning" />
        ) : null}

        {details ? (
          <>
            <section className="flex gap-4">
              <ChannelArt
                src={details.cover}
                name={details.title}
                fit="cover"
                className="h-[152px] w-[104px] shrink-0"
                fallbackClassName="text-2xl"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-black leading-tight tracking-tight sm:text-2xl">
                  {details.title}
                </h1>
                <p className="mt-1 truncate text-[13px] text-white/50">
                  {details.author ?? "Unknown author"}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {details.status ? (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/60">
                      {details.status}
                    </span>
                  ) : null}
                  {details.chapters ? (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/60">
                      {details.chapters} chapters
                    </span>
                  ) : null}
                  {details.provider ? (
                    <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-semibold text-white/60">
                      {details.provider}
                    </span>
                  ) : null}
                </div>

                {chapters.length ? (
                  <button
                    type="button"
                    onClick={() => void openChapter(chapters[0])}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-black transition hover:bg-white/90"
                  >
                    <BookOpen className="h-4 w-4" />
                    Start reading
                  </button>
                ) : null}
              </div>
            </section>

            {details.description ? (
              <p className="mt-4 text-[13px] leading-relaxed text-white/55">{details.description}</p>
            ) : null}

            {active ? (
              <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02]">
                <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white">
                      {active.content.title ?? active.chapter.title}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {currentIndex >= 0
                        ? `Chapter ${currentIndex + 1} of ${chapters.length}`
                        : "Chapter"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActive(null)}
                    aria-label="Close reader"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-4 py-5">
                  {readerLoading ? (
                    <div className="flex items-center gap-2 text-[13px] text-white/45">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading chapter…
                    </div>
                  ) : readerError ? (
                    <p className="text-[13px] text-amber-200/80">{readerError}</p>
                  ) : active.content.paragraphs.length ? (
                    <article className="space-y-4 font-serif text-[16px] leading-[1.9] text-white/80">
                      {active.content.paragraphs.map((paragraph, index) => (
                        <p key={index}>{paragraph}</p>
                      ))}
                    </article>
                  ) : (
                    <p className="text-[13px] text-white/45">
                      This chapter did not return readable text.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => move(-1)}
                    disabled={currentIndex <= 0 || readerLoading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.06] px-3.5 text-[12px] font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => move(1)}
                    disabled={currentIndex < 0 || currentIndex >= chapters.length - 1 || readerLoading}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold text-black transition hover:bg-white/90 disabled:opacity-40"
                  >
                    Next chapter
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </section>
            ) : null}

            <section className="mt-6">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="text-[17px] font-bold tracking-tight">Chapters</h2>
                <span className="text-[12px] text-white/40">{chapters.length || "—"}</span>
              </div>

              {chapters.length ? (
                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-white/10">
                  {chapters.map((chapter, index) => (
                    <button
                      key={`${chapter.id}-${index}`}
                      type="button"
                      onClick={() => void openChapter(chapter)}
                      className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-3.5 py-3 text-left transition last:border-b-0 hover:bg-white/[0.05] ${
                        active?.chapter.id === chapter.id ? "bg-white/[0.06]" : ""
                      }`}
                    >
                      <span className="w-8 shrink-0 text-[11px] tabular-nums text-white/35">
                        {chapter.number ?? index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white/85">
                        {chapter.title}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25" />
                    </button>
                  ))}
                </div>
              ) : (
                <ChannelNotice
                  title="No chapter list"
                  description="The provider did not return chapters for this title. Try another search result."
                />
              )}
            </section>

            <Link
              href="/channels"
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/[0.1]"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to the guide
            </Link>
          </>
        ) : null}
      </div>
    </ChannelScreen>
  )
}

/**
 * OG templates — one composition per content type.
 *
 * Every template receives the same resolved payload (see `OgPayload`) and
 * renders inside the shared `Canvas`, so branding, spacing and type rhythm are
 * identical everywhere while each layout reads differently at a glance.
 */

import {
  Avatar,
  AvatarGroup,
  Canvas,
  Chips,
  Clamp,
  Logo,
  MediaPanel,
  PlayGlyph,
  ProBadge,
  Seal,
  SectionLabel,
  StatRow,
} from "./primitives"
import type { Accent } from "./theme"
import { palette, typeScale, withAlpha } from "./theme"
import { formatCount, initials, truncate } from "./text"

export interface OgPerson {
  name?: string
  username?: string
  avatar?: string
}

/** Everything a template may render. All fields optional — see fallback. */
export interface OgPayload {
  title: string
  description: string
  /** Official app icon, inlined. */
  logo?: string
  accent: Accent
  name?: string
  username?: string
  avatar?: string
  verified?: boolean
  premium?: boolean
  badgeColors?: string[]
  body?: string
  date?: string
  category?: string
  stat?: number
  statLabel?: string
  extraStats?: { value: string; label: string }[]
  media?: string
  people?: OgPerson[]
  sides?: OgPerson[]
  progress?: { value: number; max: number; label: string }
  dateBlock?: { day: string; month: string }
  note?: string
  url?: string
}

/** Homepage — editorial hero: statement, sub-line, feature chips. */
export function HomeTemplate({ p }: { p: OgPayload }) {
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Loop" note="loopapp.me — build together, not just post">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          justifyContent: "center",
          gap: 26,
        }}
      >
        <SectionLabel color={p.accent.base}>THE COLLABORATIVE SOCIAL NETWORK</SectionLabel>

        <Clamp
          lines={2}
          size={typeScale.display}
          weight={800}
          lh={1.05}
          letterSpacing="-0.035em"
          style={{ maxWidth: 960 }}
        >
          {p.title}
        </Clamp>

        <Clamp
          lines={2}
          size={typeScale.body}
          color={palette.textMuted}
          lh={1.45}
          letterSpacing="-0.005em"
          style={{ maxWidth: 900 }}
        >
          {p.description}
        </Clamp>

        <Chips items={["DUELS", "CO-LOOPS", "CIRCLES", "REWARDS"]} accent={p.accent} />
      </div>
    </Canvas>
  )
}

/** Post — reading card: author identity, body, optional media column. */
export function PostTemplate({ p, kicker }: { p: OgPayload; kicker?: string }) {
  const meta = [p.username ? `@${p.username}` : "", p.date || "", statText(p.stat, p.statLabel)]
    .filter(Boolean)
    .join("   ·   ")

  return (
    <Canvas accent={p.accent} logo={p.logo} kicker={kicker || "Post"} note={p.url || "loopapp.me"}>
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 40 }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
            gap: 30,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Avatar src={p.avatar} name={p.name || p.username} size={78} ring={p.accent.base} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 33, fontWeight: 800, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
                  {truncate(p.name || p.username || "Loop", 26)}
                </div>
                {p.verified ? <Seal size={27} colors={p.badgeColors} /> : null}
                {p.premium ? <ProBadge /> : null}
              </div>
              {meta ? (
                <div style={{ fontSize: 20, color: palette.textFaint, whiteSpace: "nowrap", overflow: "hidden" }}>
                  {meta}
                </div>
              ) : null}
            </div>
          </div>

          <Clamp lines={p.media ? 4 : 5} size={typeScale.body + 4} weight={500} lh={1.42}>
            {p.body || p.description}
          </Clamp>
        </div>

        {p.media ? (
          <div style={{ width: 330, height: "100%" }}>
            <MediaPanel src={p.media} accent={p.accent} glyph={<PlayGlyph />} />
          </div>
        ) : null}
      </div>
    </Canvas>
  )
}

function statText(value?: number, label?: string): string {
  if (!value || !label) return ""
  return `${formatCount(value)} ${label}`
}

/** Profile — identity card: portrait, name, handle, bio, stat readouts. */
export function ProfileTemplate({ p }: { p: OgPayload }) {
  const stats = statsFor(p)
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Profile" note={p.url || "loopapp.me"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 30 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <Avatar src={p.avatar} name={p.name || p.username} size={132} ring={p.accent.base} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: typeScale.heading, fontWeight: 800, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
                {truncate(p.name || p.username || "Loop", 24)}
              </div>
              {p.verified ? <Seal size={34} colors={p.badgeColors} /> : null}
              {p.premium ? <ProBadge /> : null}
            </div>
            {p.username ? (
              <div style={{ display: "flex", fontSize: 26, fontWeight: 600, color: p.accent.base }}>{`@${p.username}`}</div>
            ) : null}
            {p.category ? (
              <div style={{ fontSize: 20, color: palette.textMuted, letterSpacing: "0.04em" }}>
                {truncate(p.category, 46)}
              </div>
            ) : null}
          </div>
        </div>

        {p.description ? (
          <Clamp lines={2} size={typeScale.body - 4} color={palette.textMuted} lh={1.45} style={{ maxWidth: 980 }}>
            {p.description}
          </Clamp>
        ) : null}

        {stats.length ? <StatRow items={stats} accent={p.accent} /> : null}
      </div>
    </Canvas>
  )
}

/** Community — mark, name, category, description, member readouts. */
export function CommunityTemplate({ p }: { p: OgPayload }) {
  const stats = statsFor(p)
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Community" note={p.url || "loopapp.me/communities"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 26 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* satori errors on `backgroundImage: undefined`, so the image and
              the gradient fallback are two separate elements. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 116,
              height: 116,
              borderRadius: 34,
              overflow: "hidden",
              backgroundColor: withAlpha(p.accent.base, 0.18),
              backgroundImage: p.avatar
                ? `url(${p.avatar})`
                : `linear-gradient(135deg, ${p.accent.base}, ${p.accent.second})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              fontSize: 46,
              fontWeight: 800,
              border: `1px solid ${palette.hairline}`,
              boxShadow: `0 14px 40px ${withAlpha(p.accent.base, 0.28)}`,
            }}
          >
            {p.avatar ? "" : initials(p.name)}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: typeScale.heading, fontWeight: 800, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
                {truncate(p.name || "Community", 26)}
              </div>
              {p.verified ? <Seal size={32} colors={p.badgeColors} /> : null}
            </div>
            <Chips items={[p.category, p.note]} accent={p.accent} />
          </div>
        </div>

        {p.description ? (
          <Clamp lines={2} size={typeScale.body - 2} color={palette.textMuted} lh={1.45} style={{ maxWidth: 1000 }}>
            {p.description}
          </Clamp>
        ) : null}

        {stats.length ? <StatRow items={stats} accent={p.accent} /> : null}
      </div>
    </Canvas>
  )
}

function statsFor(p: OgPayload): { value: string; label: string }[] {
  const own = p.stat && p.statLabel ? [{ value: formatCount(p.stat), label: p.statLabel }] : []
  return [...own, ...(p.extraStats || [])].filter((s) => s.value && s.value !== "0").slice(0, 4)
}

/** Duel — debate prompt above a two-sided face-off with a VS medallion. */
export function DuelTemplate({ p }: { p: OgPayload }) {
  const [left, right] = p.sides || []
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Duel" note={p.url || "loopapp.me — settle it in public"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 28 }}
      >
        <Clamp
          lines={3}
          size={typeScale.title}
          weight={800}
          lh={1.14}
          letterSpacing="-0.03em"
          style={{ maxWidth: 1000 }}
        >
          {p.title}
        </Clamp>

        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <DuelSide person={left} align="left" accent={p.accent} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 76,
              height: 76,
              borderRadius: 999,
              background: `linear-gradient(135deg, ${p.accent.base}, ${p.accent.second})`,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "#FFFFFF",
              boxShadow: `0 10px 30px ${withAlpha(p.accent.base, 0.35)}`,
            }}
          >
            VS
          </div>

          <DuelSide person={right} align="right" accent={p.accent} />
        </div>

        {p.date || p.category ? <Chips items={[p.date, p.category]} accent={p.accent} /> : null}
      </div>
    </Canvas>
  )
}

function DuelSide({
  person,
  align,
  accent,
}: {
  person?: OgPerson
  align: "left" | "right"
  accent: Accent
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexDirection: align === "left" ? "row" : "row-reverse",
        gap: 18,
        flex: 1,
        minWidth: 0,
        padding: "20px 24px",
        borderRadius: 22,
        background: withAlpha(accent.base, 0.1),
        border: `1px solid ${withAlpha(accent.base, 0.32)}`,
      }}
    >
      <Avatar src={person?.avatar} name={person?.name || person?.username} size={74} ring={accent.base} />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
          alignItems: align === "left" ? "flex-start" : "flex-end",
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
          {truncate(person?.name || person?.username || "Open floor", 18)}
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.16em", color: accent.base }}>
          {align === "left" ? "FOR" : "AGAINST"}
        </div>
      </div>
    </div>
  )
}

/** Co-Loop — contributors first, then the session they are building. */
export function CoLoopTemplate({ p }: { p: OgPayload }) {
  const people = p.people || []
  const names = people.map((x) => `@${x.username || x.name || ""}`).filter((x) => x !== "@").join("   ·   ")
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Co-Loop" note={p.url || "loopapp.me/co-loop"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 28 }}
      >
        {people.length ? <AvatarGroup people={people} size={78} ring={p.accent.base} /> : null}

        <Clamp lines={2} size={typeScale.title} weight={800} lh={1.12} letterSpacing="-0.03em" style={{ maxWidth: 980 }}>
          {p.title}
        </Clamp>

        <Clamp lines={2} size={typeScale.body - 2} color={palette.textMuted} lh={1.45} style={{ maxWidth: 940 }}>
          {p.description}
        </Clamp>

        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <Chips items={[p.date, p.category]} accent={p.accent} />
          {names ? (
            <div style={{ fontSize: 20, color: palette.textFaint, whiteSpace: "nowrap", overflow: "hidden" }}>
              {truncate(names, 54)}
            </div>
          ) : null}
        </div>
      </div>
    </Canvas>
  )
}

/** Reel — artwork leads, creator and caption support it. */
export function ReelTemplate({ p }: { p: OgPayload }) {
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Reel" note={p.url || "loopapp.me/reels"}>
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 44 }}>
        <div
          style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, justifyContent: "center", gap: 26 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Avatar src={p.avatar} name={p.name || p.username} size={70} ring={p.accent.base} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ fontSize: 27, fontWeight: 800, whiteSpace: "nowrap" }}>
                  {truncate(p.name || p.username || "Loop", 22)}
                </div>
                {p.verified ? <Seal size={25} colors={p.badgeColors} /> : null}
              </div>
              {p.username ? (
                <div style={{ display: "flex", fontSize: 20, color: palette.textFaint }}>{`@${p.username}`}</div>
              ) : null}
            </div>
          </div>

          <Clamp lines={4} size={typeScale.heading - 4} weight={700} lh={1.2} letterSpacing="-0.025em">
            {p.body || p.description}
          </Clamp>

          <Chips items={[p.date, p.category]} accent={p.accent} />
        </div>

        <div style={{ display: "flex", width: 430, height: "100%" }}>
          <MediaPanel
            src={p.media}
            accent={p.accent}
            glyph={<PlayGlyph size={88} />}
            overlay={
              p.stat && p.statLabel ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 19,
                    fontWeight: 700,
                    color: "rgba(255,255,255,0.92)",
                  }}
                >
                  {formatCount(p.stat)} {String(p.statLabel).toUpperCase()}
                </div>
              ) : null
            }
          />
        </div>
      </div>
    </Canvas>
  )
}

/** Project — title, description, author, collaborators and readouts. */
export function ProjectTemplate({ p }: { p: OgPayload }) {
  const stats = statsFor(p)
  const people = p.people || []
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Project" note={p.url || "loopapp.me/developers"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 26 }}
      >
        <Clamp lines={2} size={typeScale.title} weight={800} lh={1.12} letterSpacing="-0.03em" style={{ maxWidth: 1000 }}>
          {p.title}
        </Clamp>

        <Clamp lines={2} size={typeScale.body - 2} color={palette.textMuted} lh={1.45} style={{ maxWidth: 960 }}>
          {p.description}
        </Clamp>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
            <Avatar src={p.avatar} name={p.name || p.username} size={64} ring={p.accent.base} />
            <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700, whiteSpace: "nowrap" }}>
                {truncate(p.name || p.username || "Loop developer", 22)}
              </div>
              <div style={{ fontSize: 18, color: palette.textFaint, letterSpacing: "0.1em" }}>
                {p.username ? `@${p.username}` : "LOOP DEVELOPERS"}
              </div>
            </div>
            {people.length ? <AvatarGroup people={people} size={54} ring={p.accent.base} /> : null}
          </div>

          {stats.length ? <StatRow items={stats} accent={p.accent} /> : null}
        </div>

        <Chips items={[p.category, p.date]} accent={p.accent} />
      </div>
    </Canvas>
  )
}

/** Event — date tile anchors the left, schedule details fill the right. */
export function EventTemplate({ p }: { p: OgPayload }) {
  const stats = statsFor(p)
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Event" note={p.url || "loopapp.me/events"}>
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 44, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 214,
            height: 214,
            borderRadius: 36,
            background: `linear-gradient(150deg, ${p.accent.base}, ${p.accent.second})`,
            boxShadow: `0 18px 44px ${withAlpha(p.accent.base, 0.34)}`,
            gap: 4,
          }}
        >
          <div style={{ fontSize: 74, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em" }}>
            {p.dateBlock?.day || "—"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.24em" }}>
            {(p.dateBlock?.month || "").toUpperCase()}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: 22 }}>
          <Clamp lines={3} size={typeScale.heading} weight={800} lh={1.14} letterSpacing="-0.03em">
            {p.title}
          </Clamp>

          <Clamp lines={2} size={typeScale.body - 4} color={palette.textMuted} lh={1.45}>
            {p.description}
          </Clamp>

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Chips items={[p.category, p.date]} accent={p.accent} />
            {stats.length ? <StatRow items={stats.slice(0, 2)} accent={p.accent} /> : null}
          </div>
        </div>
      </div>
    </Canvas>
  )
}

/** Challenge — title, brief, then a measured progress bar. */
export function ChallengeTemplate({ p }: { p: OgPayload }) {
  const progress = p.progress
  const pct = progress && progress.max > 0 ? Math.min(100, Math.max(4, (progress.value / progress.max) * 100)) : 0
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Challenge" note={p.url || "loopapp.me/quests"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 26 }}
      >
        <Clamp lines={2} size={typeScale.title} weight={800} lh={1.12} letterSpacing="-0.03em" style={{ maxWidth: 1010 }}>
          {p.title}
        </Clamp>

        <Clamp lines={2} size={typeScale.body - 2} color={palette.textMuted} lh={1.45} style={{ maxWidth: 940 }}>
          {p.description}
        </Clamp>

        {progress ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 19,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: palette.textMuted,
              }}
            >
              <div>{truncate(progress.label, 40).toUpperCase()}</div>
              <div style={{ display: "flex", color: p.accent.base }}>
                {`${formatCount(progress.value)} / ${formatCount(progress.max)}`}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 16,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${p.accent.base}, ${p.accent.second})`,
                }}
              />
            </div>
          </div>
        ) : null}

        <Chips items={[p.category, p.date]} accent={p.accent} />
      </div>
    </Canvas>
  )
}

/** Space — banner-led identity for community spaces. */
export function SpaceTemplate({ p }: { p: OgPayload }) {
  const stats = statsFor(p)
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker="Space" note={p.url || "loopapp.me"}>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, justifyContent: "center", gap: 22 }}
      >
        <div style={{ position: "relative", display: "flex", width: "100%", height: 162 }}>
          <MediaPanel src={p.media} accent={p.accent} />
          <div style={{ position: "absolute", display: "flex", left: 26, bottom: -38 }}>
            <Avatar src={p.avatar} name={p.name} size={96} ring={p.accent.base} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
          <div style={{ fontSize: typeScale.heading, fontWeight: 800, letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
            {truncate(p.name || "Space", 26)}
          </div>
          {p.verified ? <Seal size={32} colors={p.badgeColors} /> : null}
        </div>

        <Clamp lines={2} size={typeScale.body - 4} color={palette.textMuted} lh={1.45} style={{ maxWidth: 960 }}>
          {p.description}
        </Clamp>

        <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
          <Chips items={[p.category]} accent={p.accent} />
          {stats.length ? <StatRow items={stats.slice(0, 3)} accent={p.accent} /> : null}
        </div>
      </div>
    </Canvas>
  )
}

/**
 * Fallback — used when a page cannot be resolved (deleted content, unknown
 * type, private entity). Still fully branded, never a broken image.
 */
export function FallbackTemplate({ p }: { p: OgPayload }) {
  return (
    <Canvas accent={p.accent} logo={p.logo} kicker={p.category || "Loop"} note={p.title || "loopapp.me"}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          textAlign: "center",
        }}
      >
        <Logo size={104} src={p.logo} radius={30} />
        <div style={{ fontSize: typeScale.title, fontWeight: 800, letterSpacing: "-0.03em" }}>
          {truncate(p.name || "Loop", 30)}
        </div>
        <Clamp
          lines={2}
          size={typeScale.body - 4}
          color={palette.textMuted}
          lh={1.45}
          style={{ maxWidth: 820, justifyContent: "center" }}
        >
          {p.description}
        </Clamp>
      </div>
    </Canvas>
  )
}


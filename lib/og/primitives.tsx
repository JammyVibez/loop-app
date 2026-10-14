/**
 * Reusable OG primitives.
 *
 * All 11 templates are assembled from these so every card shares one
 * visual language: same ink, same brand lockup, same footer, same type
 * rhythm. Rendered through satori — flexbox, gradients and line-clamp only.
 */

import type { CSSProperties, ReactNode } from "react"
import type { Accent } from "./theme"
import { fonts, layout, palette, wash, withAlpha } from "./theme"
import { initials } from "./text"

interface CanvasProps {
  accent: Accent
  /** Short uppercase context shown top-right, e.g. "Community". */
  kicker?: string
  /** Right-hand footer note, e.g. a canonical path. */
  note?: string
  /** Optional extra wash strength for busier templates. */
  glow?: number
  /** Official Loop app icon inlined as a data URI (falls back to the drawn mark). */
  logo?: string
  children?: ReactNode
}

/**
 * The shared 1200x630 shell: ink background, one restrained accent wash,
 * a hairline grid, the Loop lockup on top and the branded footer below.
 * Templates only ever author the middle band.
 */
export function Canvas({ accent, kicker, note, glow = 0.3, logo, children }: CanvasProps) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: 1200,
        height: 630,
        padding: `${layout.padTop}px ${layout.padX}px ${layout.padBottom}px`,
        background: `linear-gradient(160deg, ${palette.inkSoft} 0%, ${palette.ink} 62%, #05060F 100%)`,
        color: palette.text,
        fontFamily: fonts.sans,
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", inset: 0, background: wash(accent.base, "tr", glow) }} />
      <div style={{ position: "absolute", inset: 0, background: wash(accent.second, "bl", glow * 0.55) }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: "46px 46px",
        }}
      />

      <BrandBar kicker={kicker} accent={accent} logo={logo} />

      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, position: "relative" }}>
        {children}
      </div>

      <Footer note={note} accent={accent} />
    </div>
  )
}

/** The official app icon; drawn mark only when it could not be inlined. */
export function Logo({ size = 42, src, radius }: { size?: number; src?: string; radius?: number }) {
  const r = radius ?? Math.round(size * 0.28)
  if (src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: r,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: `0 6px 18px ${withAlpha(palette.indigo, 0.35)}`,
        }}
      />
    )
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: r,
        background: `linear-gradient(135deg, ${palette.indigo}, ${palette.violet})`,
        color: "#FFFFFF",
        fontSize: Math.round(size * 0.56),
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      L
    </div>
  )
}

function BrandBar({ kicker, accent, logo }: { kicker?: string; accent: Accent; logo?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 34 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Logo size={44} src={logo} />
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: "-0.02em" }}>loopapp.me</div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.22em", color: accent.base }}>
            SOCIAL OS
          </div>
        </div>
      </div>
      {kicker ? <Pill label={kicker} accent={accent} /> : <div />}
    </div>
  )
}

function Footer({ note, accent }: { note?: string; accent: Accent }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 28,
        paddingTop: 20,
        borderTop: `1px solid ${palette.hairlineSoft}`,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div
          style={{ width: 9, height: 9, borderRadius: 999, background: `linear-gradient(135deg, ${accent.base}, ${accent.second})` }}
        />
        <div style={{ fontSize: 18, fontWeight: 600, color: palette.textFaint, letterSpacing: "0.02em" }}>
          {note || "Build together, not just post"}
        </div>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.34)", letterSpacing: "0.14em" }}>
        LOOP
      </div>
    </div>
  )
}

export function Pill({ label, accent, solid }: { label: string; accent: Accent; solid?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "9px 20px",
        borderRadius: 999,
        border: `1.5px solid ${solid ? "transparent" : withAlpha(accent.base, 0.5)}`,
        background: solid ? accent.base : withAlpha(accent.base, 0.14),
        color: solid ? "#FFFFFF" : accent.base,
        fontSize: 16,
        fontWeight: 800,
        letterSpacing: "0.12em",
      }}
    >
      {String(label || "").toUpperCase()}
    </div>
  )
}

/** Avatar disc — real image when inlined, monogram otherwise. */
export function Avatar({
  src,
  name,
  size = 72,
  ring,
}: {
  src?: string
  name?: string
  size?: number
  ring?: string
}) {
  const inner = size - (ring ? 6 : 0)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        padding: ring ? 3 : 0,
        background: ring
          ? `linear-gradient(135deg, ${ring}, ${withAlpha(ring, 0.35)})`
          : withAlpha(palette.accent, 0.28),
        boxSizing: "border-box",
      }}
    >
      {src ? (
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: 999,
            backgroundImage: `url(${src})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "1px solid rgba(255,255,255,0.14)",
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: inner,
            height: inner,
            borderRadius: 999,
            background: palette.panelHigh,
            color: "rgba(255,255,255,0.86)",
            fontSize: Math.round(size * 0.38),
            fontWeight: 800,
          }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  )
}

/** Overlapping avatars for contributors / participants. */
export function AvatarGroup({
  people,
  size = 54,
  ring,
}: {
  people: { name?: string; src?: string }[]
  size?: number
  ring?: string
}) {
  const shown = people.slice(0, 4)
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {shown.map((p, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: shown.length - i }}>
          <Avatar src={p.src} name={p.name} size={size} ring={ring || palette.ink} />
        </div>
      ))}
    </div>
  )
}

/** Gradient disc with a white check — the verification seal. */
export function Seal({ size = 28, colors }: { size?: number; colors?: string[] }) {
  const from = colors?.[0] || palette.cyan
  const to = colors?.[1] || colors?.[0] || palette.indigo
  const stroke = Math.max(2, Math.round(size * 0.11))
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      <div
        style={{
          width: size * 0.42,
          height: size * 0.24,
          marginTop: -size * 0.05,
          borderLeft: `${stroke}px solid #FFFFFF`,
          borderBottom: `${stroke}px solid #FFFFFF`,
          transform: "rotate(-45deg)",
        }}
      />
    </div>
  )
}

export function ProBadge({ label = "PRO" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        padding: "5px 13px",
        borderRadius: 999,
        background: `linear-gradient(135deg, #FBBF24, ${palette.amber})`,
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: "0.08em",
        color: "#241505",
      }}
    >
      {String(label).toUpperCase()}
    </div>
  )
}

/** Line-clamped text block — satori honours -webkit-box clamping. */
export function Clamp({
  children,
  lines = 4,
  size = 30,
  weight = 500,
  color = "rgba(255,255,255,0.94)",
  lh = 1.38,
  letterSpacing = "-0.01em",
  style,
}: {
  children: ReactNode
  lines?: number
  size?: number
  weight?: number
  color?: string
  lh?: number
  letterSpacing?: string
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        fontSize: size,
        fontWeight: weight,
        lineHeight: lh,
        letterSpacing,
        color,
        whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Small uppercase section label. */
export function SectionLabel({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "0.2em", color: color || palette.textFaint }}>
      {children}
    </div>
  )
}

/** Row of stat readouts: value over label, separated by hairlines. */
export function StatRow({ items, accent }: { items: { value: string; label: string }[]; accent: Accent }) {
  const shown = items.filter((i) => i && i.value).slice(0, 4)
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
      {shown.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            paddingRight: i === shown.length - 1 ? 0 : 34,
            marginRight: i === shown.length - 1 ? 0 : 34,
            borderRight:
              i === shown.length - 1 ? "none" : `1px solid ${withAlpha(accent.base, 0.32)}`,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", color: palette.text }}>
            {item.value}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.14em", color: palette.textFaint }}>
            {String(item.label || "").toUpperCase()}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Compact chips row: date, category, status. */
export function Chips({ items, accent }: { items: (string | undefined)[]; accent: Accent }) {
  const shown = items.filter(Boolean).slice(0, 4) as string[]
  if (!shown.length) return null
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {shown.map((label, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "8px 16px",
            borderRadius: 999,
            background: i === 0 ? withAlpha(accent.base, 0.16) : "rgba(255,255,255,0.06)",
            border: `1px solid ${i === 0 ? withAlpha(accent.base, 0.4) : palette.hairline}`,
            color: i === 0 ? accent.base : palette.textMuted,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "0.04em",
          }}
        >
          {String(label).toUpperCase()}
        </div>
      ))}
    </div>
  )
}

/**
 * Media frame. Real artwork when available; when it is not (deleted upload,
 * blocked host, private media) it renders a deliberate hatched panel with the
 * accent glyph rather than a hole in the composition.
 */
export function MediaPanel({
  src,
  accent,
  glyph,
  overlay,
}: {
  src?: string
  accent: Accent
  glyph?: ReactNode
  overlay?: ReactNode
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        borderRadius: 24,
        overflow: "hidden",
        border: `1px solid ${palette.hairline}`,
        background: src
          ? `linear-gradient(135deg, ${palette.panelHigh}, ${palette.panel})`
          : `repeating-linear-gradient(135deg, ${withAlpha(accent.base, 0.1)} 0 2px, transparent 2px 16px), ${palette.panel}`,
      }}
    >
      {src ? (
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }} />
      ) : null}

      {!src && glyph ? glyph : null}

      {src ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, ${withAlpha(palette.ink, 0.72)} 0%, ${withAlpha(palette.ink, 0)} 55%)`,
          }}
        />
      ) : null}

      {overlay ? <div style={{ position: "absolute", left: 24, right: 24, bottom: 22 }}>{overlay}</div> : null}
    </div>
  )
}

/** Play glyph used on reel / video artwork. */
export function PlayGlyph({ size = 74 }: { size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        background: withAlpha(palette.ink, 0.55),
        border: "2px solid rgba(255,255,255,0.5)",
      }}
    >
      <div
        style={{
          marginLeft: size * 0.08,
          width: 0,
          height: 0,
          borderTop: `${size * 0.16}px solid transparent`,
          borderBottom: `${size * 0.16}px solid transparent`,
          borderLeft: `${size * 0.26}px solid rgba(255,255,255,0.92)`,
        }}
      />
    </div>
  )
}

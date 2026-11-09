"use client"

import { useId } from "react"
import type { GiftArt } from "@/lib/gifts/catalog"
import { cn } from "@/lib/utils"

/**
 * Hand-built SVG gift art. No emoji, no flat icon font, no network asset —
 * every gift renders identically on first paint and can be scaled to a card
 * thumbnail or a full-screen hero without losing detail.
 */
export function GiftArtwork({
  art,
  className,
  title,
}: {
  art?: GiftArt | string | null
  className?: string
  title?: string
}) {
  return (
    <div className={cn("relative flex items-center justify-center", className)} role="img" aria-label={title}>
      {renderArt(art)}
    </div>
  )
}

function renderArt(art?: string | null) {
  switch (art) {
    case "pixel-heart":
      return <PixelHeart />
    case "cute-cat":
      return <CuteCat />
    case "golden-trophy":
      return <GoldenTrophy />
    case "rainbow-unicorn":
      return <RainbowUnicorn />
    case "royal-crown":
      return <RoyalCrown />
    case "golden-rocket":
      return <GoldenRocket />
    case "dragon-flame":
      return <DragonFlame />
    case "galaxy-blast":
      return <GalaxyBlast />
    case "supercar":
      return <Supercar />
    case "shooting-star":
      return <ShootingStar />
    default:
      return <GiftBox />
  }
}

const base = "h-full w-full overflow-visible"

function PixelHeart() {
  const id = useId()
  const cells = [
    [1, 1], [2, 1], [5, 1], [6, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [7, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
    [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4],
    [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
    [2, 6], [3, 6], [4, 6], [5, 6],
    [3, 7], [4, 7],
  ]
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7aa2" />
          <stop offset="55%" stopColor="#ff2d6f" />
          <stop offset="100%" stopColor="#c2185b" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="48" cy="48" r="34" fill={`url(#${id}-a)`} opacity="0.18" />
      <g filter={`url(#${id}-glow)`}>
        {cells.map(([cx, cy]) => (
          <rect
            key={`${cx}-${cy}`}
            x={cx * 12 + 1}
            y={cy * 11 + 9}
            width="10"
            height="10"
            rx="2.2"
            fill={`url(#${id}-a)`}
            stroke="#ffb3cb"
            strokeWidth="0.8"
          />
        ))}
      </g>
      <rect x="37" y="24" width="7" height="5" rx="1.4" fill="#ffe3ec" opacity="0.85" />
    </svg>
  )
}

function CuteCat() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#ffd9a8" />
          <stop offset="60%" stopColor="#ffb26b" />
          <stop offset="100%" stopColor="#e58b3c" />
        </linearGradient>
        <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6b9d" />
          <stop offset="100%" stopColor="#c2185b" />
        </linearGradient>
      </defs>
      <ellipse cx="48" cy="80" rx="30" ry="6" fill="#000" opacity="0.18" />
      <path d="M24 40 L20 20 L38 30 Z" fill={`url(#${id}-fur)`} stroke="#c97a35" strokeWidth="1.5" />
      <path d="M72 40 L76 20 L58 30 Z" fill={`url(#${id}-fur)`} stroke="#c97a35" strokeWidth="1.5" />
      <path d="M27 34 L25 24 L34 29 Z" fill="#ff9db4" />
      <path d="M69 34 L71 24 L62 29 Z" fill="#ff9db4" />
      <ellipse cx="48" cy="54" rx="29" ry="25" fill={`url(#${id}-fur)`} stroke="#c97a35" strokeWidth="1.5" />
      <ellipse cx="48" cy="68" rx="15" ry="10" fill="#fff0dc" />
      <path d="M38 50 q4 5 8 0" stroke="#5b3a1f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M50 50 q4 5 8 0" stroke="#5b3a1f" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M45 60 q3 3 6 0" stroke="#e07a7a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M48 62 v4 M44 65 q4 4 8 0" stroke="#b06a3b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <g stroke="#a86a3f" strokeWidth="1.4" strokeLinecap="round">
        <path d="M30 60 h-10" />
        <path d="M30 65 l-9 3" />
        <path d="M66 60 h10" />
        <path d="M66 65 l9 3" />
      </g>
      <circle cx="30" cy="62" r="4" fill="#ff9db4" opacity="0.5" />
      <circle cx="66" cy="62" r="4" fill="#ff9db4" opacity="0.5" />
      <path d="M40 34 q8 -8 16 0 q-8 5 -16 0 Z" fill={`url(#${id}-ribbon)`} />
      <circle cx="48" cy="34" r="3" fill="#ffe0ec" />
      <path d="M76 18 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#ffe3a8" opacity="0.9" />
      <path d="M18 28 l1.5 3 3 1.5 -3 1.5 -1.5 3 -1.5 -3 -3 -1.5 3 -1.5 Z" fill="#ffe3a8" opacity="0.7" />
    </svg>
  )
}

function GoldenTrophy() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff3bf" />
          <stop offset="35%" stopColor="#f7c948" />
          <stop offset="70%" stopColor="#d69e2e" />
          <stop offset="100%" stopColor="#8a5a13" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fffbe6" />
          <stop offset="100%" stopColor="#f7c948" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="46" r="34" fill="#f7c948" opacity="0.14" />
      <path d="M28 22 h40 v10 c0 15 -9 25 -20 25 s-20 -10 -20 -25 Z" fill={`url(#${id}-gold)`} stroke="#8a5a13" strokeWidth="1.4" />
      <path d="M28 26 h-11 v7 c0 8 5 13 13 13" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M68 26 h11 v7 c0 8 -5 13 -13 13" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M44 57 h8 v13 h-8 Z" fill={`url(#${id}-gold)`} />
      <path d="M34 82 h28 l-4 -12 h-20 Z" fill={`url(#${id}-gold)`} stroke="#8a5a13" strokeWidth="1.2" />
      <path d="M35 34 h6 c0 8 -2 12 -6 14 Z" fill={`url(#${id}-shine)`} opacity="0.8" />
      <path d="M48 30 l3.4 7 7.6 1 -5.6 5.4 1.4 7.6 -6.8 -3.7 -6.8 3.7 1.4 -7.6 -5.6 -5.4 7.6 -1 Z" fill="#fff8dc" stroke="#b7791f" strokeWidth="1" />
      <path d="M78 16 l2 4.4 4.4 2 -4.4 2 -2 4.4 -2 -4.4 -4.4 -2 4.4 -2 Z" fill="#ffe89a" />
    </svg>
  )
}

function RainbowUnicorn() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rain`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#f472b6" />
          <stop offset="35%" stopColor="#c084fc" />
          <stop offset="65%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#86efac" />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f3e8ff" />
          <stop offset="100%" stopColor="#d8c7f0" />
        </linearGradient>
        <linearGradient id={`${id}-horn`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="35" fill={`url(#${id}-rain)`} opacity="0.15" />
      <path
        d="M58 26 C42 30 34 40 34 52 C34 66 45 76 60 78 L74 68 C62 66 54 60 54 50 C54 41 60 34 70 30 Z"
        fill={`url(#${id}-face)`}
        stroke="#b9a3dd"
        strokeWidth="1.2"
      />
      <path d="M50 29 L53 10 L62 28 Z" fill={`url(#${id}-horn)`} stroke="#b7791f" strokeWidth="1" />
      <path d="M54 22 l4 2 M52 27 l4 2" stroke="#fff7d6" strokeWidth="1.2" opacity="0.8" />
      <path d="M62 28 C70 32 72 40 70 48" stroke={`url(#${id}-rain)`} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M66 34 C76 40 77 52 72 60" stroke={`url(#${id}-rain)`} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.85" />
      <path d="M58 32 C66 38 66 48 62 56" stroke={`url(#${id}-rain)`} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
      <path d="M40 44 l4 6 -5 2 Z" fill="#c4a7ea" />
      <circle cx="66" cy="46" r="2.6" fill="#5b3a7e" />
      <circle cx="67" cy="45" r="0.9" fill="#fff" />
      <ellipse cx="63" cy="64" rx="6" ry="4.4" fill="#f9a8d4" opacity="0.55" />
      <circle cx="25" cy="34" r="2.4" fill="#f9a8d4" />
      <circle cx="30" cy="24" r="1.6" fill="#a5f3fc" />
      <circle cx="20" cy="52" r="1.8" fill="#fde68a" />
      <path d="M24 66 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#c4b5fd" opacity="0.8" />
    </svg>
  )
}

function RoyalCrown() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#fff3bf" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
        <linearGradient id={`${id}-violet`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="50" r="34" fill="#fbbf24" opacity="0.16" />
      <path
        d="M18 68 L14 30 L32 44 L48 18 L64 44 L82 30 L78 68 Z"
        fill={`url(#${id}-gold)`}
        stroke="#7c4a05"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M20 60 h56 v10 H20 Z" fill={`url(#${id}-violet)`} stroke="#4c1d95" strokeWidth="1.2" />
      <path d="M20 60 h56 v3 H20 Z" fill="#fde68a" opacity="0.8" />
      <circle cx="14" cy="28" r="4" fill="#fde68a" stroke="#92400e" strokeWidth="1" />
      <circle cx="82" cy="28" r="4" fill="#fde68a" stroke="#92400e" strokeWidth="1" />
      <circle cx="48" cy="16" r="4.5" fill="#fde68a" stroke="#92400e" strokeWidth="1" />
      <circle cx="48" cy="65" r="3.4" fill="#67e8f9" stroke="#0e7490" strokeWidth="0.9" />
      <circle cx="31" cy="65" r="2.8" fill="#f472b6" />
      <circle cx="65" cy="65" r="2.8" fill="#f472b6" />
      <path d="M34 50 l4 6 6 -8" stroke="#fff8dc" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M74 14 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 Z" fill="#fef3c7" />
    </svg>
  )
}

function GoldenRocket() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff7cc" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7ed" />
          <stop offset="45%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="44" r="33" fill="#fbbf24" opacity="0.12" />
      <g transform="rotate(38 48 48)">
        <path d="M38 62 C32 74 38 82 48 88 C58 82 64 74 58 62 Z" fill={`url(#${id}-flame)`} />
        <path d="M30 56 C22 60 20 68 24 72 L38 66 Z" fill="#d69e2e" stroke="#8a5a13" strokeWidth="1" />
        <path d="M66 56 C74 60 76 68 72 72 L58 66 Z" fill="#d69e2e" stroke="#8a5a13" strokeWidth="1" />
        <path d="M48 8 C60 20 64 38 62 60 L34 60 C32 38 36 20 48 8 Z" fill={`url(#${id}-body)`} stroke="#8a5a13" strokeWidth="1.4" />
        <circle cx="48" cy="34" r="8" fill="#0e7490" stroke="#fef3c7" strokeWidth="2.4" />
        <circle cx="45" cy="31" r="2.4" fill="#a5f3fc" opacity="0.9" />
        <path d="M48 8 L54 22 L42 22 Z" fill="#fff7cc" />
        <path d="M40 46 h16 M41 52 h14" stroke="#8a5a13" strokeWidth="1.3" opacity="0.6" />
      </g>
      <path d="M16 22 l2 4.4 4.4 2 -4.4 2 -2 4.4 -2 -4.4 -4.4 -2 4.4 -2 Z" fill="#fde68a" opacity="0.9" />
      <path d="M76 70 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z" fill="#fde68a" opacity="0.7" />
    </svg>
  )
}

function DragonFlame() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-scale`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7f1d1d" />
          <stop offset="55%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#450a0a" />
        </linearGradient>
        <linearGradient id={`${id}-fire`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="34" fill="#ef4444" opacity="0.14" />
      <path
        d="M22 52 C22 34 34 22 52 22 C66 22 76 30 80 42 L66 46 C66 56 58 64 46 64 L38 76 L28 70 L34 58 C27 56 22 54 22 52 Z"
        fill={`url(#${id}-scale)`}
        stroke="#fca5a5"
        strokeWidth="1.1"
      />
      <path d="M52 22 L58 8 L64 24 L74 16 L72 32" fill="none" stroke="#f87171" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 34 q8 -4 14 4 q-6 6 -14 0 Z" fill="#fde68a" />
      <ellipse cx="51" cy="37" rx="2.2" ry="4" fill="#1c1917" />
      <path d="M30 48 q6 4 12 2" stroke="#fca5a5" strokeWidth="1.4" fill="none" />
      <path d="M74 44 C84 46 90 52 92 60 C86 56 80 55 74 56 C82 62 84 70 82 76 C76 68 68 64 60 64 C68 60 72 54 74 44 Z" fill={`url(#${id}-fire)`} />
      <path d="M60 30 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#fef3c7" opacity="0.85" />
      <circle cx="22" cy="30" r="1.8" fill="#fca5a5" />
      <circle cx="30" cy="18" r="1.4" fill="#fde68a" />
    </svg>
  )
}

function GalaxyBlast() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#f0abfc" />
          <stop offset="35%" stopColor="#a855f7" />
          <stop offset="75%" stopColor="#312e81" />
          <stop offset="100%" stopColor="#0b1026" />
        </radialGradient>
        <linearGradient id={`${id}-swirl`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="50%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
        <linearGradient id={`${id}-ring`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="48" r="34" fill={`url(#${id}-core)`} />
      <ellipse cx="48" cy="48" rx="36" ry="12" fill="none" stroke={`url(#${id}-ring)`} strokeWidth="2" opacity="0.55" transform="rotate(-28 48 48)" />
      <path d="M18 44 C30 30 62 28 74 42 C62 38 38 40 26 50 C22 54 20 60 22 66 C16 58 16 50 18 44 Z" fill={`url(#${id}-swirl)`} opacity="0.8" />
      <path d="M34 62 C46 54 62 56 74 64 C60 62 48 66 40 72 C36 74 33 72 34 62 Z" fill="#a5f3fc" opacity="0.55" />
      <circle cx="48" cy="47" r="7" fill="#fdf4ff" opacity="0.95" />
      <circle cx="48" cy="47" r="13" fill="#f0abfc" opacity="0.22" />
      <g fill="#e0f2fe">
        <circle cx="22" cy="26" r="1.5" />
        <circle cx="74" cy="24" r="1.1" />
        <circle cx="80" cy="52" r="1.6" />
        <circle cx="18" cy="56" r="1.2" />
        <circle cx="62" cy="16" r="1.3" />
        <circle cx="36" cy="78" r="1.4" />
      </g>
      <g fill="#f0abfc" opacity="0.85">
        <circle cx="28" cy="70" r="1" />
        <circle cx="70" cy="72" r="1.2" />
        <circle cx="58" cy="82" r="0.9" />
      </g>
      <path d="M78 34 l1.4 3.4 3.4 1.4 -3.4 1.4 -1.4 3.4 -1.4 -3.4 -3.4 -1.4 3.4 -1.4 Z" fill="#f0abfc" />
    </svg>
  )
}

function Supercar() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-paint`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="35%" stopColor="#ef4444" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>
        <linearGradient id={`${id}-speed`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      <circle cx="48" cy="52" r="33" fill="#ef4444" opacity="0.12" />
      <g stroke={`url(#${id}-speed)`} strokeWidth="2" strokeLinecap="round">
        <path d="M6 42 h20" />
        <path d="M2 50 h16" />
        <path d="M8 58 h14" />
      </g>
      <path d="M18 62 C20 54 26 50 34 48 L50 34 C60 32 70 36 78 46 L84 54 C88 56 88 62 84 64 L24 66 C20 66 18 65 18 62 Z" fill={`url(#${id}-paint)`} stroke="#7f1d1d" strokeWidth="1.2" />
      <path d="M38 48 L50 38 C58 37 64 40 69 46 L72 50 L44 52 Z" fill={`url(#${id}-glass)`} opacity="0.95" />
      <path d="M60 50 h16 l4 4 h-22 Z" fill="#fde68a" opacity="0.9" />
      <path d="M19 56 h8" stroke="#fef2f2" strokeWidth="1.2" opacity="0.7" />
      <circle cx="32" cy="64" r="8" fill="#111" stroke="#fca5a5" strokeWidth="2" />
      <circle cx="32" cy="64" r="3" fill="#fde68a" />
      <circle cx="72" cy="64" r="8" fill="#111" stroke="#fca5a5" strokeWidth="2" />
      <circle cx="72" cy="64" r="3" fill="#fde68a" />
      <path d="M18 62 l-4 4 h44" stroke="#7f1d1d" strokeWidth="1.4" fill="none" />
      <path d="M84 22 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2 Z" fill="#fde68a" opacity="0.85" />
    </svg>
  )
}

function ShootingStar() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-trail`} x1="1" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="45%" stopColor="#c4b5fd" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-star`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fffef2" />
          <stop offset="55%" stopColor="#fde68a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="32" r="30" fill="#a78bfa" opacity="0.14" />
      <path d="M66 24 C48 40 28 56 10 72 C32 64 56 52 74 38 Z" fill={`url(#${id}-trail)`} />
      <path d="M82 14 l4.2 10 10.8 1 -8.6 7.2 2.8 10.4 -9.2 -5.8 -9.2 5.8 2.8 -10.4 -8.6 -7.2 10.8 -1 Z" fill={`url(#${id}-star)`} stroke="#fef3c7" strokeWidth="1" transform="translate(-8 8) scale(0.94)" />
      <path d="M62 22 l2 4.6 4.6 2 -4.6 2 -2 4.6 -2 -4.6 -4.6 -2 4.6 -2 Z" fill="#fef9c3" opacity="0.95" transform="translate(-4 4)" />
      <circle cx="26" cy="42" r="1.6" fill="#e0f2fe" />
      <circle cx="38" cy="28" r="1.1" fill="#f0abfc" />
      <circle cx="18" cy="58" r="1.2" fill="#e0f2fe" />
      <circle cx="46" cy="66" r="1.4" fill="#fde68a" />
      <circle cx="72" cy="62" r="1.1" fill="#f0abfc" />
    </svg>
  )
}

function GiftBox() {
  const id = useId()
  return (
    <svg viewBox="0 0 96 96" className={base} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-box`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect x="18" y="40" width="60" height="42" rx="6" fill={`url(#${id}-box)`} />
      <rect x="14" y="30" width="68" height="16" rx="5" fill="#a78bfa" />
      <rect x="43" y="30" width="10" height="52" fill="#fde68a" />
      <path d="M48 30 C36 22 26 24 28 32 C30 39 40 34 48 30 Z" fill="#fde68a" />
      <path d="M48 30 C60 22 70 24 68 32 C66 39 56 34 48 30 Z" fill="#fde68a" />
      <circle cx="48" cy="30" r="5" fill="#fbbf24" />
    </svg>
  )
}

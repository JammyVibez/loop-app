// Renders the anime profile themes used by scripts/seed-profile-theme.mjs.
//
// Each theme is a palette, a scrim and a motif (leaf swirl, flame, ocean,
// moonlight). The CSS template below is shared so every theme dresses the same
// profile hooks — cover, identity pane, tabs, post tiles/rows and the real
// LoopCard — while the motif keeps the four from looking like recolours.
//
// Run with: node scripts/generate-anime-profile-themes.mjs
// The generated files are committed; re-run after changing a palette or the
// template. The 21,000-byte profile CSS limit is enforced here too.
import { mkdirSync, writeFileSync } from "node:fs"

const CSS_LIMIT = 21000

const THEMES = [
  {
    slug: "naruto-hidden-leaf",
    name: "Naruto — Hidden Leaf",
    artLabel: "Hidden Leaf village at dusk with a swirling leaf crest",
    palette: {
      ink: "#fff3e2",
      muted: "rgba(255, 226, 198, 0.66)",
      accent: "#ff9a4d",
      accent2: "#63d29a",
      accent3: "#ffe8c9",
      bg: "#0a1020",
      surface: "#131f38",
      glass: "linear-gradient(160deg, rgba(19, 31, 56, 0.62), rgba(8, 14, 28, 0.76))",
      hairline: "rgba(255, 154, 77, 0.26)",
      cardBg: "linear-gradient(158deg, rgba(20, 30, 50, 0.7), rgba(8, 13, 24, 0.8))",
      cardBorder: "rgba(255, 154, 77, 0.28)",
      cardBorderStrong: "rgba(255, 196, 138, 0.62)",
      cardInk: "#fff3e2",
      cardMuted: "rgba(255, 226, 198, 0.64)",
      cardAccent: "#ffb374",
      cardGlow: "rgba(255, 138, 61, 0.5)",
      like: "#ff7a9c",
      coverTint: "rgba(255, 154, 77, 0.22)",
      coverTint2: "rgba(99, 210, 154, 0.18)",
      progress: "linear-gradient(90deg, #ff8a3d, #ffc46a 55%, #63d29a)",
    },
    motif: {
      coverSheen:
        "linear-gradient(112deg, transparent 32%, rgba(255, 214, 170, 0.26) 46%, rgba(255, 154, 77, 0.12) 56%, transparent 70%),\n    radial-gradient(60% 90% at 82% 10%, rgba(99, 210, 154, 0.22), transparent 70%)",
      animation: "hiddenLeafDrift",
      keyframes: `@keyframes hiddenLeafDrift {
  0%,
  100% {
    background-position: 130% 0, 0 0;
  }
  50% {
    background-position: -30% 0, 0 0;
  }
}`,
      scrim: `radial-gradient(90% 70% at 24% 38%, rgba(255, 138, 61, 0.18), transparent 64%),
    radial-gradient(70% 52% at 82% 16%, rgba(99, 210, 154, 0.16), transparent 66%),
    linear-gradient(180deg, rgba(5, 10, 20, 0.1), rgba(5, 10, 20, 0.42) 56%, rgba(5, 10, 20, 0.8))`,
      filter: "saturate(1.14) contrast(1.05)",
      extras: `/* A slow leaf spiral in the identity pane, drawn with a single conic
   gradient so no image request is needed. */
.loop-profile-custom-css .loop-profile-sidebar-column::after {
  content: "";
  position: absolute;
  top: 1.25rem;
  right: 0.9rem;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  pointer-events: none;
  background-image: conic-gradient(
    from 0deg,
    transparent 0deg,
    rgba(99, 210, 154, 0.26) 70deg,
    transparent 150deg,
    rgba(255, 154, 77, 0.22) 250deg,
    transparent 330deg
  );
  filter: blur(0.4px);
  animation: hiddenLeafSpin 22s linear infinite;
}

@keyframes hiddenLeafSpin {
  to {
    transform: rotate(360deg);
  }
}`,
    },
  },
  {
    slug: "demon-slayer-hinokami",
    name: "Demon Slayer — Hinokami",
    artLabel: "Hinokami flame crest over a checkered midnight horizon",
    palette: {
      ink: "#ffe9df",
      muted: "rgba(255, 214, 200, 0.64)",
      accent: "#ff5a33",
      accent2: "#ffd166",
      accent3: "#fff1e6",
      bg: "#0a0507",
      surface: "#1b0b0d",
      glass: "linear-gradient(160deg, rgba(31, 10, 13, 0.64), rgba(10, 4, 6, 0.78))",
      hairline: "rgba(255, 90, 51, 0.28)",
      cardBg: "linear-gradient(158deg, rgba(32, 11, 14, 0.72), rgba(9, 4, 6, 0.82))",
      cardBorder: "rgba(255, 90, 51, 0.3)",
      cardBorderStrong: "rgba(255, 209, 102, 0.6)",
      cardInk: "#ffe9df",
      cardMuted: "rgba(255, 214, 200, 0.62)",
      cardAccent: "#ffb08a",
      cardGlow: "rgba(255, 75, 43, 0.52)",
      like: "#ff9f7a",
      coverTint: "rgba(255, 90, 51, 0.24)",
      coverTint2: "rgba(255, 209, 102, 0.18)",
      progress: "linear-gradient(90deg, #ff4b2b, #ff8a3d 48%, #ffd166)",
    },
    motif: {
      coverSheen:
        "linear-gradient(112deg, transparent 34%, rgba(255, 220, 180, 0.24) 47%, rgba(255, 90, 51, 0.16) 58%, transparent 72%),\n    radial-gradient(70% 90% at 18% 8%, rgba(255, 75, 43, 0.24), transparent 66%)",
      animation: "hinokamiFlicker",
      keyframes: `@keyframes hinokamiFlicker {
  0%,
  100% {
    opacity: 0.7;
    background-position: 128% 0, 0 0;
  }
  40% {
    opacity: 1;
    background-position: 30% 0, 0 0;
  }
  62% {
    opacity: 0.84;
    background-position: -16% 0, 0 0;
  }
}`,
      scrim: `radial-gradient(88% 68% at 20% 34%, rgba(255, 75, 43, 0.2), transparent 62%),
    radial-gradient(64% 46% at 84% 20%, rgba(255, 209, 102, 0.14), transparent 68%),
    linear-gradient(180deg, rgba(9, 3, 5, 0.12), rgba(9, 3, 5, 0.44) 58%, rgba(9, 3, 5, 0.82))`,
      filter: "saturate(1.2) contrast(1.06)",
      extras: `/* The checkered haori band: a thin woven strip under the tab row. */
.loop-profile-custom-css .loop-profile-layout-cover::before {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 7px;
  z-index: 6;
  pointer-events: none;
  background-image: repeating-conic-gradient(
    from 90deg at 50% 50%,
    rgba(255, 209, 102, 0.7) 0deg 90deg,
    rgba(20, 6, 8, 0.85) 90deg 180deg
  );
  background-size: 14px 14px;
  mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent);
}

.loop-profile-custom-css .loop-profile-sidebar-column h2 {
  text-shadow:
    0 0 22px rgba(255, 75, 43, 0.55),
    0 1px 0 rgba(0, 0, 0, 0.6);
}`,
    },
  },
  {
    slug: "one-piece-grand-line",
    name: "One Piece — Grand Line",
    artLabel: "Grand Line sunset with a sailing ship and rolling waves",
    palette: {
      ink: "#f6fbff",
      muted: "rgba(206, 232, 245, 0.66)",
      accent: "#ffcf5c",
      accent2: "#38a9e0",
      accent3: "#fff4d1",
      bg: "#04101c",
      surface: "#0a2233",
      glass: "linear-gradient(160deg, rgba(10, 34, 51, 0.62), rgba(4, 14, 24, 0.76))",
      hairline: "rgba(56, 169, 224, 0.28)",
      cardBg: "linear-gradient(158deg, rgba(9, 32, 48, 0.7), rgba(4, 13, 22, 0.8))",
      cardBorder: "rgba(56, 169, 224, 0.28)",
      cardBorderStrong: "rgba(255, 207, 92, 0.62)",
      cardInk: "#f6fbff",
      cardMuted: "rgba(206, 232, 245, 0.64)",
      cardAccent: "#ffd97a",
      cardGlow: "rgba(56, 169, 224, 0.5)",
      like: "#ff8fa0",
      coverTint: "rgba(56, 169, 224, 0.24)",
      coverTint2: "rgba(255, 207, 92, 0.2)",
      progress: "linear-gradient(90deg, #1f7fae, #38a9e0 46%, #ffcf5c)",
    },
    motif: {
      coverSheen:
        "linear-gradient(112deg, transparent 30%, rgba(255, 244, 209, 0.26) 45%, rgba(56, 169, 224, 0.16) 58%, transparent 74%),\n    radial-gradient(80% 100% at 88% 4%, rgba(255, 207, 92, 0.2), transparent 62%)",
      animation: "grandLineSwell",
      keyframes: `@keyframes grandLineSwell {
  0%,
  100% {
    background-position: 132% 0, 0 0;
  }
  50% {
    background-position: -28% 0, 0 6px;
  }
}`,
      scrim: `radial-gradient(92% 70% at 30% 36%, rgba(56, 169, 224, 0.2), transparent 64%),
    radial-gradient(72% 54% at 86% 12%, rgba(255, 207, 92, 0.16), transparent 66%),
    linear-gradient(180deg, rgba(3, 12, 20, 0.1), rgba(3, 12, 20, 0.4) 56%, rgba(3, 12, 20, 0.8))`,
      filter: "saturate(1.16) contrast(1.04)",
      extras: `/* A rope-and-plank rule separates the identity pane from the posts. */
.loop-profile-custom-css .loop-profile-sidebar-column [data-profile-block="identity"] {
  border-bottom: 1px dashed rgba(255, 207, 92, 0.34);
  padding-bottom: 0.85rem;
}

.loop-profile-custom-css .loop-profile-sidebar-column::after {
  content: "";
  position: absolute;
  inset: auto 0.9rem 0.6rem;
  height: 12px;
  pointer-events: none;
  background-image: repeating-linear-gradient(
    90deg,
    rgba(255, 207, 92, 0.28) 0 10px,
    transparent 10px 20px
  );
  mask-image: linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 30%, #000 70%, transparent);
}`,
    },
  },
  {
    slug: "sailor-moon-prism",
    name: "Sailor Moon — Moon Prism",
    artLabel: "Silver crystal moon over a pastel prismatic night sky",
    palette: {
      ink: "#fff4fb",
      muted: "rgba(255, 220, 242, 0.66)",
      accent: "#ff8fc7",
      accent2: "#9fd8ff",
      accent3: "#fff1f9",
      bg: "#0a0718",
      surface: "#17102e",
      glass: "linear-gradient(160deg, rgba(30, 18, 58, 0.64), rgba(10, 7, 24, 0.78))",
      hairline: "rgba(255, 143, 199, 0.28)",
      cardBg: "linear-gradient(158deg, rgba(32, 19, 60, 0.7), rgba(10, 7, 24, 0.8))",
      cardBorder: "rgba(255, 143, 199, 0.3)",
      cardBorderStrong: "rgba(159, 216, 255, 0.62)",
      cardInk: "#fff4fb",
      cardMuted: "rgba(255, 220, 242, 0.64)",
      cardAccent: "#ffb3d8",
      cardGlow: "rgba(255, 143, 199, 0.52)",
      like: "#ff9ec4",
      coverTint: "rgba(255, 143, 199, 0.24)",
      coverTint2: "rgba(159, 216, 255, 0.22)",
      progress: "linear-gradient(90deg, #ff8fc7, #c9a7ff 52%, #9fd8ff)",
    },
    motif: {
      coverSheen:
        "linear-gradient(112deg, transparent 32%, rgba(255, 241, 249, 0.28) 46%, rgba(255, 143, 199, 0.16) 57%, transparent 72%),\n    radial-gradient(64% 92% at 78% 8%, rgba(159, 216, 255, 0.22), transparent 68%)",
      animation: "moonPrismShine",
      keyframes: `@keyframes moonPrismShine {
  0%,
  100% {
    background-position: 132% 0, 0 0;
    filter: hue-rotate(0deg);
  }
  50% {
    background-position: -28% 0, 0 0;
    filter: hue-rotate(18deg);
  }
}`,
      scrim: `radial-gradient(90% 70% at 26% 32%, rgba(255, 143, 199, 0.2), transparent 64%),
    radial-gradient(72% 56% at 84% 14%, rgba(159, 216, 255, 0.18), transparent 66%),
    linear-gradient(180deg, rgba(7, 5, 20, 0.1), rgba(7, 5, 20, 0.4) 56%, rgba(7, 5, 20, 0.8))`,
      filter: "saturate(1.12) contrast(1.03)",
      extras: `/* Crescent moon and stars behind the identity pane. */
.loop-profile-custom-css .loop-profile-sidebar-column::after {
  content: "";
  position: absolute;
  top: 1.1rem;
  right: 1rem;
  width: 66px;
  height: 66px;
  border-radius: 50%;
  pointer-events: none;
  box-shadow: -13px 8px 0 0 rgba(255, 241, 249, 0.16);
  background: radial-gradient(circle at 30% 30%, rgba(255, 241, 249, 0.5), rgba(255, 143, 199, 0.08) 70%);
  animation: moonPrismFloat 14s ease-in-out infinite;
}

@keyframes moonPrismFloat {
  0%,
  100% {
    transform: translateY(0) rotate(-6deg);
  }
  50% {
    transform: translateY(-6px) rotate(4deg);
  }
}`,
    },
  },
]

function css(theme) {
  const p = theme.palette
  const m = theme.motif
  return `/*
 * ${theme.name} — a Loop Pro anime profile theme.
 *
 * Generated by scripts/generate-anime-profile-themes.mjs. Scoped server-side
 * to .loop-profile-custom-css: it dresses the cover, the identity pane, the tab
 * strip, every post presentation and the real LoopCard, and it paints the
 * theme's artwork (image, GIF or video) behind the whole page.
 */

.loop-profile-custom-css {
  --an-ink: ${p.ink};
  --an-muted: ${p.muted};
  --an-accent: ${p.accent};
  --an-accent-2: ${p.accent2};
  --an-accent-3: ${p.accent3};
  --an-glass: ${p.glass};
  --an-hairline: ${p.hairline};
  /* Post-card tokens — the "Post cards" presentation is a real LoopCard. */
  --lp-card-bg: ${p.cardBg};
  --lp-card-border: ${p.cardBorder};
  --lp-card-border-strong: ${p.cardBorderStrong};
  --lp-card-hairline: ${p.hairline};
  --lp-card-ink: ${p.cardInk};
  --lp-card-muted: ${p.cardMuted};
  --lp-card-accent: ${p.cardAccent};
  --lp-card-like: ${p.like};
  --lp-card-glow: ${p.cardGlow};
  --lp-card-hover: ${p.coverTint};
  padding-bottom: 2.5rem;
}

/* ── Cover ─────────────────────────────────────────────────────────────── */
.loop-profile-custom-css .loop-profile-layout-cover {
  position: relative;
}

.loop-profile-custom-css .loop-profile-layout-cover > div:first-child {
  box-shadow:
    0 0 0 1px ${p.hairline},
    0 0 64px -20px ${p.coverTint},
    0 46px 90px -64px rgba(0, 0, 0, 0.9);
}

.loop-profile-custom-css .loop-profile-layout-cover::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  border-radius: 28px;
  background-image:
    ${m.coverSheen};
  background-size: 260% 100%, 100% 100%;
  animation: ${m.animation} 16s ease-in-out infinite;
}

${m.keyframes}

${m.extras}

/* ── Identity column ──────────────────────────────────────────────────── */
.loop-profile-custom-css .loop-profile-sidebar-column {
  position: relative;
  padding-inline: 1rem;
  color: ${p.muted};
}

.loop-profile-custom-css .loop-profile-sidebar-column::before {
  content: "";
  position: absolute;
  inset: 3.25rem 0 -0.25rem;
  border-radius: 26px;
  background-image: var(--an-glass);
  border: 1px solid var(--an-hairline);
  box-shadow:
    0 34px 80px -56px rgba(0, 0, 0, 0.95),
    inset 0 1px 0 ${p.coverTint};
}

.loop-profile-custom-css .loop-profile-sidebar-column h2,
.loop-profile-custom-css .loop-profile-sidebar-column .text-foreground,
.loop-profile-custom-css .loop-profile-sidebar-column [data-profile-block="identity"] {
  position: relative;
  color: var(--an-ink);
}

.loop-profile-custom-css .loop-profile-sidebar-column .text-muted-foreground {
  color: var(--an-muted) !important;
}

/* Lower panes (partnership, equipped cosmetics, awards) read as tinted glass
   rather than solid slabs, so the theme artwork carries all the way down the
   identity column instead of stopping at the bio. */
.loop-profile-custom-css .loop-profile-sidebar-column .bg-card,
.loop-profile-custom-css .loop-profile-sidebar-column .bg-muted {
  background-color: color-mix(in srgb, ${p.surface} 55%, transparent) !important;
  border-color: var(--an-hairline) !important;
  -webkit-backdrop-filter: blur(14px) saturate(1.08);
  backdrop-filter: blur(14px) saturate(1.08);
}

.loop-profile-custom-css .loop-profile-sidebar-column [class*="border-border"] {
  border-color: var(--an-hairline) !important;
}

.loop-profile-custom-css .loop-profile-sidebar-column a,
.loop-profile-custom-css .loop-profile-sidebar-column button {
  color: ${p.muted};
}

.loop-profile-custom-css .loop-profile-sidebar-column button:hover,
.loop-profile-custom-css .loop-profile-sidebar-column a:hover {
  color: var(--an-ink);
}

.loop-profile-custom-css .loop-profile-sidebar-column [data-profile-block="progress"] div[class*="h-full"] {
  background-image: ${p.progress};
  box-shadow: 0 0 20px ${p.coverTint};
}

/* ── Content panel ────────────────────────────────────────────────────── */
.loop-profile-custom-css .loop-profile-layout-main {
  position: relative;
  padding: 0 0.5rem 0.75rem;
  border-radius: 26px;
  border: 1px solid var(--an-hairline);
  background-color: color-mix(in srgb, ${p.bg} 66%, transparent);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  box-shadow:
    0 34px 80px -60px rgba(0, 0, 0, 0.85),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset;
}

.loop-profile-custom-css .loop-profile-layout-main [class*="border-border"] {
  border-color: var(--an-hairline);
}

.loop-profile-custom-css .loop-profile-layout-main a:hover {
  color: var(--an-accent);
}

/* ── Tabs ─────────────────────────────────────────────────────────────── */
.loop-profile-custom-css [data-profile-tab] {
  color: color-mix(in srgb, var(--an-ink) 54%, transparent);
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.loop-profile-custom-css [data-profile-tab][data-state="active"] {
  color: var(--an-ink);
  border-bottom-color: var(--an-accent);
  background-image: linear-gradient(180deg, ${p.coverTint}, transparent);
}

/* ── Background media ─────────────────────────────────────────────────── */
.loop-profile-custom-css [data-profile-background-image] {
  filter: ${m.filter};
}

.loop-profile-custom-css [data-profile-background-scrim] {
  background-image:
    ${m.scrim};
}

/* ── Post tiles and rows ──────────────────────────────────────────────── */
.loop-profile-custom-css [data-profile-post-tile] {
  border-radius: 16px;
  border: 1px solid var(--an-hairline);
  box-shadow: 0 18px 40px -34px rgba(0, 0, 0, 0.9);
}

.loop-profile-custom-css [data-profile-post-tile]:hover {
  border-color: ${p.cardBorderStrong};
  box-shadow: 0 0 30px -18px var(--lp-card-glow);
}

.loop-profile-custom-css [data-profile-post-row] {
  border-radius: 14px;
  border-bottom: 1px solid var(--an-hairline);
}

.loop-profile-custom-css [data-profile-post-row]:hover {
  background-color: ${p.coverTint};
}

/* ── Loop cards ───────────────────────────────────────────────────────── */
.loop-profile-custom-css [data-loop-card] {
  background: var(--lp-card-bg) !important;
  border: 1px solid var(--lp-card-border) !important;
  border-radius: 20px !important;
  box-shadow:
    0 24px 60px -44px rgba(0, 0, 0, 0.9),
    0 0 38px -28px var(--lp-card-glow) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.loop-profile-custom-css [data-loop-card]:hover {
  border-color: var(--lp-card-border-strong) !important;
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-header] {
  border-bottom: 1px solid var(--lp-card-hairline);
  padding-bottom: 0.7rem;
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-header] img {
  box-shadow: 0 0 0 1px var(--lp-card-hairline);
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-header] a:hover {
  color: var(--lp-card-accent);
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-header] .text-foreground,
.loop-profile-custom-css [data-loop-card] [data-loop-card-content] .text-foreground,
.loop-profile-custom-css [data-loop-card] [data-loop-card-content] {
  color: var(--lp-card-ink);
}

.loop-profile-custom-css [data-loop-card] .text-muted-foreground {
  color: var(--lp-card-muted) !important;
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-content] a[href^="/hashtag"] {
  color: var(--lp-card-accent) !important;
  background-color: var(--lp-card-hover);
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-media] {
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--lp-card-hairline);
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-actions] {
  margin-top: 0.45rem;
  border-top: 1px solid var(--lp-card-hairline);
  padding-top: 0.2rem;
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-actions] button,
.loop-profile-custom-css [data-loop-card] [data-loop-card-actions] a {
  color: var(--lp-card-muted);
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-actions] button:hover {
  color: var(--lp-card-accent);
  background-color: var(--lp-card-hover);
}

.loop-profile-custom-css [data-loop-card] [data-loop-card-actions] .text-rose-500 {
  color: var(--lp-card-like) !important;
}

.loop-profile-custom-css [data-profile-post-card] > * {
  border-radius: 20px;
}

@media (max-width: 1023px) {
  .loop-profile-custom-css .loop-profile-layout-main {
    border-radius: 22px;
    padding-inline: 0.35rem;
  }

  .loop-profile-custom-css .loop-profile-sidebar-column::before {
    inset: 3.25rem 0.25rem -0.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loop-profile-custom-css .loop-profile-layout-cover::after,
  .loop-profile-custom-css .loop-profile-sidebar-column::after {
    animation: none;
  }
}
`
}

function svg(theme) {
  const p = theme.palette
  const art = {
    "naruto-hidden-leaf": `
  <!-- Dusk sky and distant Hokage rock -->
  <rect width="1600" height="900" fill="url(#sky)"/>
  <circle cx="1180" cy="300" r="210" fill="url(#glow)" opacity="0.55"/>
  <circle cx="1180" cy="300" r="120" fill="#ffb066" opacity="0.45"/>
  <g fill="#0d1830" opacity="0.95">
    <path d="M0 640 L150 520 L260 596 L380 470 L520 604 L640 540 L760 630 L1600 610 L1600 900 L0 900 Z"/>
  </g>
  <g fill="#0a1224">
    <path d="M0 700 L180 610 L320 690 L470 600 L620 706 L800 640 L980 720 L1160 660 L1340 730 L1600 680 L1600 900 L0 900 Z"/>
  </g>
  <!-- Village roofs -->
  <g fill="#13203a" stroke="#ff9a4d" stroke-opacity="0.16">
    <rect x="120" y="742" width="150" height="70" rx="6"/>
    <rect x="320" y="768" width="120" height="44" rx="6"/>
    <rect x="520" y="746" width="170" height="66" rx="6"/>
    <rect x="760" y="776" width="130" height="36" rx="6"/>
    <rect x="960" y="752" width="150" height="60" rx="6"/>
    <rect x="1180" y="778" width="120" height="34" rx="6"/>
  </g>
  <!-- Leaf crest: a spiral of leaves -->
  <g transform="translate(330 250)" opacity="0.92">
    <circle r="150" fill="none" stroke="#ff9a4d" stroke-opacity="0.22" stroke-width="3"/>
    <g fill="#ff9a4d" fill-opacity="0.55">
      <path d="M0 -150 C40 -110 40 -60 0 -24 C-40 -60 -40 -110 0 -150 Z" transform="rotate(18)"/>
      <path d="M0 -120 C32 -88 32 -48 0 -20 C-32 -48 -32 -88 0 -120 Z" transform="rotate(96) scale(0.82)"/>
      <path d="M0 -120 C32 -88 32 -48 0 -20 C-32 -48 -32 -88 0 -120 Z" transform="rotate(168) scale(0.72)" fill="#63d29a" fill-opacity="0.5"/>
      <path d="M0 -120 C32 -88 32 -48 0 -20 C-32 -48 -32 -88 0 -120 Z" transform="rotate(240) scale(0.62)"/>
    </g>
    <g stroke="#ffe8c9" stroke-opacity="0.5" stroke-width="4" fill="none">
      <path d="M0 10 C-34 42 -30 92 0 120 C30 92 34 42 0 10 Z"/>
      <path d="M0 10 L0 120"/>
    </g>
  </g>
  <!-- Floating leaves -->
  <g fill="#63d29a" fill-opacity="0.35">
    <ellipse cx="720" cy="240" rx="26" ry="12" transform="rotate(-24 720 240)"/>
    <ellipse cx="980" cy="420" rx="20" ry="9" transform="rotate(32 980 420)"/>
    <ellipse cx="1360" cy="220" rx="24" ry="11" transform="rotate(-12 1360 220)"/>
    <ellipse cx="560" cy="520" rx="18" ry="8" transform="rotate(44 560 520)"/>
  </g>`,
    "demon-slayer-hinokami": `
  <rect width="1600" height="900" fill="url(#sky)"/>
  <circle cx="1080" cy="340" r="250" fill="url(#glow)" opacity="0.6"/>
  <!-- Checkered horizon band -->
  <g opacity="0.5">
    <rect x="0" y="600" width="1600" height="24" fill="url(#checker)"/>
    <rect x="0" y="640" width="1600" height="14" fill="url(#checker)" opacity="0.7"/>
    <rect x="0" y="668" width="1600" height="8" fill="url(#checker)" opacity="0.45"/>
  </g>
  <!-- Flame crest -->
  <g transform="translate(360 300)">
    <path d="M0 -210 C52 -140 118 -108 118 -30 C118 42 62 96 0 96 C-64 96 -120 44 -120 -28 C-120 -96 -56 -132 -20 -186 C-10 -154 12 -140 26 -122 C42 -158 30 -184 0 -210 Z"
      fill="url(#flame)" opacity="0.9"/>
    <path d="M0 -120 C30 -78 66 -58 66 -14 C66 30 36 62 0 62 C-36 62 -66 32 -66 -12 C-66 -54 -30 -76 -8 -116 C-2 -92 12 -78 20 -66 C28 -88 18 -104 0 -120 Z"
      fill="#ffe9c9" opacity="0.7"/>
    <path d="M0 -58 C14 -36 30 -24 30 0 C30 22 16 40 0 40 C-16 40 -30 24 -30 0 C-30 -24 -14 -36 0 -58 Z"
      fill="#fff6e6" opacity="0.85"/>
  </g>
  <!-- Rising embers -->
  <g fill="#ff8a3d">
    <circle cx="700" cy="520" r="5" opacity="0.7"/>
    <circle cx="820" cy="380" r="4" opacity="0.55"/>
    <circle cx="960" cy="600" r="6" opacity="0.6"/>
    <circle cx="1180" cy="470" r="4" opacity="0.5"/>
    <circle cx="1320" cy="640" r="5" opacity="0.45"/>
    <circle cx="520" cy="660" r="4" opacity="0.4"/>
  </g>
  <!-- Dark timber ridge -->
  <path d="M0 720 L1600 700 L1600 900 L0 900 Z" fill="#12060a"/>
  <g stroke="#ff5a33" stroke-opacity="0.2" stroke-width="3">
    <line x1="0" y1="742" x2="1600" y2="722"/>
    <line x1="0" y1="790" x2="1600" y2="770"/>
  </g>`,
    "one-piece-grand-line": `
  <rect width="1600" height="900" fill="url(#sky)"/>
  <circle cx="1050" cy="360" r="190" fill="url(#glow)" opacity="0.65"/>
  <circle cx="1050" cy="360" r="110" fill="#ffd97a" opacity="0.5"/>
  <!-- Sea -->
  <rect y="560" width="1600" height="340" fill="url(#sea)"/>
  <g stroke="#8fd8f5" stroke-opacity="0.35" stroke-width="4" fill="none">
    <path d="M0 640 Q120 610 240 640 T480 640 T720 640 T960 640 T1200 640 T1440 640 T1600 636"/>
    <path d="M0 720 Q140 686 280 720 T560 720 T840 720 T1120 720 T1400 720 T1600 714" opacity="0.7"/>
    <path d="M0 810 Q160 776 320 810 T640 810 T960 810 T1280 810 T1600 802" opacity="0.5"/>
  </g>
  <!-- Ship silhouette -->
  <g transform="translate(900 470)" fill="#0a2233" stroke="#ffcf5c" stroke-opacity="0.35">
    <path d="M-150 96 L150 96 L110 150 L-110 150 Z"/>
    <rect x="-6" y="-120" width="12" height="216"/>
    <path d="M6 -110 L120 20 L6 20 Z" fill="#12374f"/>
    <path d="M-6 -90 L-100 30 L-6 30 Z" fill="#12374f"/>
    <circle cx="0" cy="-128" r="10" fill="#ffcf5c" fill-opacity="0.7"/>
  </g>
  <!-- Log pose / compass crest -->
  <g transform="translate(330 280)" opacity="0.9">
    <circle r="130" fill="none" stroke="#ffcf5c" stroke-opacity="0.3" stroke-width="3"/>
    <circle r="98" fill="none" stroke="#38a9e0" stroke-opacity="0.35" stroke-width="2"/>
    <path d="M0 -96 L24 0 L0 96 L-24 0 Z" fill="#ffcf5c" fill-opacity="0.55"/>
    <path d="M-96 0 L0 -22 L96 0 L0 22 Z" fill="#38a9e0" fill-opacity="0.45"/>
    <circle r="12" fill="#04101c" stroke="#ffcf5c" stroke-opacity="0.6"/>
  </g>
  <!-- Gulls -->
  <g stroke="#e8f7ff" stroke-opacity="0.5" stroke-width="4" fill="none">
    <path d="M1180 210 q26 -18 52 0 q26 -18 52 0"/>
    <path d="M1280 260 q18 -12 36 0 q18 -12 36 0" opacity="0.7"/>
  </g>`,
    "sailor-moon-prism": `
  <rect width="1600" height="900" fill="url(#sky)"/>
  <!-- Prismatic ribbons -->
  <g opacity="0.5">
    <path d="M0 180 C300 60 520 320 820 200 C1080 96 1320 260 1600 150 L1600 0 L0 0 Z" fill="url(#ribbon)"/>
    <path d="M0 760 C280 640 560 860 860 720 C1140 600 1360 780 1600 680 L1600 900 L0 900 Z" fill="url(#ribbon2)" opacity="0.6"/>
  </g>
  <!-- Crescent moon -->
  <g transform="translate(1120 320)">
    <circle r="210" fill="url(#glow)" opacity="0.6"/>
    <circle r="130" fill="#fff1f9" opacity="0.92"/>
    <circle cx="58" cy="-34" r="118" fill="#0a0718" opacity="0.96"/>
    <circle r="150" fill="none" stroke="#9fd8ff" stroke-opacity="0.35" stroke-width="3"/>
  </g>
  <!-- Silver crystal -->
  <g transform="translate(360 320)" opacity="0.92">
    <path d="M0 -150 L86 -30 L0 150 L-86 -30 Z" fill="url(#crystal)" opacity="0.8"/>
    <path d="M0 -150 L0 150" stroke="#fff1f9" stroke-opacity="0.6" stroke-width="3"/>
    <path d="M-86 -30 L86 -30" stroke="#fff1f9" stroke-opacity="0.4" stroke-width="2"/>
    <circle r="190" fill="none" stroke="#ff8fc7" stroke-opacity="0.28" stroke-width="2" stroke-dasharray="6 14"/>
  </g>
  <!-- Stars and sparkles -->
  <g fill="#fff1f9">
    <circle cx="680" cy="180" r="4" opacity="0.8"/>
    <circle cx="820" cy="420" r="3" opacity="0.6"/>
    <circle cx="1400" cy="520" r="4" opacity="0.7"/>
    <circle cx="240" cy="600" r="3" opacity="0.6"/>
    <circle cx="980" cy="640" r="3" opacity="0.5"/>
    <circle cx="1240" cy="160" r="3" opacity="0.55"/>
  </g>
  <g fill="#9fd8ff" opacity="0.55">
    <circle cx="600" cy="520" r="2.5"/>
    <circle cx="760" cy="300" r="2"/>
    <circle cx="1320" cy="680" r="2.5"/>
    <circle cx="180" cy="380" r="2"/>
  </g>
  <!-- City skyline, softened -->
  <g fill="#151033" opacity="0.9">
    <rect x="40" y="700" width="120" height="200"/>
    <rect x="180" y="740" width="90" height="160"/>
    <rect x="1290" y="720" width="110" height="180"/>
    <rect x="1420" y="690" width="140" height="210"/>
  </g>`,
  }[theme.slug]

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${theme.artLabel}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bg}"/>
      <stop offset="0.55" stop-color="${p.surface}"/>
      <stop offset="1" stop-color="${p.bg}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${p.accent3}" stop-opacity="0.75"/>
      <stop offset="0.55" stop-color="${p.accent}" stop-opacity="0.32"/>
      <stop offset="1" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="${p.accent}"/>
      <stop offset="0.6" stop-color="#ff9a4d"/>
      <stop offset="1" stop-color="${p.accent2}"/>
    </linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f3b57" stop-opacity="0.9"/>
      <stop offset="1" stop-color="${p.bg}"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.accent}" stop-opacity="0.35"/>
      <stop offset="0.5" stop-color="${p.accent2}" stop-opacity="0.24"/>
      <stop offset="1" stop-color="${p.accent}" stop-opacity="0.1"/>
    </linearGradient>
    <linearGradient id="ribbon2" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${p.accent2}" stop-opacity="0.3"/>
      <stop offset="1" stop-color="${p.accent}" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="crystal" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${p.accent}"/>
      <stop offset="0.5" stop-color="${p.accent3}"/>
      <stop offset="1" stop-color="${p.accent2}"/>
    </linearGradient>
    <pattern id="checker" width="28" height="28" patternUnits="userSpaceOnUse">
      <rect width="14" height="14" fill="${p.accent2}" fill-opacity="0.55"/>
      <rect x="14" y="14" width="14" height="14" fill="${p.accent2}" fill-opacity="0.55"/>
    </pattern>
  </defs>
${art}
</svg>
`
}

mkdirSync("public/profile-themes", { recursive: true })
for (const theme of THEMES) {
  const stylesheet = css(theme)
  const bytes = Buffer.byteLength(stylesheet, "utf8")
  if (bytes > CSS_LIMIT) {
    console.error(`${theme.name}: CSS is ${bytes} bytes — the profile limit is ${CSS_LIMIT}.`)
    process.exitCode = 1
    continue
  }
  writeFileSync(`public/profile-themes/${theme.slug}.css`, stylesheet)
  writeFileSync(`public/profile-themes/${theme.slug}.svg`, svg(theme))
  console.log(`${theme.slug} — CSS ${bytes} bytes`)
}

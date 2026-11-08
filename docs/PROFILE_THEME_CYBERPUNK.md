# Build a cyberpunk profile theme

A start-to-finish guide to the `CYBERPUNK // NIGHT CITY` stylesheet in
[`docs/profile-theme-cyberpunk.css`](./profile-theme-cyberpunk.css): what every block does,
which profile hook it targets, how the background/audio/post-card logic works, and where to
change things to make it yours.

The file is a **complete theme**, not a snippet. It styles the cover, the identity column,
the tab strip, the content panel, all three post presentations (grid, list, post cards), the
background artwork and its scanlines — roughly 9 KB, comfortably inside the 21,000-byte
profile limit.

---

## 1. Two ways to install it

### A. On your own profile (fastest)

1. Open **Settings → Profile → Custom profile CSS**.
2. Paste the whole of `docs/profile-theme-cyberpunk.css`.
3. Save, then open your public profile. The CSS is scoped to the profile root on the server.
4. To add the background/audio, use **your profile → ⋯ → Profile atmosphere** (background
   image, GIF or short video, soundtrack, post-card default). Those settings are separate
   from the CSS and always win over the theme CSS for layout, never for colours.

Custom profile CSS requires Loop Pro, and the API checks Pro entitlement as well as the byte
limit.

### B. As a shop theme (sold or granted to other people)

1. Open **Admin → Themes & Effects**.
2. Fill **Name**, **Price**, **Rarity**, and keep **Category = Theme**.
3. In the amber **Profile theme** panel:
   - **Profile background** — upload the artwork (a 1600×900 image or short looping MP4/WebM
     works well; the page crops it and anchors it to the top, and video plays muted).
   - **Soundtrack** — upload or paste an audio file, and set the **Soundtrack title** that
     the sound pill shows.
   - **Sound on by default** / **Starts automatically** — the two playback defaults the
     equip endpoint writes onto the buyer's profile.
   - **Profile CSS** — paste the stylesheet.
4. **Create theme.**

To change the soundtrack, background or CSS of a theme that already exists, use **Edit theme** on its row
in **Admin → Themes & Effects → Live catalog** (or the Profile theme panel when editing it
in **Shop management**). That edits only the audio fields, leaving art, CSS, price and the
copies buyers already own untouched. Existing owners re-equip the theme (or update their
atmosphere) to pick up a new soundtrack.

> The seed script `scripts/seed-profile-theme.mjs` does the same thing from the terminal for
> the four bundled themes. Run it after editing anything in `public/profile-themes/` so the
> shop rows carry the new CSS/art/audio.

---

## 2. What the server does to your CSS

`lib/profile-custom-css.ts` sanitises every stylesheet before it is stored:

| Rule | Detail |
| --- | --- |
| Scoping | Every selector is prefixed with `.loop-profile-custom-css`, so a theme can never leak into the feed or the app shell. `:root`, `html` and `body` are mapped onto that root. |
| Banned loads | `url()`, `@import`, `@font-face` and executable values are rejected. Use gradients, `clip-path`, borders, shadows and pseudo-elements for artwork; upload real images through the admin/atmosphere fields. |
| Allowed at-rules | `@media`, `@supports`, `@container`, `@layer`, `@keyframes` (names are automatically namespaced with a hash so two themes cannot collide). |
| Size | The scoped result must stay under **21,000 UTF-8 bytes**. |
| Nesting | Plain selectors only — no `&` nesting and no bare nested rules. |

Because namespacing is automatic, you can use short keyframe names like `cpScan`; they will
never clash with another theme.

---

## 3. The hooks, in page order

Everything below lives inside the profile root. Selectors in the starter already include
`.loop-profile-custom-css`, but the sanitiser would add it if you forgot.

### Page and background

| Hook | What it is |
| --- | --- |
| `.loop-profile-page` | The profile root — every tab renders inside it. |
| `.loop-profile-background` | The absolutely-positioned artwork layer behind the whole profile. |
| `[data-profile-background]` | Same element, stable attribute. |
| `[data-profile-background-image]` | The layer that carries the picture (style `backgroundImage`). Filter/scale it here. |
| `[data-profile-background-scrim]` | The gradient that keeps text readable. Re-tint it here without hiding the art. |
| `.loop-profile-layout-canvas` | The content wrapper that sits above the artwork (`z-10`). |
| `.loop-profile-layout-cover` | The cover/banner block. |
| `.loop-profile-layout-main` | The right-hand content panel containing tabs and posts. |

The cyberpunk starter makes the content panel translucent (`--cp-panel`) and adds a masked
grid plus a slow scanline over `.loop-profile-background`. That is the entire "background
logic": one picture is painted once behind the page, the panel lets it through, and the scrim
keeps foreground text legible.

### Identity column

| Hook | What it is |
| --- | --- |
| `.loop-profile-sidebar-column` | The whole identity column. |
| `.loop-profile-sidebar` | The inner stack. |
| `.loop-profile-sidebar-blocks` | Wrapper around the reorderable blocks. |
| `[data-profile-block="identity"]` | Avatar, name and handle. |
| `[data-profile-block="bio"]` | Bio copy. |
| `[data-profile-block="details"]` | Location, links, join date. |
| `[data-profile-block="stats"]` | Loop/follower counters. |
| `[data-profile-block="awards"]` | Badges and awards. |
| `[data-profile-block="progress"]` | Level/XP bar. |
| `[data-profile-block="cosmetics"]` | Equipped cosmetics. |

Useful descendants: `h2` is the display name, `.bg-foreground` is the primary follow/message
button, `.bg-muted` / `.bg-card` are the small chips/cards, and `[class*="border-border"]`
matches the hairline dividers.

### Tabs and posts

| Hook | What it is |
| --- | --- |
| `[data-profile-tab]` | Every tab button. |
| `[data-profile-tab][data-state="active"]` | The selected tab. |
| `[data-profile-post-tile]` | One square in **grid** view. |
| `[data-profile-post-row]` | One row in **list** view. |
| `[data-profile-post-card]` | The container of the **post cards** view. |

### Post cards — the real LoopCard

The cards view renders the actual `LoopCard` used by the feed, so the stylesheet has to dress
its internals. These hooks are stable and exist on every LoopCard, wherever it renders:

| Hook | What it is |
| --- | --- |
| `[data-loop-card]` | The card surface. Always present. |
| `[data-loop-card-surface="profile"]` | Same element; the value says which page renders it (`feed`, `profile`, `search`, …). Target this if you only want profile cards. |
| `[data-loop-card-header]` | Identity row: avatar, name, timestamp, overflow menu. |
| `[data-loop-card-content]` | Body: text, tags, poll/duel, media. |
| `[data-loop-card-media]` | Wrapper around images/video/audio attachments. |
| `[data-loop-card-actions]` | Like / comment / branch / share / bookmark row. |

The starter sets the surface gradient, clipped corners, neon hover glow, hairline separators,
body ink, hashtag colour, media rounding and action-bar colours from the `--lp-card-*` tokens
at the top of the file. To re-theme the cards, change those eight tokens — nothing else.

> Why `!important`? The card is built from Tailwind utilities such as `bg-card/95` and
> `border-border`. Profile CSS loads after those utilities, but a few states re-apply them at
> a higher specificity, so the surface rules win explicitly.

---

## 4. The tokens

Put these at the top of the sheet and change them for an instant variant:

```css
.loop-profile-custom-css {
  --cp-void: #04070f;        /* page base                        */
  --cp-panel: rgba(4, 10, 20, 0.74); /* content panel tint       */
  --cp-cyan: #00f0ff;        /* primary neon                     */
  --cp-magenta: #ff2bd6;     /* secondary neon / hover           */
  --cp-acid: #f6ff00;        /* warning / primary action         */
  --cp-ink: #d8fbff;         /* body copy                        */
  --cp-dim: rgba(178, 232, 255, 0.62); /* secondary copy         */
  --cp-line: rgba(0, 240, 255, 0.28);  /* borders                */
  --cp-line-hot: rgba(255, 43, 214, 0.45);
  --cp-glass: linear-gradient(158deg, rgba(6, 16, 30, 0.86), rgba(3, 6, 14, 0.92));
}
```

Three ready-made recolours:

| Variant | `--cp-cyan` | `--cp-magenta` | `--cp-acid` | `--cp-panel` |
| --- | --- | --- | --- | --- |
| Night City (default) | `#00f0ff` | `#ff2bd6` | `#f6ff00` | `rgba(4, 10, 20, 0.74)` |
| Acid Rain | `#7dffb8` | `#f6ff00` | `#00f0ff` | `rgba(6, 18, 12, 0.72)` |
| Blood Circuit | `#ff3b4d` | `#ff9f1c` | `#ffe8c2` | `rgba(20, 4, 8, 0.76)` |

Post-card tokens are independent — keep them close to the palette or the cards drift away
from the page:

```css
--lp-card-bg: linear-gradient(158deg, rgba(6, 18, 32, 0.9), rgba(4, 8, 16, 0.94));
--lp-card-border: rgba(0, 240, 255, 0.26);
--lp-card-border-strong: rgba(255, 43, 214, 0.55);
--lp-card-hairline: rgba(0, 240, 255, 0.16);
--lp-card-ink: #d8fbff;
--lp-card-muted: rgba(178, 232, 255, 0.64);
--lp-card-accent: #00f0ff;
--lp-card-like: #ff2bd6;
--lp-card-glow: rgba(0, 240, 255, 0.5);
--lp-card-hover: rgba(0, 240, 255, 0.12);
```

---

## 5. How the atmosphere logic fits in

The owner-side settings live in `profiles.theme_preferences` and are edited from
**Profile → ⋯ → Profile atmosphere**:

| Key | Effect |
| --- | --- |
| `profile_background` | The media painted behind the page: image, GIF or short video. Safe https or `/public` path. |
| `profile_audio` | The loop played by the sound pill. |
| `profile_audio_title` | Label shown on the pill. |
| `profile_audio_enabled` | `false` = no soundtrack for anyone; the pill reads “Soundtrack off”. |
| `profile_audio_autoplay` | `false` = wait for the visitor to press play. |
| `profile_post_view` | Default presentation for visitors: `grid`, `list` or `cards`. |

Equipping a shop theme merges these keys instead of replacing the whole object, so a theme
change never wipes the owner's post-view choice. The theme's own `profile_audio_enabled` /
`profile_audio_autoplay` defaults are written at equip time; the owner can override both
afterwards.

Visitor side:

- The sound pill at the bottom-right mutes/unmutes, and the choice is stored per browser
  (`loop:profile-sound-muted`). The audio element stays alive while muted, so unmuting starts
  playback inside the tap gesture instead of being blocked by browser autoplay policy.
- The post-layout buttons (grid / list / cards) store the visitor's choice in
  `loop:profile-post-view`. A visitor's own choice beats the owner's default; first-time
  visitors see the owner's default.

CSS cannot change any of that logic — it only dresses the result. The one place it
participates is the background: your scrim replaces the default one, so a very dark theme can
lighten it and a bright theme can darken it to keep text readable.

---

## 6. Make it yours — a few safe recipes

**Sharper corners.** Change `border-radius: 2px` to `0` on the cover, panel and cards; update
the clipped-corner `clip-path` values to taste.

**No scanlines.** Delete the `.loop-profile-background::after` block (and its `cpScan`
keyframes). The grid from `::before` stays.

**Grid-only background.** Remove the two `radial-gradient`s from
`[data-profile-background-scrim]`, keeping the base `linear-gradient`. The picture then
reads closer to its original colours.

**One card style for every surface.** Change `[data-loop-card]` to
`[data-loop-card-surface="profile"]` so only profile cards are restyled; feed cards keep the
app's own look.

**Glitchier name.** Add a second layer behind the name with a gradient:
`.loop-profile-sidebar-column h2 { text-shadow: 2px 0 var(--cp-magenta), -2px 0 var(--cp-cyan); }`
— note that `text-shadow` is invisible while the text fill is transparent, so remove the
`background-clip`/`-webkit-text-fill-color` lines first.

**Theme-specific tab underline.** Change the `border-bottom-color` on
`[data-profile-tab][data-state="active"]`; the glow comes from `text-shadow`.

---

## 7. Checklist before you ship it

1. Paste the CSS into the admin form or your custom CSS and save — the byte counter must stay
   under 21,000.
2. Open your profile on **desktop and mobile**: cover, identity column, tab strip, panel.
3. Switch between **grid**, **list** and **post cards**. On cards, confirm the header hairline,
   body copy, hashtags, media rounding and action icons all picked up the theme.
4. Open a post with an image, a poll and a long text body — those are the three layouts that
   expose contrast problems first.
5. Add a background picture — then a GIF and a short video — in **Profile atmosphere** and
   check the scrim still keeps the bio readable in each case.
6. Toggle the soundtrack off and on, and reload to confirm the visitor mute persists.
7. Check `prefers-reduced-motion`: the sweep and scanline must stop, the hover lift must not
   jump.

If something looks wrong, the two usual causes are a missing `!important` against a Tailwind
utility, and a selector that targets a class Tailwind may rewrite — prefer the `data-*` hooks
in this guide over utility class names.

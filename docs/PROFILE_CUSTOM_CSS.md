# Profile custom CSS

Loop Pro members can add up to **21,000 UTF-8 bytes** of CSS from **Settings → Profile → Custom profile CSS**.

- CSS is stored on the member's profile and applied to the public profile page.
- Every selector is scoped to the profile root; document-root selectors such as :root, html and body are mapped to that root.
- @media, @supports, @container, @layer and namespaced @keyframes are supported.
- External resource loading (url(), @import, remote @font-face), executable CSS values and unsupported at-rules are rejected.
- The API validates Pro entitlement and the byte limit independently of the UI. PostgreSQL also enforces the 21,000-byte limit.

## Hooks

Theme and custom CSS can target the whole profile, not just the header:

- `.loop-profile-page` — the profile root (every tab lives inside it).
- `.loop-profile-background`, `[data-profile-background-image]`, `[data-profile-background-scrim]` — the theme artwork, the media layer and its contrast scrim. `[data-profile-background-kind]` is `image` or `video`; the media layer holds an `<img>` for pictures and GIFs and a muted looping `<video>` for clips, so `filter`, `opacity` and `transform` apply to either.
- `.loop-profile-layout-cover`, `.loop-profile-sidebar-column`, `.loop-profile-sidebar-blocks`, `.loop-profile-layout-main`.
- `[data-profile-block="identity|bio|details|stats|awards|progress|cosmetics"]` — identity-column blocks.
- `[data-profile-tab][data-state="active"]` — the tab strip.
- `[data-profile-post-tile]`, `[data-profile-post-row]`, `[data-profile-post-card]` — the grid, list and post-card presentations.
- `[data-loop-card]` — the real post card used by the cards view; `[data-loop-card-surface]`, `[data-loop-card-header]`, `[data-loop-card-content]`, `[data-loop-card-media]`, `[data-loop-card-actions]` — its surface, identity row, body, media and action bar.

See [PROFILE_THEME_CYBERPUNK.md](./PROFILE_THEME_CYBERPUNK.md) for a complete, commented theme and a walkthrough of every hook.

## Profile atmosphere

Owners can set a background and soundtrack and choose the default post presentation from **Profile → ⋯ → Profile atmosphere**. A background is a still image, an animated GIF or a short looping video; it is painted full-bleed behind the profile the same way the home page paints its backdrop, muted and inline, and it holds its first frame for visitors who reduce motion. Those settings live in `profiles.theme_preferences` (`profile_background`, `profile_audio`, `profile_audio_title`, `profile_audio_enabled`, `profile_audio_autoplay`, `profile_post_view`). Visitors can mute the soundtrack from the sound pill, and that choice is remembered on their device; each visitor can also switch between grid, list and post-card presentations.

Shop themes carry their own background media, soundtrack and two playback defaults (`profile_audio_enabled`, `profile_audio_autoplay` inside the item's `item_data`). The media type is read from the URL, so `profile_background_url` can point at a picture, a GIF or an MP4/WebM clip without another field.

### Editing a live theme

**Admin → Themes & Effects → Live catalog → Edit theme** changes the name, price, rarity, shop visibility, background media, soundtrack, playback defaults and profile CSS of an existing theme. **Admin → Shop management** exposes the same profile fields alongside the rest of the item. Both save through `/api/admin/shop-items`, which sanitises the CSS and rejects media URLs that are not https or site-relative.

Changes apply to a buyer's profile the next time they equip the theme; the copy already painted on a live profile is left alone until then.

### Bundled anime themes

The seeded anime set — **Naruto — Hidden Leaf**, **Demon Slayer — Hinokami**, **One Piece — Grand Line** and **Sailor Moon — Moon Prism** — is generated, not hand-drawn:

```bash
node scripts/generate-anime-profile-themes.mjs   # CSS + SVG artwork in public/profile-themes/
node scripts/generate-profile-theme-audio.mjs    # original WAV loops for every bundled theme
node scripts/seed-profile-theme.mjs --sync-equipped
```

To add another theme, add a palette entry to the generator (or author a standalone CSS file), then add the matching row to `scripts/seed-profile-theme.mjs`. Anything the generator produces still has to pass the 21,000-byte limit and the sanitiser.

## Database

Apply scripts/migrations/005_profile_custom_css.sql to the production database before enabling this feature. The migration is idempotent.

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
- `.loop-profile-background`, `[data-profile-background-image]`, `[data-profile-background-scrim]` — the theme artwork, the picture layer and its contrast scrim.
- `.loop-profile-layout-cover`, `.loop-profile-sidebar-column`, `.loop-profile-sidebar-blocks`, `.loop-profile-layout-main`.
- `[data-profile-block="identity|bio|details|stats|awards|progress|cosmetics"]` — identity-column blocks.
- `[data-profile-tab][data-state="active"]` — the tab strip.
- `[data-profile-post-tile]`, `[data-profile-post-row]`, `[data-profile-post-card]` — the grid, list and post-card presentations.
- `[data-loop-card]` — the real post card used by the cards view; `[data-loop-card-surface]`, `[data-loop-card-header]`, `[data-loop-card-content]`, `[data-loop-card-media]`, `[data-loop-card-actions]` — its surface, identity row, body, media and action bar.

See [PROFILE_THEME_CYBERPUNK.md](./PROFILE_THEME_CYBERPUNK.md) for a complete, commented theme and a walkthrough of every hook.

## Profile atmosphere

Owners can set a background picture, soundtrack and default post presentation from **Profile → ⋯ → Profile atmosphere**. Those settings live in `profiles.theme_preferences` (`profile_background`, `profile_audio`, `profile_audio_title`, `profile_audio_enabled`, `profile_audio_autoplay`, `profile_post_view`). Visitors can mute the soundtrack from the sound pill, and that choice is remembered on their device; each visitor can also switch between grid, list and post-card presentations.

Shop themes carry their own background, soundtrack and two playback defaults (`profile_audio_enabled`, `profile_audio_autoplay` inside the item's `item_data`). Admins can change them on an existing theme from **Admin → Themes & Effects → Live catalog → Sound**, or from the Profile theme panel in Shop management.

## Database

Apply scripts/migrations/005_profile_custom_css.sql to the production database before enabling this feature. The migration is idempotent.

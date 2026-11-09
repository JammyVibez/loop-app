# VPS media storage

Every new upload — posts, Reels, avatars, covers, DMs, group chat, voice notes,
Co-Loop Studio, circle icons and banners, and everything in the Admin Dashboard
(GIFs, emojis, awards, PFP frames, checkmarks, organization badges, theme
assets, ad creatives, the music library) — is written to the VPS by one server
module and served by Nginx from `/media/...`.

Files uploaded to Cloudinary before this change are **not** touched. Their rows
keep `storage_provider = 'cloudinary'` and their original URLs, and the app
renders both URL shapes everywhere (feed, profile, DMs, Reels, notifications,
OG cards). Nothing in the app contacts Cloudinary for new uploads;
`/api/upload/sign` now answers `410 Gone`.

```
Browser ──chunked POST──▶ /api/media/upload ──▶ /var/loop-uploads/{kind}/{yyyy}/{mm}/{random}.{ext}
                                                     │
                                     Nginx /media/* ──┘ (immutable cache, nosniff)
                                                     │
                                        Cloudflare caches /media/* at the edge
```

## 1. Server prerequisites

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg nginx rclone
sudo mkdir -p /var/loop-uploads
sudo chown -R loop:loop /var/loop-uploads     # the user that runs PM2
sudo chmod 750 /var/loop-uploads
```

`node_modules` must include `sharp` (already a dependency). If `npm ci` skipped
optional native builds, run `npm rebuild sharp`.

Environment (`.env.local` on the VPS — the systemd units read this file):

| Variable | Required | Meaning |
| --- | --- | --- |
| `MEDIA_STORAGE_ROOT` | no | Uploads directory. Default `/var/loop-uploads`. Must live outside the app checkout. |
| `MEDIA_PUBLIC_BASE` | no | Absolute base for media URLs, e.g. `https://loopapp.me/media`. Leave unset for same-origin `/media`. |
| `MEDIA_WORKER_SECRET` | recommended | Shared secret for `POST /api/media/process` (queue recovery timer). |
| `MEDIA_BACKUP_REMOTE` | yes (for backups) | rclone destination, e.g. `b2:loop-media` or `r2:loop-media`. |
| `MEDIA_ALERT_WEBHOOK` | recommended | Slack/Discord webhook that receives backup failures. |
| `FFMPEG_PATH` / `FFPROBE_PATH` | no | Default to `ffmpeg` / `ffprobe` on `PATH`. |
| `MEDIA_FFMPEG_TIMEOUT_MS` | no | Per-file transcode timeout, default 20 minutes. |

A copy of this list you can merge into `.env.local` lives in
[`deploy/media.env.example`](media.env.example).

No Cloudinary variables are required for new uploads.

## 2. Nginx

Include the snippet inside the `server {}` block for `loopapp.me`:

```nginx
include /etc/nginx/snippets/loop-media.conf;
```

It adds `client_max_body_size 520m`, disables request buffering for
`/api/media/upload`, and serves `/media/` from `/var/loop-uploads` with:

- `Cache-Control: public, max-age=31536000, immutable`
- `X-Content-Type-Options: nosniff`
- `Content-Security-Policy: default-src 'none'; …; sandbox`
- `Content-Disposition: inline`, `Cross-Origin-Resource-Policy: cross-origin`
- denials for dot-paths (`.incoming`, `.private`, `.backup`) and executables

`/media/*` must **not** be proxied to Next.js. Confirm:

```bash
curl -sI https://loopapp.me/media/images/2026/11/<file>.webp | grep -Ei "cache-control|server|x-content-type"
# expect: cache-control: public, max-age=31536000, immutable
```

## 3. Cloudflare

Create a Cache Rule for the zone:

- **If** `URI Path starts with /media/`
- **Then** Cache eligible, Edge TTL *Use cache-control header if present* (one
  year), Browser TTL *Respect origin*.

Optionally add a second rule matching `http.request.method eq "GET"` and
`URI Path matches /media/*` with **Cache Everything** if the default rule does
not cache extensionless paths. Do **not** put Cloudflare Access or a challenge
in front of `/media/*`; the app, OG renderer and push service workers fetch
those URLs without cookies.

Keep the proxy **on** (orange cloud): with a one-year immutable TTL, repeat
views never reach the VPS.

## 4. Background processing

Video and audio are transcoded after the upload returns:

- Images: processed inline (EXIF/GPS stripped, max 2048px, WebP, plus `-1024`,
  `-480` and `-thumb` renditions).
- GIFs: stored as GIFs (thumbnail is a static WebP for lists).
- PNG: kept as PNG only where transparency matters (badges, frames, emojis,
  admin "original quality").
- Video: H.264/AAC MP4, max 720p, `+faststart`, poster frame.
- Audio: AAC/M4A, 128 kbps, loudness-normalised.

The composer waits for `status: "processing"` to clear before it publishes, so
a post never points at a file that does not exist yet; the Media Library shows
the same state for admins. The app kicks the queue itself. Install the recovery
timer so a restart or a failed job cannot strand a transcode:

```bash
sudo cp deploy/systemd/loop-media-worker.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now loop-media-worker.timer
```

## 5. Cleanup and backups

```bash
sudo cp deploy/systemd/loop-media-cleanup.* deploy/systemd/loop-media-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now loop-media-cleanup.timer loop-media-backup.timer
```

- **Orphans** — `scripts/media-cleanup.mjs` (Sundays 04:30 UTC) deletes files
  with no `media_uploads` row older than 24h, dead transcode sources older than
  a week, and empty date folders. `--dry-run` prints what it would delete.
- **Backups** — `scripts/media-backup.sh` (03:15 UTC) `rclone copy`s the volume
  to B2/R2, verifies the remote is readable, and posts to
  `MEDIA_ALERT_WEBHOOK` on any failure. It never deletes from the remote.
- **Backup freshness** — the script writes `/var/loop-uploads/.backup/last-success.txt`.

Always test a restore once: `rclone copy b2:loop-media/some-month /tmp/restore`.

Deletes also happen inline: deleting a post, clearing a chat or deleting an
account removes that content's files (files another post or profile still uses
are kept).

## 6. Limits and admin controls

Enforced server-side in `lib/media/upload-service.ts`; defaults live in
`lib/media/policy.ts` and are stored in `admin_settings.media_upload_policy`.
Change them in **Admin → Media → Upload rules** — no redeploy.

| Rule | Default |
| --- | --- |
| Absolute per-file ceiling | 500 MB (admins included) |
| Images | 10 MB (admins 25 MB) |
| Video | 100 MB free / 250 MB Pro |
| Voice messages | 10 MB |
| New accounts (age / post threshold) | 25 MB video |
| Files per post | 4 free / 10 Pro |
| Storage quota | 2 GB free / 10 GB Pro |
| Uploads per hour | 20 |
| Daily bytes | 500 MB free / 2 GB Pro |
| Disk warning / upload block | 80% / 90% |

Admins bypass the quota, daily cap, hourly cap and per-post count, but never the
500 MB ceiling or the 90% disk refusal. Admin uploads accept images (JPG, PNG,
WebP, GIF, AVIF, animated), video (MP4, MOV, WebM, MKV, AVI), audio (MP3, WAV,
M4A, OGG, FLAC), Lottie JSON and sanitised SVG — validated by magic bytes, not
extension. Archives, executables, HTML/JS and mismatched content are rejected
for every account, including admins.

Admin **original quality** skips resizing/transcoding so badges, frames,
emojis, GIFs and ad creatives keep exact pixels, transparency and animation. It
is on by default for GIFs, emojis, frames and shop art.

## 7. Media library

**Admin → Media Library** lists every file with type, size, uploader, folder,
date, processing state and where it is used. Search, filter by type / storage /
status, sort, copy URL, bulk upload with progress, replace bytes in place,
retry a failed transcode, and delete. Deleting a file that a post, badge, theme
or ad still points at returns `409` until the admin confirms. **Storage** shows
per-account usage and can delete an account's media; every admin upload, delete
and replace is written to the Audit Log (`media_upload`, `media_delete`,
`media_replace`, `media_policy_update`).

## 8. Local development

Nginx is not present locally, so `/media/...` will 404 in `next dev`. Either:

- point `MEDIA_PUBLIC_BASE` at the deployed media origin and open files there,
  or
- add a temporary local proxy (e.g. Caddy `handle_path /media/* { root
  /var/loop-uploads }`) — do not add a Next.js route for `/media`, because
  uploads must never be served by the app process.

Images and admin "original quality" uploads work without ffmpeg. Regular video
uploads return `503` until ffmpeg is installed, which is intentional: silently
serving an untranscoded 4K phone video would eat the volume and the viewer's
data plan.

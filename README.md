# Loop — Social Media Reimagined

A full-stack social platform built with Next.js 15, Supabase, Better Auth, and TypeScript.

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, shadcn/ui, Framer Motion
- **Backend:** Next.js API routes, Supabase PostgreSQL (162 tables)
- **Auth:** Better Auth (migrated from Supabase Auth)
- **Storage:** Cloudinary (images/video), Supabase Storage (fallback)
- **Payments:** Stripe (subscriptions, USD purchases)
- **Realtime:** Supabase Realtime + Socket.io
- **Live Streaming:** LiveKit / 100ms

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

## Environment Variables

Required keys — add them in `.env.local` or your hosting dashboard:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `CRON_SECRET` | Secret for cron endpoints |

See `.env.example` for the full list.

## Project Structure

```
app/
├── api/              # 245+ API routes
│   ├── admin/        # Admin endpoints
│   ├── auth/         # Better Auth routes
│   ├── cron/         # Scheduled tasks
│   └── ...           # Feature routes
├── circles/          # Community pages
├── profile/          # User profiles
├── loop/             # Loop detail pages
└── settings/         # User settings
components/           # React components
lib/                  # Shared utilities
convex/               # Convex backend (if used)
```

## Key Features

- **Loop Trees** — Branching conversations (up to 10 levels deep)
- **Circles** — Discord-like communities with rooms, voice, events
- **Co-Loop** — Real-time collaborative content creation
- **Gifting & Coins** — Virtual economy with shop, gifts, earnings
- **Cosmetics** — Profile themes, frames, auras, badges
- **Duels** — Community voting on creative content
- **Developer Hub** — Code sharing with live previews
- **Premium** — Subscription tiers with Pro features

## Deployment

Built for Render (or any Node.js host):

```bash
npm run build   # produces .next/ output
npm start       # starts production server
```

## Documentation

Detailed guides are in [`docs/`](./docs/):

- [Implementation Guide](docs/COMPLETE_IMPLEMENTATION_GUIDE.md)
- [Deployment Guide](docs/FINAL_DEPLOYMENT_GUIDE.md)
- [UUID → Snowflake Migration Plan](docs/MIGRATION_PLAN_UUID_TO_SNOWFLAKE.md)
- [Setup & Testing](docs/SETUP_AND_TESTING_GUIDE.md)

# LOOP Rust API

This is the Rust backend foundation for LOOP. The Next.js application remains the frontend; new server-side domain behaviour belongs here.

## Local development

Requirements: stable Rust, Docker and Docker Compose.

1. Copy .env.example to .env.
2. Start PostgreSQL with docker compose up -d postgres.
3. Run cargo run from this directory.
4. Check http://localhost:8080/health/live and /health/ready.

The Compose stack applies embedded additive SQLx migrations to its local database by default. Standalone API runs default to RUN_MIGRATIONS=false. Never enable automatic migrations against production without a reviewed change window and verified backup.

Or run the full local stack with docker compose up --build. The local database is exposed only on 127.0.0.1:54329. Its default password is for local development only.

## Endpoints

- GET /health/live — process liveness.
- GET /health/ready — PostgreSQL readiness.
- GET /v1/system/capabilities — service version and configured infrastructure capabilities.
- GET /v1/me — authenticated current user resolved through the existing Better Auth session and profiles rows.
- GET /v1/collections — public, owned and collaborated collections.
- POST /v1/collections — create a collection.
- GET /v1/collections/{collection_id} — view a visible collection and its items.
- POST /v1/collections/{collection_id}/items — add an accessible Loop, Circle or HTTPS link.
- DELETE /v1/collections/{collection_id}/items/{item_id} — remove an item with owner/editor permission.

The S3 storage adapter is intentionally private to the backend. Upload signing is not exposed until authenticated session and resource-authorization middleware is in place. Do not add an unauthenticated presign endpoint: it would turn storage usage into an abuse and cost surface.

## Environment

See .env.example. AWS credentials should come from the default AWS credential chain or an attached IAM role. Never put long-lived AWS keys in frontend environment variables.

## Migration rule

Do not point this service at production until a verified backup, staging restore, schema inventory and rollback plan exist. The first stage shares no production writes and does not change the existing app API.

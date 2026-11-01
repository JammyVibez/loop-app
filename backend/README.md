# LOOP Rust API

This is the Rust backend foundation for LOOP. The Next.js application remains the frontend; new server-side domain behaviour belongs here.

## Local development

Requirements: stable Rust, Docker and Docker Compose.

1. Copy .env.example to .env.
2. Start PostgreSQL with docker compose up -d postgres.
3. Run cargo run from this directory.
4. Check http://localhost:8080/health/live and /health/ready.

Or run the full local stack with docker compose up --build. The local database is exposed only on 127.0.0.1:54329. Its default password is for local development only.

## Endpoints

- GET /health/live — process liveness.
- GET /health/ready — PostgreSQL readiness.
- GET /v1/system/capabilities — service version and configured infrastructure capabilities.

The S3 storage adapter is intentionally private to the backend. Upload signing is not exposed until authenticated session and resource-authorization middleware is in place. Do not add an unauthenticated presign endpoint: it would turn storage usage into an abuse and cost surface.

## Environment

See .env.example. AWS credentials should come from the default AWS credential chain or an attached IAM role. Never put long-lived AWS keys in frontend environment variables.

## Migration rule

Do not point this service at production until a verified backup, staging restore, schema inventory and rollback plan exist. The first stage shares no production writes and does not change the existing app API.

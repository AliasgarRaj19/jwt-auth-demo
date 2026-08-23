# JWT Auth Demo

Standalone portfolio demo for secure registration, email verification, JWT auth, password reset, password change, and a read-only admin panel. PostgreSQL is now the canonical database runtime.

## Features

- Registration with first name, optional profile fields, and password confirmation
- Email verification with expiring one-time tokens
- Login with verified-account enforcement
- Short-lived access JWTs and rotating refresh JWTs
- HttpOnly refresh-token cookie plus CSRF token cookie/header protection
- Forgot-password and reset-password flow
- Authenticated user panel
- Password change
- Database-backed master admin login and read-only dashboard
- PostgreSQL persistence via Prisma
- Docker and Docker Compose local setup

## Stack

- React
- Vite
- Node.js
- Express
- PostgreSQL
- Prisma
- Argon2id
- `jose`
- Zod
- Nodemailer
- Tailwind CSS
- Vitest
- Supertest

## Folder Structure

- `client/` React frontend
- `server/` Express API, Prisma schema, tests
- `docker-compose.yml` local container orchestration
- `.env.example` environment template
- `docs/` reserved for future docs

## Architecture

- `server/src/routes` contains HTTP endpoints
- `server/src/services` contains business logic
- `server/src/lib` contains reusable security helpers
- `server/prisma/schema.prisma` defines the PostgreSQL data model
- `client/src/main.jsx` contains a lightweight routed SPA

## Security Design

- Passwords are hashed with Argon2id
- Repeat-password is validated but never stored
- Verification and reset tokens are generated with secure randomness and stored only as hashes
- JWTs are signed with explicit issuer, audience, algorithm, and token-purpose checks
- Refresh tokens are rotated and revoked in the database
- Refresh authentication uses an HttpOnly cookie
- CSRF-protected state-changing requests use a double-submit token strategy
- Rate limiting is applied to sensitive endpoints
- Production-safe error handling avoids leaking stack traces or token details

## Docker Architecture

- `client` serves the Vite app on `http://localhost:5501`
- `server` serves the API on `http://localhost:5500`
- `postgres` provides the canonical database on Docker-internal port `5432`
- PostgreSQL data is stored in a named Docker volume so it survives `docker compose down`

## JWT Architecture

- Access tokens are short-lived and used for API authorization
- Refresh tokens last longer and are stored as hashed records in PostgreSQL
- Access and refresh tokens are purpose-separated so one cannot be substituted for the other
- Refresh token rotation invalidates the previous token on each use

## Verification Flow

1. User registers
2. The app creates a verification token valid for 15 minutes
3. Only the token hash is stored
4. A verification link is emailed with the original token
5. The token is exchanged once, then marked used

## PostgreSQL Architecture

- Prisma uses the `postgresql` provider
- `DATABASE_URL` points to the Docker service name `postgres`
- The schema and relationships remain the same as the earlier SQLite version
- The app no longer depends on SQLite runtime files or a SQLite Docker volume

## Forgot / Reset Flow

1. User submits an email address
2. A reset token is generated with a 15-minute expiration
3. The hash is stored in SQLite
4. The emailed link is used once to set a new password
5. Existing refresh sessions are revoked after reset

## Admin Read-Only Design

- MasterAdmin is stored in PostgreSQL and separate from `User`
- Bootstrap credentials are used only to create or preserve the first `MasterAdmin` row
- Admin dashboard can display user data in masked form
- Mutation actions are visually shown but disabled
- The backend does not expose admin mutation endpoints

## Privacy Masking

- Admin views intentionally hide most personal fields
- Email may be shown for demo verification purposes
- Passwords are never returned to the frontend

## PostgreSQL Persistence

- PostgreSQL lives on a named Docker volume in local Docker Compose runs
- Recreating the container does not delete the database data
- The schema is still portable enough that a future lightweight SQLite adaptation is possible if a project needs it

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `NODE_ENV`
- `PORT`
- `CLIENT_URL`
- `APP_URL`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `MASTER_ADMIN_USERNAME`
- `MASTER_ADMIN_PASSWORD`
- `COOKIE_SECURE`

## Gmail SMTP

- Use Gmail SMTP credentials through environment variables
- Never commit the Gmail username or app password
- Verification and reset emails use `APP_URL` so production URLs are not hard-coded

## Prisma Setup

Run:

```bash
npm install
docker compose up --build
docker compose exec server npx prisma generate
docker compose exec server npx prisma migrate deploy
```

## Local Development

```bash
npm run dev
```

The frontend runs on Vite and the API runs on Express for non-Docker local development, but the canonical workflow is Docker Compose.

## Docker Setup

```bash
docker compose up --build
docker compose down
```

PostgreSQL data is persisted in a Docker named volume.

## Testing

```bash
npm test
```

The test suite uses Vitest and Supertest and mocks the email service so Gmail is not required.

## Environment Variables

Use the root `.env` for Docker Compose. `server/.env` and `client/.env` are legacy local files and are not required for the Docker-based runtime.

- `NODE_ENV`
- `PORT`
- `CLIENT_URL`
- `APP_URL`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `MASTER_ADMIN_USERNAME`
- `MASTER_ADMIN_PASSWORD`
- `COOKIE_SECURE`
- `RATE_LIMIT_DEV_MULTIPLIER`
- `RATE_LIMIT_DEV_WINDOW_MS`

## Master Admin Bootstrap

- `MasterAdmin` is a database-backed identity separate from `User`
- The bootstrap credentials in `.env` are not checked at runtime for admin login
- Use the seed command to create the first `MasterAdmin` safely and idempotently
- Future `AdminStaff` accounts will be a separate model/system later

Seed command:

```bash
npm run prisma:seed -w server
```

## Session Restore

- The frontend attempts one startup refresh using the HttpOnly refresh cookie.
- If the refresh succeeds, the access token is restored in memory and the UI becomes ready.
- If it fails, the app resolves loading and renders Login.
- Login/logout/admin login merge auth state so the `ready` flag is preserved.

## Production Considerations

- Run behind HTTPS
- Set secure cookies in production
- Configure a real `APP_URL`
- Configure a real Gmail SMTP account or equivalent
- Keep secrets out of source control
The 24-hour demo-data cleanup used by the public portfolio deployment is VPS infrastructure behavior and is intentionally not included in this reusable authentication source.

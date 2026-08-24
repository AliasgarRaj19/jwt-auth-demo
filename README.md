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
- JWTs are signed with explicit issuer, audience, algorithm, `kid`, and token-purpose checks
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
- Access tokens are signed with RS256 using an active RSA private key
- Refresh tokens are signed with RS256 using a separate refresh keypair and are stored as hashed records in PostgreSQL
- Action tokens are signed with a separate RSA keypair for short-lived internal recovery flows
- Access and refresh tokens are purpose-separated so one cannot be substituted for the other
- Refresh token rotation invalidates the previous token on each use
- JWT verification resolves the public key by `kid`
- Public access-token verification keys are discoverable through `/.well-known/jwks.json` behind the API path, e.g. `/jwt-auth-demo/api/.well-known/jwks.json`

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
3. The hash is stored in PostgreSQL
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
- `JWT_ACCESS_PRIVATE_KEY_PATH`
- `JWT_ACCESS_PUBLIC_KEY_PATH`
- `JWT_ACCESS_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_ACCESS_KID`
- `JWT_ACCESS_PREVIOUS_KID`
- `JWT_REFRESH_PRIVATE_KEY_PATH`
- `JWT_REFRESH_PUBLIC_KEY_PATH`
- `JWT_REFRESH_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_REFRESH_KID`
- `JWT_REFRESH_PREVIOUS_KID`
- `JWT_ACTION_PRIVATE_KEY_PATH`
- `JWT_ACTION_PUBLIC_KEY_PATH`
- `JWT_ACTION_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_ACTION_KID`
- `JWT_ACTION_PREVIOUS_KID`
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

For production, copy `.env.production.example` to `.env.production` and set:

- `NODE_ENV=production`
- `CLIENT_URL=https://<production-domain>`
- `APP_URL=https://<production-domain>`
- `COOKIE_SECURE=true`
- `TRUST_PROXY_HOPS=1`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_ACCESS_PRIVATE_KEY_PATH`
- `JWT_ACCESS_PUBLIC_KEY_PATH`
- `JWT_ACCESS_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_ACCESS_KID`
- `JWT_ACCESS_PREVIOUS_KID`
- `JWT_REFRESH_PRIVATE_KEY_PATH`
- `JWT_REFRESH_PUBLIC_KEY_PATH`
- `JWT_REFRESH_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_REFRESH_KID`
- `JWT_REFRESH_PREVIOUS_KID`
- `JWT_ACTION_PRIVATE_KEY_PATH`
- `JWT_ACTION_PUBLIC_KEY_PATH`
- `JWT_ACTION_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_ACTION_KID`
- `JWT_ACTION_PREVIOUS_KID`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM`
- `MASTER_ADMIN_USERNAME`
- `MASTER_ADMIN_PASSWORD`
- `NGINX_SERVER_NAME`
- `NGINX_SSL_CERTIFICATE`
- `NGINX_SSL_CERTIFICATE_KEY`

## Gmail SMTP

- Use Gmail SMTP credentials through environment variables
- Never commit the Gmail username or app password
- Verification and reset emails use `APP_URL` so production URLs are not hard-coded

## Prisma Setup

Local development:

```bash
npm install
docker compose up --build
docker compose exec server npx prisma generate
docker compose exec server npx prisma migrate deploy
```

Production migration command:

```bash
docker compose -f docker-compose.prod.yml run --rm server npx prisma migrate deploy
```

Production seed command:

```bash
docker compose -f docker-compose.prod.yml run --rm server npm run prisma:seed
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

Production Docker workflow:

```bash
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml run --rm server npx prisma migrate deploy
docker compose -f docker-compose.prod.yml run --rm server npm run prisma:seed
```

Production uses the Nginx reverse proxy in [`nginx/default.conf.template`](/E:/Agentic%20AI%20Learning/Opensource%20project/Documents/General%20System/jwt-auth-demo/nginx/default.conf.template) and the build image in [`nginx/Dockerfile`](/E:/Agentic%20AI%20Learning/Opensource%20project/Documents/General%20System/jwt-auth-demo/nginx/Dockerfile).

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
- `JWT_ACCESS_PRIVATE_KEY_PATH`
- `JWT_ACCESS_PUBLIC_KEY_PATH`
- `JWT_ACCESS_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_ACCESS_KID`
- `JWT_ACCESS_PREVIOUS_KID`
- `JWT_REFRESH_PRIVATE_KEY_PATH`
- `JWT_REFRESH_PUBLIC_KEY_PATH`
- `JWT_REFRESH_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_REFRESH_KID`
- `JWT_REFRESH_PREVIOUS_KID`
- `JWT_ACTION_PRIVATE_KEY_PATH`
- `JWT_ACTION_PUBLIC_KEY_PATH`
- `JWT_ACTION_PREVIOUS_PUBLIC_KEY_PATH`
- `JWT_ACTION_KID`
- `JWT_ACTION_PREVIOUS_KID`
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

- Run behind HTTPS with Nginx terminating TLS
- Keep the backend behind the reverse proxy and set `TRUST_PROXY_HOPS=1`
- Use same-origin browser API calls through `/api/...` in production
- Set secure cookies in production
- Configure a real `APP_URL` and `CLIENT_URL`
- Configure a real Gmail SMTP account or equivalent
- Keep secrets out of source control
- Use RSA 3072-bit keypairs for JWT signing and rotate them with `kid`
- Publish access-token public keys through `/.well-known/jwks.json`
- Keep refresh signing keys private; only their hashed DB records are used for refresh rotation
- Existing HS256 sessions are intentionally not supported after this migration, so users must log in again once
- The known Prisma `deepmerge-ts` advisory currently comes from Prisma tooling, not app runtime code
- The 24-hour demo-data cleanup used by the public portfolio deployment is VPS infrastructure behavior and is intentionally not included in this reusable authentication source

## Production Deployment Checklist

1. Pull the latest source.
```bash
cd /opt/general-system/jwt-auth-demo
git pull origin main
```
2. Create or regenerate JWT keys.
```bash
mkdir -p /opt/general-system/jwt-auth-demo/secrets/jwt
npm run jwt:keys -w server -- /opt/general-system/jwt-auth-demo/secrets/jwt
```
3. Prepare the host group and permissions.
```bash
getent group 10001 || groupadd -g 10001 jwtapp
chown -R root:10001 /opt/general-system/jwt-auth-demo/secrets/jwt
chmod 750 /opt/general-system/jwt-auth-demo/secrets/jwt
chmod 640 /opt/general-system/jwt-auth-demo/secrets/jwt/*-private.pem
chmod 640 /opt/general-system/jwt-auth-demo/secrets/jwt/*-public.pem
```
- Private keys remain readable by the `jwtapp` group.
- Keys are not world-readable.
- The Docker mount stays read-only.
4. Configure `.env.production` with container key paths.
```bash
JWT_ACCESS_PRIVATE_KEY_PATH=/run/secrets/jwt/access-current-private.pem
JWT_ACCESS_PUBLIC_KEY_PATH=/run/secrets/jwt/access-current-public.pem
JWT_ACCESS_KID=access-20260824
JWT_ACCESS_PREVIOUS_PUBLIC_KEY_PATH=
JWT_ACCESS_PREVIOUS_KID=

JWT_REFRESH_PRIVATE_KEY_PATH=/run/secrets/jwt/refresh-current-private.pem
JWT_REFRESH_PUBLIC_KEY_PATH=/run/secrets/jwt/refresh-current-public.pem
JWT_REFRESH_KID=refresh-20260824
JWT_REFRESH_PREVIOUS_PUBLIC_KEY_PATH=
JWT_REFRESH_PREVIOUS_KID=

JWT_ACTION_PRIVATE_KEY_PATH=/run/secrets/jwt/action-current-private.pem
JWT_ACTION_PUBLIC_KEY_PATH=/run/secrets/jwt/action-current-public.pem
JWT_ACTION_KID=action-20260824
JWT_ACTION_PREVIOUS_PUBLIC_KEY_PATH=
JWT_ACTION_PREVIOUS_KID=
```
5. Validate the Compose configuration.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config
```
6. Build the server image.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build server
```
7. Start PostgreSQL.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres
```
8. Run Prisma migrations as a one-off container.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm server npx prisma migrate deploy
```
- Prisma migrations are explicit and do not run on every restart.
9. Seed MasterAdmin only when required.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm server npm run prisma:seed
```
- Seeding is explicit and does not run on every restart.
10. Start or recreate the API and frontend.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build server nginx
```
11. Verify the non-root runtime.
```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec server id
docker compose -f docker-compose.prod.yml --env-file .env.production exec server whoami
```
- Expected: `uid=10001`, `gid=10001`, `jwtapp`.
12. Verify container security.
- Production server uses `cap_drop: ALL`.
- Production server uses `no-new-privileges:true`.
- JWT keys are mounted read-only.
13. Verify health.
```bash
curl https://signalgrowth.in/jwt-auth-demo/api/health
```
- Expected response: `{"ok":true}`
14. Verify JWKS.
```bash
curl https://signalgrowth.in/jwt-auth-demo/api/.well-known/jwks.json
```
- Expected JWKS fields: `kty`, `use`, `alg`, `kid`, `n`, `e`
- No private key material is published.
- Refresh and action keys are not published.
15. Verify browser auth.
- Existing HS256 sessions are invalidated once after RS256 deployment.
- Log in again as a user.
- Log in again as MasterAdmin.
- Confirm refresh, multi-tab, logout propagation, and role isolation behavior.
16. Key rotation note.
- Generate a new keypair.
- Move the current public key to the previous slot.
- Update the current `kid` and key paths.
- Redeploy.
- Keep the previous public key until old JWTs expire.
- Remove the previous key safely afterward.
17. Future ES256 profile.
- The module can later be adapted to ES256 while preserving the same `kid`-based key rotation and JWKS architecture when elliptic-curve keys or smaller signatures are required.

## Production Host Permissions

- Use host group GID `10001` so it matches the container `jwtapp` group.
- Recommended host ownership: `root:10001`
- Recommended directory mode: `750`
- Recommended private-key mode: `640`
- Recommended public-key mode: `640` or `644`

## Production Host Permissions

- Use a dedicated host group with numeric GID `10001` for the JWT secret directory
- Match that group to the container `jwtapp` group so the non-root server can read mounted key files
- Recommended host ownership: `root:10001`
- Recommended directory mode: `750`
- Recommended private-key mode: `640`
- Recommended public-key mode: `640` or `644`

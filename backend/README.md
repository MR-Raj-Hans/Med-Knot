# MedKnot API (local Phase 1)

NestJS 11 modular API, PostgreSQL 16, Prisma ORM 7, Redis 7, and Jest. This is a local development service; it has not been deployed to a public host. Node.js 22.12+ is required.

## Start the local stack

From PowerShell:

```powershell
cd C:\Users\Rajh4\Downloads\MedKnot\backend
npm install
npm run env:dev
docker compose --env-file .env -f compose.yaml up -d
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

`env:dev` creates a new ignored `backend/.env` with random local-only passwords and a signing key. It refuses to overwrite an existing `.env`. Keep this file private. Compose starts only the MedKnot PostgreSQL and Redis containers. They use loopback ports 55432 and 56379, which avoid ports already used by other local projects. The API listens on 4400 because 4000 is already occupied in this environment.

Check liveness at `http://127.0.0.1:4400/api/v1/health/live`, readiness at `http://127.0.0.1:4400/api/v1/health/ready`, and development OpenAPI at `http://127.0.0.1:4400/api/v1/docs`. Swagger is local-only and is disabled in production.

Run `npm run verify:local` to create a synthetic `example.test` patient, exercise verification, persistence, login, refresh rotation/reuse revocation, logout, and password reset, then remove the temporary account. It prints statuses only; it does not print the password, OTP, or bearer tokens.

## Mobile app connection

Set `EXPO_PUBLIC_API_BASE_URL` in a local Expo environment:

- Android emulator: `http://10.0.2.2:4400/api/v1`
- iOS simulator or web on the same computer: `http://127.0.0.1:4400/api/v1`
- Physical Android/iOS device: `http://<computer-LAN-address>:4400/api/v1` and allow the port through the computer firewall

The backend is bound on all interfaces so a device on the same trusted LAN can reach it. Do not use the local HTTP URL in an EAS preview or production app. Those builds need a real HTTPS deployment and an `EXPO_PUBLIC_API_BASE_URL` configured in EAS before rebuilding.

Without a backend URL, the mobile app's synthetic preview auth runs only in Expo development when `EXPO_PUBLIC_AUTH_MODE=development`. It is disabled in EAS preview and production. This local mock does not contact this API or create server accounts.

## Authentication behavior

- Patient registration stores a pending user and patient profile. Passwords use Argon2id; email/phone are unique and terms acceptance is timestamped.
- `EMAIL_PROVIDER=development` is a local-only adapter. It returns a random one-time six-digit verification/reset code only in development responses; only an HMAC digest is stored. Production startup requires `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `EMAIL_API_KEY`; production cannot select the local adapter.
- Resend delivery uses the server-side HTTPS API with a bounded timeout, plain-text and HTML templates, and status logging that excludes recipient addresses, codes, and credentials. A non-success response returns 503; the API never returns a production code or reports that a failed message was sent.
- Verification codes expire, are single-use, and are limited to five attempts. Reset codes follow the same expiry, attempt, and single-use rules. The configured sender domain and API key still need to be supplied and delivery tested before production auth is usable.
- Verification resend is allowed only for the newest pending challenge, observes `OTP_RESEND_COOLDOWN_SECONDS` (30 seconds by default), and remains subject to Redis IP/challenge rate limits.
- Login returns a 15-minute access token and an opaque refresh token. The refresh token is stored as an HMAC digest and rotates on use. Reuse of a consumed refresh token revokes the entire session family. Logout revokes the session immediately; access requests check the session state in PostgreSQL.
- Access and refresh tokens are stored in Expo SecureStore on Android/iOS. The web client holds them in memory only.
- Authentication routes use Redis-backed IP and identity throttling. If Redis is down, authentication fails closed. There is no public administrator registration endpoint.
- `npm run admin:bootstrap` is a local one-time command. It requires explicit `BOOTSTRAP_ADMIN_CONFIRM=CREATE_FIRST_ADMIN`, credentials in the ignored local environment, and refuses to create a second global admin.
- Clinical-note text is encrypted with AES-256-GCM. Production must provide `RECORD_ENCRYPTION_KEY` as a base64-encoded 32-byte key from a separate secret manager. Local development derives a non-production key from `ACCESS_TOKEN_SECRET`; rotating that secret without a data migration will make locally stored notes unreadable.

## API foundation

All routes use `/api/v1`. The current route contract is documented in [`../docs/api-contracts.md`](../docs/api-contracts.md). `GET /patient/home` summarizes only the authenticated patient's next confirmed appointment and released prescription count; it does not supply demo appointments or medical records. Follow-ups remain unavailable until a follow-up module exists.

The schema includes users, patient profiles, roles, permissions, hospital memberships, refresh sessions/tokens, verification/reset challenges, audit events, the verified hospital/doctor directory, availability slots, appointments, encrypted clinical notes, and encrypted prescription entries. Patient routes enforce the patient role and ownership. Directory search returns only active, approved hospitals and doctors. Staff must enter and verify directory information; no fictional records are seeded. Hospital administrators are restricted to active hospital membership, while global administrators can manage across hospitals. Appointment booking claims a slot and writes the appointment/history in one transaction; a unique active-slot constraint and idempotency key protect concurrent retries. Clinicians can complete their own appointment after its scheduled end and release one consultation note or prescription draft for that visit. Patients can add private notes and read only released records and prescriptions linked to their profile; sensitive reads and changes are audited without note content. Prescription entries are clinician-entered records only; they are not checked for interactions or sent to pharmacies.

## Checks

```powershell
npm run prisma:generate
npx prisma validate
npm run build
npm run typecheck
npm run lint
npm test
```

The initial SQL migration and additive verified-directory, appointment, and clinical-record migrations are committed in `prisma/migrations/`. `npm run prisma:migrate` applies migrations to the configured local database. These additive migrations were schema-validated but not applied in this session because PostgreSQL was unreachable. The app can only offer in-person bookings; online video is disabled until a real provider is integrated. Queue management is still pending. Attachments, lab reports, structured diagnoses, e-prescribing, pharmacy transmission and key rotation are not implemented.

## Deployment status

No cloud resources, domains, mail provider, or public API endpoint are configured. Do not put real patient data in this local development environment.

## Railway deployment preparation

The API service is prepared for Railway from the `backend/` service root. The Docker image excludes local `.env` files, generates the Prisma client during the image build, runs `prisma migrate deploy` as a pre-deploy step, and uses the database/Redis readiness endpoint for its health check. In Railway, add PostgreSQL and Redis to the same project and keep both on private networking. The service must reference their `DATABASE_URL` and `REDIS_URL` values.

Set these variables in Railway's service settings, not in Git:

- `APP_ENV=production`
- `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and secret `EMAIL_API_KEY` for real verification/reset email delivery
- Secret `ACCESS_TOKEN_SECRET` with at least 32 characters
- Secret `RECORD_ENCRYPTION_KEY` containing a base64-encoded 32-byte key
- `DATABASE_URL` and `REDIS_URL` from the linked private PostgreSQL and Redis services
- `SWAGGER_ENABLED=false`

Railway injects `PORT`. Set `CORS_ORIGINS` only if a web client is hosted, and list its exact HTTPS origin. Do not enable the development email transport or publish database/Redis ports. Apply this setup to a staging environment with synthetic records first. No Railway account, project, secrets, email sender, or public API URL is linked from this checkout yet. AI/ML inference is not implemented or configured; do not send health data to a model provider until one is selected and reviewed.
